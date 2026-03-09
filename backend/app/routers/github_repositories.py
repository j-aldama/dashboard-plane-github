"""Router for managing GitHub repositories (list + toggle active)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.github_repository import GitHubRepository
from app.schemas.github_repository import GitHubRepoOut, GitHubRepoUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["github-repos"])


@router.get("/github-repos", response_model=list[GitHubRepoOut])
async def list_github_repos(
    db: AsyncSession = Depends(get_db),
) -> list[GitHubRepoOut]:
    """Return all known GitHub repositories sorted by name."""
    result = await db.execute(
        select(GitHubRepository).order_by(GitHubRepository.repo_name)
    )
    repos = result.scalars().all()
    return [GitHubRepoOut.model_validate(r) for r in repos]


@router.patch("/github-repos/{repo_id}", response_model=GitHubRepoOut)
async def update_github_repo(
    repo_id: int,
    body: GitHubRepoUpdate,
    db: AsyncSession = Depends(get_db),
) -> GitHubRepoOut:
    """Toggle a repository's is_active status."""
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()

    if repo is None:
        raise HTTPException(status_code=404, detail="Repositorio no encontrado")

    repo.is_active = body.is_active
    await db.commit()
    await db.refresh(repo)

    return GitHubRepoOut.model_validate(repo)
