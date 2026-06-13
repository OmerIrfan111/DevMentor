from pydantic import BaseModel, HttpUrl
from typing import Literal
from datetime import datetime


class AnalysisRequest(BaseModel):
    repo_url: str
    github_token: str | None = None
    diff_mode: bool = False
    before_url: str | None = None
    after_url: str | None = None


class SessionStatus(BaseModel):
    session_id: str
    band_room_id: str | None = None
    status: Literal["queued", "running", "completed", "failed"]
    agents_completed: list[str] = []
    agents_pending: list[str] = []
    created_at: datetime | None = None
