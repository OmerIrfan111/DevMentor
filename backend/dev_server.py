"""
Local dev server — MongoDB Atlas + fakeredis + in-memory Band fallback.

Run from:  cd backend && python dev_server.py
Backend:   http://localhost:8000
Docs:      http://localhost:8000/docs
"""
import os
import uuid

# ── Patch env before any app import ─────────────────────────────────────────
os.environ.setdefault(
    "MONGODB_URI",
    "mongodb+srv://omerirfan502830_db_user:ey8f2Q7kfwhVMTrP@cluster0.4tdpsqo.mongodb.net/devmentor?retryWrites=true&w=majority",
)
os.environ.setdefault("DB_NAME",       "devmentor")
os.environ.setdefault("JWT_SECRET",    "323c8e9b31f1d708d878213576f2fc193bec50c290287968f371444833227098")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")
os.environ.setdefault("REDIS_URL",     "redis://localhost:6379")
os.environ.setdefault("BAND_API_KEY",  "band_u_1781392899_SNbyHFnIgUNy9X3oONZoXuyIi8GNgVch")
os.environ.setdefault("AIMLAPI_KEY",   "ace57b3b86319dc754137b1b1da87aed")
os.environ.setdefault("MODEL_ID",      "deepseek/deepseek-v4-flash")
os.environ.setdefault("GITHUB_TOKEN",  "")  # optional: paste your GitHub PAT here to raise rate limit from 60 to 5000 req/hr
os.environ.setdefault("CORS_ORIGINS",  "http://localhost:3000,http://localhost:3001,http://localhost:3002")

# ── In-memory Band fallback (replaces thenvoi_rest which can't connect) ──────
_band_rooms: dict[str, list[dict]] = {}

class _LocalBandClient:
    """Drop-in replacement for BandClient that stores messages in process memory."""

    def __init__(self):
        pass

    async def create_room(self, _session_id: str = "", _repo_url: str = "") -> str:
        room_id = f"local-room-{uuid.uuid4().hex[:8]}"
        _band_rooms[room_id] = []
        return room_id

    async def post_message(self, room_id: str, payload: dict) -> str:
        msg_id = f"local-msg-{uuid.uuid4().hex[:8]}"
        _band_rooms.setdefault(room_id, []).append({**payload, "_band_message_id": msg_id})
        return msg_id

    async def get_room_messages(self, room_id: str) -> list[dict]:
        return list(_band_rooms.get(room_id, []))

# Patch all three import sites before any agent/pipeline code loads
import app.band.client  as _band_client_mod
import app.band.session as _band_session_mod
import app.agents.base  as _agents_base_mod

_band_client_mod.BandClient  = _LocalBandClient  # type: ignore
_band_session_mod.BandClient = _LocalBandClient  # type: ignore
_agents_base_mod.BandClient  = _LocalBandClient  # type: ignore

# ── In-memory Redis via fakeredis ────────────────────────────────────────────
import fakeredis.aioredis as fakeredis_aio
import redis.asyncio as _real_aioredis

_fake_server = fakeredis_aio.FakeServer()

def _fake_from_url(url, **kwargs):
    return fakeredis_aio.FakeRedis(server=_fake_server, decode_responses=kwargs.get("decode_responses", False))

_real_aioredis.from_url = _fake_from_url

import app.orchestrator.pipeline  as _pipeline_mod
import app.orchestrator.cache     as _cache_mod
import app.routers.analyze        as _analyze_mod

_pipeline_mod.aioredis = type("_FakeAioredis", (), {"from_url": staticmethod(_fake_from_url)})()  # type: ignore
_cache_mod.aioredis    = type("_FakeAioredis", (), {"from_url": staticmethod(_fake_from_url)})()  # type: ignore
_analyze_mod.aioredis  = type("_FakeAioredis", (), {"from_url": staticmethod(_fake_from_url)})()  # type: ignore

# Also patch BandClient used directly inside pipeline.py
_pipeline_mod.BandClient = _LocalBandClient  # type: ignore

# ── Start uvicorn ─────────────────────────────────────────────────────────────
print("\n  DevMentor Band — local dev server")
print("  MongoDB : Atlas (cluster0.4tdpsqo.mongodb.net)")
print("  Redis   : in-memory (fakeredis)")
print("  Band    : in-memory fallback (Band cloud unreachable locally)")
print("  API     : http://localhost:8000")
print("  Docs    : http://localhost:8000/docs\n")

import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
