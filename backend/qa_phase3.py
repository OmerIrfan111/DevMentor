"""
Phase 3 QA — Full Report UI backend
15 checks: report retrieval, public share, ZIP download, setup_walkthrough,
           share token format, report fields, 202 polling, ownership guard
No real DB or services needed.
Run from: cd backend && python qa_phase3.py
"""
import asyncio, sys, os, io, zipfile
from unittest.mock import patch

sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "qa-secret-phase3-only")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("AIMLAPI_KEY", "test-key-for-qa")
os.environ.setdefault("MODEL_ID", "deepseek/deepseek-v4-flash")
os.environ.setdefault("BAND_API_KEY", "test-band-key")

import mongomock_motor
import app.database as db_module
db_module.client = mongomock_motor.AsyncMongoMockClient()

from fastapi.testclient import TestClient
from bson import ObjectId
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


# ── Seed data ────────────────────────────────────────────────────────────────

USER_OID = "aabbccddeeff001122334455"
SESSION_A = "session-report-qa-001"   # completed
SESSION_B = "session-report-qa-002"   # still running (202)
SESSION_C = "session-report-qa-003"   # different owner (403/404)
SHARE_TOKEN = "pub_phase3_qa_token00"
OTHER_OID = "aabbccddeeff001122334400"

FULL_REPORT = {
    "session_id": SESSION_A,
    "repo_url": "https://github.com/octocat/hello-world",
    "band_room_id": "room-report-001",
    "adr": "# ADR-001\n\nContent here.",
    "contributing": "# Contributing\n\nWelcome!",
    "setup_walkthrough": "1. Clone repo\n2. Run app",
    "first_good_issues": [
        {"title": "Add tests", "description": "Write pytest",
         "acceptance_criteria": ["Tests pass"], "difficulty": "easy"},
        {"title": "Add CI", "description": "GitHub Actions",
         "acceptance_criteria": ["Green CI"], "difficulty": "medium"},
        {"title": "Add logging", "description": "Use stdlib logging",
         "acceptance_criteria": ["No bare prints"], "difficulty": "easy"},
    ],
    "mentor_feedback": [
        {"type": "question", "text": "Why hardcode secrets?"},
        {"type": "correction", "text": "Use env vars."},
    ],
    "security_findings": [
        {"severity": "HIGH", "file": "app.py", "line": 2,
         "issue": "Hardcoded secret", "recommendation": "Use os.getenv"},
    ],
    "human_review_flags": [],
    "socratic_score": {"questions": 1, "corrections": 1},
    "band_thread": [
        {"agent": "security", "message_id": "msg-001", "output_type": "SECURITY",
         "content": "## Security\nHardcoded secret.", "timestamp": ""},
    ],
    "share_token": SHARE_TOKEN,
    "created_at": "2026-06-17T00:00:00+00:00",
}


async def _seed():
    from bson import ObjectId
    db = get_db()
    import bcrypt
    hashed = bcrypt.hashpw(b"qapassword3", bcrypt.gensalt()).decode()
    await db.users.replace_one(
        {"_id": ObjectId(USER_OID)},
        {"_id": ObjectId(USER_OID), "email": "phase3qa@example.com",
         "name": "Phase3 QA", "hashed_password": hashed},
        upsert=True,
    )
    # Completed session owned by our user
    await db.sessions.replace_one(
        {"session_id": SESSION_A},
        {"session_id": SESSION_A, "user_id": USER_OID,
         "repo_url": FULL_REPORT["repo_url"], "status": "completed",
         "agents_completed": ["security", "architect", "onboarding", "mentor"],
         "agents_pending": [], "band_room_id": "room-report-001"},
        upsert=True,
    )
    # Report doc
    await db.reports.replace_one(
        {"session_id": SESSION_A}, FULL_REPORT, upsert=True,
    )
    # Still-running session
    await db.sessions.replace_one(
        {"session_id": SESSION_B},
        {"session_id": SESSION_B, "user_id": USER_OID,
         "repo_url": FULL_REPORT["repo_url"], "status": "running",
         "agents_completed": ["security"], "agents_pending": ["architect", "onboarding", "mentor"],
         "band_room_id": None},
        upsert=True,
    )
    # Session owned by another user
    await db.sessions.replace_one(
        {"session_id": SESSION_C},
        {"session_id": SESSION_C, "user_id": OTHER_OID,
         "repo_url": FULL_REPORT["repo_url"], "status": "completed",
         "agents_completed": ["security", "architect", "onboarding", "mentor"],
         "agents_pending": [], "band_room_id": None},
        upsert=True,
    )


