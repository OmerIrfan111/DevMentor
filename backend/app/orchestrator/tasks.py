import asyncio
from celery import Celery
from app.config import settings

celery_app = Celery(
    "devmentor",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
)


@celery_app.task(name="run_pipeline", bind=True, max_retries=0)
def run_pipeline_task(
    self,
    session_id: str,
    repo_url: str,
    github_token: str | None,
    latest_sha: str | None = None,
):
    """Celery task that runs the full 4-agent pipeline."""
    from app.database import connect_db
    from app.orchestrator.pipeline import run_pipeline

    async def _run():
        await connect_db()
        await run_pipeline(session_id, repo_url, github_token, latest_sha)

    asyncio.run(_run())
