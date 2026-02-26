"""
GitHub API router — stub for EXEC-001.

Full implementation is delivered in EXEC-003.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/github", tags=["github"])


@router.get("/ping", summary="GitHub router ping")
async def github_ping() -> dict:
    return {"message": "GitHub router ready"}
