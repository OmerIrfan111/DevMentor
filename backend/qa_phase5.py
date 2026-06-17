"""
Phase 5 QA — Final Integration QA & Demo Prep
15 checks: pipeline integration (10) + HTTP layer (5)
All external services mocked — no real LLM, Band, GitHub, or Redis needed.
Run from: cd backend && python qa_phase5.py
"""
import asyncio, sys, os, json
from unittest.mock import AsyncMock, MagicMock, patch

sys.stdout.reconfigure(encoding="utf-8")

# ── Environment setup (must happen before any app import) ───────────────────
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "qa-secret-phase5-only")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("AIMLAPI_KEY", "test-key-for-qa")
os.environ.setdefault("MODEL_ID", "deepseek/deepseek-v4-flash")
os.environ.setdefault("BAND_API_KEY", "test-band-key")

import mongomock_motor
import app.database as db_module
db_module.client = mongomock_motor.AsyncMongoMockClient()

from fastapi.testclient import TestClient
from app.main import app
from app.auth.jwt import create_access_token
from app.database import get_db

http = TestClient(app)

PASS = "\033[32m  PASS\033[0m"
FAIL = "\033[31m  FAIL\033[0m"
errors = []


def check(label, condition, detail=""):
    if condition:
        print(f"{PASS}  {label}")
    else:
        print(f"{FAIL}  {label}" + (f" — {detail}" if detail else ""))
        errors.append(label)


# ── Mock data ───────────────────────────────────────────────────────────────

FAKE_REPO = {
    "owner": "octocat",
    "repo": "hello-world",
    "default_branch": "main",
    "file_tree": ["README.md", "app.py"],
    "file_contents": {
        "README.md": "# Hello World\n",
        "app.py": "import os\nprint(os.environ.get('SECRET'))\n",
    },
}

_LLM_RESPONSES = {
    "security": json.dumps({
        "summary": "One low-severity issue found.",
        "findings": [{"severity": "LOW", "file": "app.py", "line": 2,
                      "issue": "Potential secret exposure via print",
                      "recommendation": "Use a secrets manager"}],
        "confidence": 0.9,
        "flags": [],
    }),
    "architect": json.dumps({
        "adr": "# ADR-001: Single-file Architecture\n\n## Status: Accepted\n\nKeep it flat for this small project.",
        "anti_patterns": [],
        "tech_stack": ["Python"],
        "confidence": 0.85,
        "flags": [],
    }),
    "onboarding": json.dumps({
        "contributing": "# Contributing\n\nFork, branch, PR.",
        "setup_walkthrough": "1. Clone repo\n2. `python app.py`",
        "first_good_issues": [
            {"title": "Add unit tests", "description": "Cover app.py",
             "acceptance_criteria": ["All tests pass"], "difficulty": "easy"},
            {"title": "Add CI", "description": "GitHub Actions",
             "acceptance_criteria": ["Green CI"], "difficulty": "medium"},
            {"title": "Replace print with logging",
             "description": "Use stdlib logging",
             "acceptance_criteria": ["No bare prints"], "difficulty": "easy"},
        ],
        "confidence": 0.92,
        "flags": [],
    }),
    "mentor": json.dumps({
        "feedback": [
            {"type": "question", "text": "What happens when SECRET is absent in production?"},
            {"type": "correction", "text": "Swap `print` for `logging` for production readiness."},
        ],
        "debate": False,
        "socratic_score": {"questions": 1, "corrections": 1},
        "confidence": 0.88,
        "flags": [],
    }),
}


class _MockBandClient:
    def __init__(self): pass

    async def create_room(self, *a, **kw):
        return "room-qa-001"

    async def post_message(self, room_id, payload):
        return f"msg-{payload.get('agent_name', 'x')}"

    async def get_room_messages(self, room_id):
        return [
            {**json.loads(_LLM_RESPONSES["security"]),
             "agent_name": "security", "_band_message_id": "msg-security", "output_type": "SECURITY"},
            {**json.loads(_LLM_RESPONSES["architect"]),
             "agent_name": "architect", "_band_message_id": "msg-architect", "output_type": "ADR"},
            {**json.loads(_LLM_RESPONSES["onboarding"]),
             "agent_name": "onboarding", "_band_message_id": "msg-onboarding", "output_type": "CONTRIBUTING"},
            {**json.loads(_LLM_RESPONSES["mentor"]),
             "agent_name": "mentor", "_band_message_id": "msg-mentor", "output_type": "FEEDBACK"},
        ]


async def _mock_call_llm(self, system: str, user: str, max_tokens: int = 4096) -> str:
    return _LLM_RESPONSES[self.name]


# ── Pipeline Integration Tests ───────────────────────────────────────────────

PIPELINE_SESSION = "session-pipeline-qa-001"

