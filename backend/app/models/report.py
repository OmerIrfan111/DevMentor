from pydantic import BaseModel
from typing import Literal


class SecurityFinding(BaseModel):
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    file: str
    line: int | None = None
    issue: str
    recommendation: str


class MentorFeedback(BaseModel):
    type: Literal["question", "correction"]
    text: str


class FirstGoodIssue(BaseModel):
    title: str
    description: str
    acceptance_criteria: list[str]
    difficulty: Literal["easy", "medium", "hard"] = "easy"


class BandMessage(BaseModel):
    agent: str
    message_id: str
    output_type: str
    content: str
    timestamp: str


class SocraticScore(BaseModel):
    questions: int
    corrections: int


class Report(BaseModel):
    session_id: str
    repo_url: str
    band_room_id: str | None = None
    adr: str = ""
    contributing: str = ""
    first_good_issues: list[FirstGoodIssue] = []
    mentor_feedback: list[MentorFeedback] = []
    security_findings: list[SecurityFinding] = []
    band_thread: list[BandMessage] = []
    human_review_flags: list[dict] = []
    socratic_score: SocraticScore = SocraticScore(questions=0, corrections=0)
    share_token: str | None = None
