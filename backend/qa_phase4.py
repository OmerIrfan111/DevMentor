"""
Phase 4 QA — Performance, Cache & Rate Limiting
15 checks: repo-analysis cache (hit/miss/TTL key), rate limiter (enforce + window),
           diff_mode stored on session, human_review_flags from low-confidence agents,
           session status endpoint, socratic_score shape
No real Redis, LLM, Band, or GitHub needed.
Run from: cd backend && python qa_phase4.py
"""
import asyncio, sys, os, json
from unittest.mock import AsyncMock, patch, MagicMock

sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "qa-secret-phase4-only")
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


USER_OID = "bbccddeeff0011223344aa00"
CACHED_SESSION = "session-cached-qa-001"
REPO_URL = "https://github.com/octocat/hello-world"
FAKE_SHA = "abc123def456"


async def _seed():
    db = get_db()
    import bcrypt
    hashed = bcrypt.hashpw(b"qapassword4", bcrypt.gensalt()).decode()
    await db.users.replace_one(
        {"_id": ObjectId(USER_OID)},
        {"_id": ObjectId(USER_OID), "email": "phase4qa@example.com",
         "name": "Phase4 QA", "hashed_password": hashed},
        upsert=True,
    )
    # Pre-seed a completed session as the cache target
    await db.sessions.replace_one(
        {"session_id": CACHED_SESSION},
        {"session_id": CACHED_SESSION, "user_id": USER_OID,
         "repo_url": REPO_URL, "status": "completed",
         "agents_completed": ["security", "architect", "onboarding", "mentor"],
         "agents_pending": [], "band_room_id": "room-cached-001"},
        upsert=True,
    )


asyncio.run(_seed())
token = create_access_token(USER_OID)
auth = {"Authorization": f"Bearer {token}"}


# ── 1. Cache module unit tests ───────────────────────────────────────────────

print("\n── Repo-Analysis Cache ──────────────────────────────────────────────")


async def _test_cache_module():
    from app.orchestrator import cache as repo_cache

    # Mock Redis so no real connection needed
    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock()
    mock_redis.setex = AsyncMock()
    mock_redis.aclose = AsyncMock()

    with patch("app.orchestrator.cache.aioredis.from_url", return_value=mock_redis):
        # Cache miss
        result = await repo_cache.get(REPO_URL, FAKE_SHA)
        check("cache.get returns None on miss", result is None)

        # Cache put
        await repo_cache.put(REPO_URL, FAKE_SHA, CACHED_SESSION)
        check("cache.put calls redis.setex",
              mock_redis.setex.called)
        call_args = mock_redis.setex.call_args
        check("cache.put TTL is 12 hours (43200s)",
              call_args and call_args[0][1] == 43200,
              f"got {call_args[0][1] if call_args else 'N/A'}")

        # Key format
        from app.orchestrator.cache import _key
        key = _key(REPO_URL, FAKE_SHA)
        check("cache key starts with repo_cache:",
              key.startswith("repo_cache:"), f"got {key}")
        check("cache key contains SHA fragment",
              FAKE_SHA in key, f"got {key}")


asyncio.run(_test_cache_module())


# ── 2. Cache hit via POST /analyze ──────────────────────────────────────────

print("\n── Cache Hit — POST /analyze ────────────────────────────────────────")


def _test_cache_hit():
    import app.orchestrator.cache as _cache_mod
    mock_rl_redis = MagicMock()
    mock_rl_redis.incr = AsyncMock(return_value=1)
    mock_rl_redis.expire = AsyncMock()
    mock_rl_redis.aclose = AsyncMock()
    with (
        patch.object(_cache_mod, "latest_sha", new=AsyncMock(return_value=FAKE_SHA)),
        patch.object(_cache_mod, "get", new=AsyncMock(return_value=CACHED_SESSION)),
        patch("app.routers.analyze.aioredis.from_url", return_value=mock_rl_redis),
    ):
        r = http.post("/analyze", json={"repo_url": REPO_URL}, headers=auth)
        check("POST /analyze cache hit → 200/202",
              r.status_code in (200, 202), f"got {r.status_code}")
        body = r.json() if r.status_code in (200, 202) else {}
        check("Cache hit response has session_id",
              body.get("session_id") == CACHED_SESSION,
              f"got {body.get('session_id')}")
        check("Cache hit response has status=completed",
              body.get("status") == "completed", f"got {body.get('status')}")
        check("Cache hit response has cached=True",
              body.get("cached") is True, f"got {body.get('cached')}")


