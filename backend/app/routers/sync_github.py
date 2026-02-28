import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from app.database import get_db
from app.schemas.sync_github import SyncGitHubResponse
from app.services.sync_github import sync_github

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


@router.post("/sync/github", response_model=SyncGitHubResponse)
async def sync_github_endpoint(
    db: AsyncSession = Depends(get_db),
) -> SyncGitHubResponse:
    """Trigger a full sync of GitHub commits and pull requests.

    Iterates all repos in the configured org and fetches commits plus
    pull requests for every team member that has a github_username.
    Performs incremental sync based on the last synced commit date.
    """
    try:
        result = await sync_github(db)
    except httpx.TimeoutException:
        logger.error("GitHub API timed out during sync")
        raise HTTPException(
            status_code=504,
            detail="GitHub API timed out. Please retry later.",
        )
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.error("GitHub API returned HTTP %s during sync", status)
        if status == 401:
            raise HTTPException(
                status_code=502,
                detail="Invalid or missing GitHub token.",
            )
        if status == 403:
            raise HTTPException(
                status_code=502,
                detail="GitHub API access forbidden. Check token permissions.",
            )
        if status == 429:
            raise HTTPException(
                status_code=502,
                detail="GitHub API rate limit exceeded. Please retry later.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"GitHub API error: HTTP {status}.",
        )

    return SyncGitHubResponse(**result)
