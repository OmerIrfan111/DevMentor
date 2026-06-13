import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.auth.router import get_current_user
from app.models.user import UserOut
from app.models.session import AnalysisRequest, SessionStatus
from app.database import get_db
from app.orchestrator.pipeline import stream_session_events

router = APIRouter(prefix="/analyze", tags=["analyze"])

GITHUB_URL_RE = re.compile(r"^https?://(www\.)?github\.com/[^/]+/[^/\s?#]+", re.I)


@router.post("", status_code=202)
async def start_analysis(
    body: AnalysisRequest,
    current_user: UserOut = Depends(get_current_user),
):
    if not GITHUB_URL_RE.match(body.repo_url):
        raise HTTPException(status_code=422, detail="repo_url must be a GitHub HTTPS URL")

    session_id = str(uuid.uuid4())
    db = get_db()

    session_doc = {
        "session_id": session_id,
        "user_id": current_user.id,
        "repo_url": body.repo_url,
        "github_token": body.github_token,
        "diff_mode": body.diff_mode,
        "status": "queued",
        "agents_completed": [],
        "agents_pending": ["security", "architect", "onboarding", "mentor"],
        "band_room_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.sessions.insert_one(session_doc)

    # Dispatch Celery task
    try:
        from app.orchestrator.tasks import run_pipeline_task
        run_pipeline_task.delay(session_id, body.repo_url, body.github_token)
    except Exception:
        # Fallback: run inline if Celery unavailable (dev mode)
        import asyncio
        from app.orchestrator.pipeline import run_pipeline
        asyncio.create_task(run_pipeline(session_id, body.repo_url, body.github_token))

    return {
        "session_id": session_id,
        "band_room_id": None,
        "status": "queued",
    }


@router.get("/stream/{session_id}")
async def stream_analysis(
    session_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_db()
    session = await db.sessions.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        stream_session_events(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}", response_model=SessionStatus)
async def get_analysis_status(
    session_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_db()
    session = await db.sessions.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionStatus(
        session_id=session_id,
        band_room_id=session.get("band_room_id"),
        status=session.get("status", "queued"),
        agents_completed=session.get("agents_completed", []),
        agents_pending=session.get("agents_pending", []),
        created_at=session.get("created_at"),
    )