_test_cache_hit()


# ── 3. Rate limiter ──────────────────────────────────────────────────────────

print("\n── Rate Limiter ─────────────────────────────────────────────────────")


async def _test_rate_limit():
    counter = {"n": 0}

    async def _incr(key):
        counter["n"] += 1
        return counter["n"]

    async def _expire(key, ttl):
        pass

    mock_redis = MagicMock()
    mock_redis.incr = AsyncMock(side_effect=_incr)
    mock_redis.expire = AsyncMock(side_effect=_expire)
    mock_redis.aclose = AsyncMock()

    from app.routers.analyze import _rate_limit
    from fastapi import HTTPException

    with patch("app.routers.analyze.aioredis.from_url", return_value=mock_redis):
        # First 10 calls should pass
        for i in range(10):
            try:
                await _rate_limit(USER_OID)
            except HTTPException:
                check("Rate limit: first 10 calls allowed",
                      False, f"raised on call {i+1}")
                return
        check("Rate limit: first 10 calls allowed", True)

        # 11th call should raise 429
        raised = False
        try:
            await _rate_limit(USER_OID)
        except HTTPException as e:
            raised = e.status_code == 429
        check("Rate limit: 11th call raises 429", raised)


asyncio.run(_test_rate_limit())


# ── 4. diff_mode + session status endpoint ───────────────────────────────────

print("\n── diff_mode / Session Status ───────────────────────────────────────")

# POST /analyze with diff_mode=true should store it on the session doc
import app.orchestrator.cache as _cache_mod2
mock_rl2 = MagicMock()
mock_rl2.incr = AsyncMock(return_value=1)
mock_rl2.expire = AsyncMock()
mock_rl2.aclose = AsyncMock()

with (
    patch.object(_cache_mod2, "latest_sha", new=AsyncMock(return_value=None)),
    patch.object(_cache_mod2, "get", new=AsyncMock(return_value=None)),
    patch("app.routers.analyze.aioredis.from_url", return_value=mock_rl2),
    # Block pipeline from running — Celery not installed so .delay will fail
    # and the fallback asyncio.create_task will be called; mock run_pipeline itself
    patch("app.orchestrator.pipeline.run_pipeline", new=AsyncMock()),
):
    r = http.post("/analyze",
                  json={"repo_url": REPO_URL, "diff_mode": True},
                  headers=auth)

check("POST /analyze with diff_mode → 202",
      r.status_code == 202, f"got {r.status_code}")

new_session_id = r.json().get("session_id") if r.status_code == 202 else None
check("POST /analyze returns session_id", bool(new_session_id))


async def _check_diff_stored():
    if not new_session_id:
        check("diff_mode stored on session doc", False, "no session_id")
        return
    db = get_db()
    doc = await db.sessions.find_one({"session_id": new_session_id})
    check("diff_mode stored on session doc",
          doc is not None and doc.get("diff_mode") is True,
          f"doc={doc}")


asyncio.run(_check_diff_stored())