asyncio.run(_seed())
token = create_access_token(USER_OID)
auth = {"Authorization": f"Bearer {token}"}


# ── Report retrieval ─────────────────────────────────────────────────────────

print("\n── Report Retrieval ─────────────────────────────────────────────────")

r = http.get(f"/reports/{SESSION_A}", headers=auth)
check("GET /reports/{id} → 200 for completed session",
      r.status_code == 200, f"got {r.status_code}")

body = r.json() if r.status_code == 200 else {}
check("Report contains adr field",
      "ADR-001" in body.get("adr", ""))
check("Report contains contributing field",
      "Contributing" in body.get("contributing", ""))
check("Report contains setup_walkthrough",
      bool(body.get("setup_walkthrough")))
check("Report contains 3 first_good_issues",
      len(body.get("first_good_issues", [])) == 3)
check("Report contains security_findings",
      len(body.get("security_findings", [])) == 1)
check("Report contains mentor_feedback",
      len(body.get("mentor_feedback", [])) == 2)
check("Report share_token starts with pub_",
      body.get("share_token", "").startswith("pub_"))
check("Report does not expose github_token",
      "github_token" not in body)


# ── Pipeline-not-complete polling ────────────────────────────────────────────

print("\n── Polling / Ownership ──────────────────────────────────────────────")

r = http.get(f"/reports/{SESSION_B}", headers=auth)
check("GET /reports/{id} → 202 while pipeline running",
      r.status_code == 202, f"got {r.status_code}")

r = http.get(f"/reports/{SESSION_C}", headers=auth)
check("GET /reports/{id} → 404 for another user's session",
      r.status_code == 404, f"got {r.status_code}")

r = http.get("/reports/nonexistent-session-xyz", headers=auth)
check("GET /reports/nonexistent → 404",
      r.status_code == 404, f"got {r.status_code}")


# ── Public share endpoint ────────────────────────────────────────────────────

print("\n── Public Share ─────────────────────────────────────────────────────")

r = http.get(f"/r/{SHARE_TOKEN}")
check("GET /r/{share_token} → 200 (no auth)",
      r.status_code == 200, f"got {r.status_code}")

pub = r.json() if r.status_code == 200 else {}
check("Public report has adr",
      "ADR-001" in pub.get("adr", ""))
check("Public report has share_token",
      pub.get("share_token") == SHARE_TOKEN)

r = http.get("/r/pub_nonexistent_xyz_000")
check("GET /r/nonexistent_token → 404",
      r.status_code == 404, f"got {r.status_code}")


# ── ZIP download ─────────────────────────────────────────────────────────────

print("\n── ZIP Download ─────────────────────────────────────────────────────")

r = http.get(f"/reports/{SESSION_A}/download", headers=auth)
check("GET /reports/{id}/download → 200",
      r.status_code == 200, f"got {r.status_code}")

if r.status_code == 200:
    buf = io.BytesIO(r.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
    check("ZIP contains ADR.md", "ADR.md" in names, f"got {names}")
    check("ZIP contains CONTRIBUTING.md", "CONTRIBUTING.md" in names, f"got {names}")
    check("ZIP contains SETUP.md", "SETUP.md" in names, f"got {names}")
    check("ZIP contains ISSUE_1.md", "ISSUE_1.md" in names, f"got {names}")
else:
    for lbl in ("ZIP contains ADR.md", "ZIP contains CONTRIBUTING.md",
                "ZIP contains SETUP.md", "ZIP contains ISSUE_1.md"):
        check(lbl, False, "download failed")


# ── Summary ───────────────────────────────────────────────────────────────────

print()
if errors:
    print(f"\033[31m{len(errors)} check(s) FAILED:\033[0m {', '.join(errors)}")
    sys.exit(1)
else:
    print(f"\033[32mAll 15 Phase 3 QA checks passed.\033[0m")
    sys.exit(0)