async def _run_pipeline():
    db = get_db()
    await db.sessions.insert_one({
        "session_id": PIPELINE_SESSION,
        "user_id": "user-qa-001",
        "repo_url": "https://github.com/octocat/hello-world",
        "status": "pending",
        "agents_completed": [],
        "agents_pending": ["security", "architect", "onboarding", "mentor"],
        "band_room_id": None,
    })

    captured_events = []

    async def _capture(session_id, event_type, data):
        captured_events.append({"type": event_type, "data": data})

    with (
        patch("app.agents.base.fetch_repo_contents", new=AsyncMock(return_value=FAKE_REPO)),
        patch("app.band.client.BandClient", new=_MockBandClient),
        patch("app.agents.base.BandClient", new=_MockBandClient),
        patch("app.band.session.BandClient", new=_MockBandClient),
        patch("app.agents.base.BaseAgent.call_llm", new=_mock_call_llm),
        patch("app.orchestrator.pipeline.publish_event", new=_capture),
    ):
        from app.orchestrator.pipeline import run_pipeline
        await run_pipeline(
            PIPELINE_SESSION,
            "https://github.com/octocat/hello-world",
            None,
            None,
        )

    session = await db.sessions.find_one({"session_id": PIPELINE_SESSION})
    report = await db.reports.find_one({"session_id": PIPELINE_SESSION})
    return session, report, captured_events


print("\n── Pipeline Integration ─────────────────────────────────────────────")
session, report, events = asyncio.run(_run_pipeline())

check("Band room created and stored on session",
      session.get("band_room_id") == "room-qa-001")
check("All 4 agents completed",
      set(session.get("agents_completed", [])) == {"security", "architect", "onboarding", "mentor"})
check("Session status → completed",
      session.get("status") == "completed")
check("Report document saved to DB",
      report is not None)
check("Report contains ADR markdown",
      "ADR-001" in report.get("adr", ""))
check("Report contains CONTRIBUTING markdown",
      "Contributing" in report.get("contributing", ""))
check("Report has 3 first-good-issues",
      len(report.get("first_good_issues", [])) == 3)
check("Security findings stored (1 LOW finding)",
      len(report.get("security_findings", [])) == 1
      and report["security_findings"][0]["severity"] == "LOW")
check("Share token generated with pub_ prefix",
      report.get("share_token", "").startswith("pub_"))
agent_complete_events = [e for e in events if e["type"] == "agent_complete"]
check("SSE: 4 agent_complete events published",
      len(agent_complete_events) == 4)


# ── HTTP Layer Tests ─────────────────────────────────────────────────────────

SHARE_TOKEN = "pub_http_qa_tok12345"
HTTP_SESSION = "session-http-qa-001"
HTTP_USER = "507f191e810c19729de860ea"   # valid 24-hex ObjectId string


async def _seed_http_data():
    from bson import ObjectId
    db = get_db()
    import bcrypt
    hashed = bcrypt.hashpw(b"qapassword1", bcrypt.gensalt()).decode()
    await db.users.replace_one(
        {"_id": ObjectId(HTTP_USER)},
        {"_id": ObjectId(HTTP_USER), "email": "httpqa@example.com", "name": "HTTP QA",
         "hashed_password": hashed},
        upsert=True,
    )
    await db.sessions.replace_one(
        {"session_id": HTTP_SESSION},
        {
            "session_id": HTTP_SESSION,
            "user_id": HTTP_USER,   # stored as string, matches str(ObjectId(...))
            "repo_url": "https://github.com/octocat/hello-world",
            "status": "completed",
            "agents_completed": ["security", "architect", "onboarding", "mentor"],
            "agents_pending": [],
            "band_room_id": "room-http-001",
        },
        upsert=True,
    )
    await db.reports.replace_one(
        {"session_id": HTTP_SESSION},
        {
            "session_id": HTTP_SESSION,
            "repo_url": "https://github.com/octocat/hello-world",
            "band_room_id": "room-http-001",
            "adr": "# ADR-HTTP-001\n\nContent.",
            "contributing": "# Contributing\n\nWelcome!",
            "first_good_issues": [],
            "mentor_feedback": [],
            "security_findings": [],
            "human_review_flags": [],
            "socratic_score": {"questions": 0, "corrections": 0},
            "band_thread": [],
            "share_token": SHARE_TOKEN,
            "created_at": "2026-06-17T00:00:00+00:00",
        },
        upsert=True,
    )


asyncio.run(_seed_http_data())
auth_token = create_access_token(HTTP_USER)
auth_headers = {"Authorization": f"Bearer {auth_token}"}

print("\n── HTTP Layer ───────────────────────────────────────────────────────")

r = http.post(
    "/analyze",
    json={"repo_url": "not-a-github-url"},
    headers=auth_headers,
)
check("POST /analyze invalid URL → 422", r.status_code == 422,
      f"got {r.status_code}")

r = http.post(
    "/analyze",
    json={"repo_url": "https://github.com/octocat/hello-world"},
)
check("POST /analyze no auth → 401/403", r.status_code in (401, 403),
      f"got {r.status_code}")

r = http.get(f"/r/{SHARE_TOKEN}")
check("GET /r/{share_token} → 200 (public, no auth)",
      r.status_code == 200, f"got {r.status_code}")
check("Public report contains ADR field",
      "ADR-HTTP-001" in r.json().get("adr", ""))

r = http.get("/r/pub_nonexistent_token_999xyz")
check("GET /r/nonexistent → 404", r.status_code == 404,
      f"got {r.status_code}")


# ── Summary ───────────────────────────────────────────────────────────────────

print()
if errors:
    print(f"\033[31m{len(errors)} check(s) FAILED:\033[0m {', '.join(errors)}")
    sys.exit(1)
else:
    print(f"\033[32mAll 15 Phase 5 QA checks passed.\033[0m")
    sys.exit(0)
