import io
import zipfile
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from app.auth.router import get_current_user
from app.models.user import UserOut
from app.database import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    # Never expose tokens or secrets
    doc.pop("github_token", None)
    return doc


@router.get("/{session_id}")
async def get_report(
    session_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_db()
    # Verify ownership via session
    session = await db.sessions.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Report not found")
    if session.get("status") != "completed":
        raise HTTPException(status_code=202, detail="Pipeline not complete yet")

    report = await db.reports.find_one({"session_id": session_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return _clean(report)


@router.get("/{session_id}/download")
async def download_report(
    session_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_db()
    session = await db.sessions.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session or session.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Report not ready")

    report = await db.reports.find_one({"session_id": session_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("ADR.md", report.get("adr", ""))
        zf.writestr("CONTRIBUTING.md", report.get("contributing", ""))
        for i, issue in enumerate(report.get("first_good_issues", [])[:3], 1):
            content = f"# {issue.get('title', f'Issue {i}')}\n\n{issue.get('description', '')}\n\n## Acceptance Criteria\n"
            content += "\n".join(f"- {c}" for c in issue.get("acceptance_criteria", []))
            zf.writestr(f"ISSUE_{i}.md", content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=devmentor-{session_id[:8]}.zip"},
    )


# Public share endpoint (no auth)
public_router = APIRouter(prefix="/r", tags=["public"])


@public_router.get("/{share_token}")
async def get_public_report(share_token: str):
    db = get_db()
    report = await db.reports.find_one({"share_token": share_token})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _clean(report)