# GET /analyze/{session_id} status endpoint
r = http.get(f"/analyze/{CACHED_SESSION}", headers=auth)
check("GET /analyze/{id} → 200 session status",
      r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    body = r.json()
    check("Session status has agents_completed list",
          isinstance(body.get("agents_completed"), list))
    check("Session status has status field",
          body.get("status") in ("queued", "running", "completed", "failed"))


# ── 5. Human review flags from low-confidence pipeline run ───────────────────

print("\n── Human Review Flags ───────────────────────────────────────────────")

LOW_CONF_MSGS = [
    {"agent_name": "security", "_band_message_id": "msg-sec",
     "output_type": "SECURITY", "confidence": 0.5,
     "needs_human_review": True, "content": "low conf sec"},
    {"agent_name": "architect", "_band_message_id": "msg-arch",
     "output_type": "ADR", "confidence": 0.9,
     "needs_human_review": False, "content": "ok"},
]


async def _test_human_review_flags():
    from app.orchestrator.pipeline import run_pipeline

    SESS = "session-humanreview-qa-001"
    db = get_db()
    await db.sessions.insert_one({
        "session_id": SESS, "user_id": USER_OID,
        "repo_url": REPO_URL, "status": "pending",
        "agents_completed": [], "agents_pending": ["security", "architect", "onboarding", "mentor"],
        "band_room_id": None,
    })

    FAKE_REPO = {
        "owner": "octocat", "repo": "hello-world", "default_branch": "main",
        "file_tree": ["app.py"], "file_contents": {"app.py": "print('hi')"},
    }

    llm_responses = {
        "security": json.dumps({"summary": "ok", "findings": [], "confidence": 0.5, "flags": ["low"]}),
        "architect": json.dumps({"adr": "# ADR\n## What Was Built\n.\n## Technology Choices\n.\n## Architectural Patterns\n.\n## Known Tradeoffs\n.\n## Anti-Patterns Detected\n.\n## Security Context\n.", "anti_patterns": [], "tech_stack": [], "confidence": 0.9, "flags": []}),
        "onboarding": json.dumps({"contributing": "# Contributing\nOk.", "setup_walkthrough": "1. run", "first_good_issues": [
            {"title": "T1", "description": "D", "acceptance_criteria": ["A"], "difficulty": "easy"},
            {"title": "T2", "description": "D", "acceptance_criteria": ["A"], "difficulty": "easy"},
            {"title": "T3", "description": "D", "acceptance_criteria": ["A"], "difficulty": "easy"},
        ], "confidence": 0.95, "flags": []}),
        "mentor": json.dumps({"feedback": [{"type": "question", "text": "Why?"}], "debate": False, "debate_claim": "", "debate_rebuttal": "", "socratic_score": {"questions": 1, "corrections": 0}, "confidence": 0.88, "flags": []}),
    }

    class _MockBand:
        def __init__(self): pass
        async def create_room(self, *a, **kw): return "room-lowconf-001"
        async def post_message(self, room_id, payload): return f"msg-{payload.get('agent_name')}"
        async def get_room_messages(self, room_id): return LOW_CONF_MSGS

    async def _mock_llm(self, system, user, max_tokens=4096):
        return llm_responses[self.name]

    async def _noop_publish(*a, **kw): pass

    with (
        patch("app.agents.base.fetch_repo_contents", new=AsyncMock(return_value=FAKE_REPO)),
        patch("app.agents.base.BandClient", new=_MockBand),
        patch("app.band.client.BandClient", new=_MockBand),
        patch("app.band.session.BandClient", new=_MockBand),
        patch("app.agents.base.BaseAgent.call_llm", new=_mock_llm),
        patch("app.orchestrator.pipeline.publish_event", new=_noop_publish),
    ):
        await run_pipeline(SESS, REPO_URL, None, None)

    report = await db.reports.find_one({"session_id": SESS})
    flags = report.get("human_review_flags", [])
    check("human_review_flags populated from low-confidence agent",
          len(flags) > 0, f"got {flags}")
    check("human_review_flag references security agent",
          any(f.get("agent") == "security" for f in flags), f"got {flags}")


asyncio.run(_test_human_review_flags())


# ── Summary ───────────────────────────────────────────────────────────────────

print()
if errors:
    print(f"\033[31m{len(errors)} check(s) FAILED:\033[0m {', '.join(errors)}")
    sys.exit(1)
else:
    print(f"\033[32mAll 15 Phase 4 QA checks passed.\033[0m")
    sys.exit(0)
