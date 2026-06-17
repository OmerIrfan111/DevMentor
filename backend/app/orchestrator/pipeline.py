import json
import asyncio
import redis.asyncio as aioredis
from datetime import datetime, timezone
from app.config import settings
from app.database import get_db
from app.band.session import create_session_room
from app.agents.base import fetch_repo_contents
from app.agents.security import SecurityAgent
from app.agents.architect import ArchitectAgent
from app.agents.onboarding import OnboardingAgent
from app.agents.mentor import MentorAgent


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _sse_channel(session_id: str) -> str:
    return f"sse:{session_id}"


async def publish_event(session_id: str, event_type: str, data: dict) -> None:
    r = _redis()
    try:
        payload = json.dumps({"type": event_type, "data": data})
        await r.publish(_sse_channel(session_id), payload)
    finally:
        await r.aclose()


async def run_pipeline(
    session_id: str,
    repo_url: str,
    github_token: str | None,
    latest_sha: str | None = None,
) -> None:
    db = get_db()
    agents_order = ["security", "architect", "onboarding", "mentor"]

    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "running", "agents_pending": agents_order}},
    )

    try:
        # Create Band room
        band_room_id = await create_session_room(session_id, repo_url)
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"band_room_id": band_room_id}},
        )

        # Fetch repo once, share across all agents
        await publish_event(session_id, "agent_update", {
            "agent": "orchestrator", "status": "fetching", "progress": 0.0
        })
        repo = await fetch_repo_contents(repo_url, github_token)

        agent_results: dict[str, dict] = {}

        agent_classes = {
            "security": SecurityAgent,
            "architect": ArchitectAgent,
            "onboarding": OnboardingAgent,
            "mentor": MentorAgent,
        }

        for i, agent_name in enumerate(agents_order):
            await publish_event(session_id, "agent_update", {
                "agent": agent_name, "status": "running", "progress": 0.0
            })
            await db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$addToSet": {"agents_completed": {"$each": []}},
                    "$set": {"agents_pending": agents_order[i:]},
                },
            )

            AgentClass = agent_classes[agent_name]
            agent = AgentClass(band_room_id=band_room_id, session_id=session_id)
            result = await agent.run(repo, github_token)
            agent_results[agent_name] = result

            await db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$push": {"agents_completed": agent_name},
                    "$pull": {"agents_pending": agent_name},
                },
            )
            await publish_event(session_id, "agent_complete", {
                "agent": agent_name,
                "band_message_id": result.get("band_message_id"),
                "output_type": agent_name.upper(),
            })

        # Build and persist report
        security_r = agent_results.get("security", {})
        architect_r = agent_results.get("architect", {})
        onboarding_r = agent_results.get("onboarding", {})
        mentor_r = agent_results.get("mentor", {})

        import secrets as secrets_mod
        share_token = f"pub_{secrets_mod.token_urlsafe(12)}"

        report = {
            "session_id": session_id,
            "repo_url": repo_url,
            "band_room_id": band_room_id,
            "adr": architect_r.get("adr", ""),
            "contributing": onboarding_r.get("contributing", ""),
            "setup_walkthrough": onboarding_r.get("setup_walkthrough", ""),
            "first_good_issues": onboarding_r.get("first_good_issues", []),
            "mentor_feedback": mentor_r.get("feedback", []),
            "security_findings": security_r.get("findings", []),
            "human_review_flags": [],
            "socratic_score": mentor_r.get("socratic_score", {"questions": 0, "corrections": 0}),
            "share_token": share_token,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Collect human review flags
        from app.band.client import BandClient
        band_msgs = await BandClient().get_room_messages(band_room_id)
        for msg in band_msgs:
            if msg.get("needs_human_review"):
                report["human_review_flags"].append({
                    "message_id": msg.get("_band_message_id"),
                    "agent": msg.get("agent_name"),
                    "reason": "low confidence" if msg.get("confidence", 1) < 0.7 else "flagged",
                })

        # Build band_thread for frontend
        report["band_thread"] = [
            {
                "agent": msg.get("agent_name", ""),
                "message_id": msg.get("_band_message_id", ""),
                "output_type": msg.get("output_type", ""),
                "content": msg.get("content", ""),
                "timestamp": "",
            }
            for msg in band_msgs
        ]

        await db.reports.insert_one(report)
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed"}},
        )

        # Cache this result so the same repo+SHA returns instantly next time
        if latest_sha:
            from app.orchestrator.cache import put as cache_put
            await cache_put(repo_url, latest_sha, session_id)

        await publish_event(session_id, "pipeline_complete", {
            "session_id": session_id,
            "report_url": f"/report/{session_id}",
        })

    except Exception as exc:
        import traceback as _tb
        _tb.print_exc()
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": str(exc)}},
        )
        await publish_event(session_id, "pipeline_error", {
            "session_id": session_id,
            "error": str(exc),
        })
        raise


async def stream_session_events(session_id: str):
    """Async generator yielding SSE-formatted strings."""
    r = _redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(_sse_channel(session_id))

    # Send current status immediately
    db = get_db()
    session = await db.sessions.find_one({"session_id": session_id})
    if session:
        yield f"event: session_status\ndata: {json.dumps({'status': session.get('status'), 'agents_completed': session.get('agents_completed', [])})}\n\n"
        if session.get("status") in ("completed", "failed"):
            await pubsub.unsubscribe()
            await r.aclose()
            return

    try:
        timeout_seconds = 120
        elapsed = 0
        while elapsed < timeout_seconds:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                raw = json.loads(message["data"])
                yield f"event: {raw['type']}\ndata: {json.dumps(raw['data'])}\n\n"
                if raw["type"] in ("pipeline_complete", "pipeline_error"):
                    break
            elapsed += 1
            await asyncio.sleep(0)
    finally:
        await pubsub.unsubscribe()
        await r.aclose()
