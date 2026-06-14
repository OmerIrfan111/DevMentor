"""
Redis-backed repo-analysis cache.

Cache key: repo_cache:{sha256(repo_url)[:16]}:{commit_sha[:12]}
TTL: 12 hours

Flow:
  1. start_analysis fetches latest_sha via GitHub API
  2. Checks cache.get() — on hit, returns existing session_id immediately
  3. On cache miss, pipeline runs normally
  4. pipeline.py calls cache.put() after report is persisted
"""
import re
import hashlib
import httpx
import redis.asyncio as aioredis
from app.config import settings

_CACHE_TTL = 43200  # 12 hours
_GH_PATH_RE = re.compile(r"github\.com/([^/\s?#]+/[^/\s?#]+)")


def _key(repo_url: str, sha: str) -> str:
    h = hashlib.sha256(repo_url.lower().encode()).hexdigest()[:16]
    return f"repo_cache:{h}:{sha}"


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def latest_sha(repo_url: str, github_token: str | None) -> str | None:
    """Return the HEAD commit SHA (first 12 chars) for a GitHub repo, or None on failure."""
    m = _GH_PATH_RE.search(repo_url)
    if not m:
        return None
    path = m.group(1).rstrip("/")
    headers: dict[str, str] = {"Accept": "application/vnd.github.v3+json"}
    if github_token:
        headers["Authorization"] = f"token {github_token}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{path}/commits",
                params={"per_page": 1},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data[0]["sha"][:12] if data else None
    except Exception:
        pass
    return None


async def get(repo_url: str, sha: str) -> str | None:
    """Return cached session_id for this repo+sha, or None."""
    r = _redis()
    try:
        return await r.get(_key(repo_url, sha))
    finally:
        await r.aclose()


async def put(repo_url: str, sha: str, session_id: str) -> None:
    """Cache session_id → expires after CACHE_TTL seconds."""
    r = _redis()
    try:
        await r.setex(_key(repo_url, sha), _CACHE_TTL, session_id)
    finally:
        await r.aclose()
