"""Router for team member management (list + update GitHub link)."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.team_member import TeamMember
from app.schemas.team_members import GitHubOrgMemberOut, TeamMemberOut, TeamMemberUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["team-members"])


@router.get("/team-members", response_model=list[TeamMemberOut])
async def list_team_members(
    db: AsyncSession = Depends(get_db),
) -> list[TeamMemberOut]:
    """Return all team members sorted by name."""
    result = await db.execute(
        select(TeamMember).order_by(TeamMember.name)
    )
    members = result.scalars().all()
    return [TeamMemberOut.model_validate(m) for m in members]


@router.patch("/team-members/{member_id}", response_model=TeamMemberOut)
async def update_team_member(
    member_id: int,
    body: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    """Update a team member's GitHub username."""
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    # Update github_username if provided
    if body.github_username is not None:
        github_username = body.github_username
        if github_username == "":
            github_username = None
        member.github_username = github_username

    # Update is_active if provided
    if body.is_active is not None:
        member.is_active = body.is_active

    await db.commit()
    await db.refresh(member)

    return TeamMemberOut.model_validate(member)


@router.get("/github-org-members", response_model=list[GitHubOrgMemberOut])
async def list_github_org_members() -> list[GitHubOrgMemberOut]:
    """Fetch members of the configured GitHub org for linking purposes."""
    if not settings.GITHUB_TOKEN or not settings.GITHUB_ORG:
        return []

    headers = {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }

    members: list[GitHubOrgMemberOut] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            url: str | None = (
                f"https://api.github.com/orgs/{settings.GITHUB_ORG}/members"
                f"?per_page=100"
            )
            while url:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    logger.warning(
                        "Failed to fetch GitHub org members: HTTP %d",
                        resp.status_code,
                    )
                    break

                for m in resp.json():
                    members.append(
                        GitHubOrgMemberOut(
                            login=m.get("login", ""),
                            avatar_url=m.get("avatar_url"),
                        )
                    )

                # Parse Link header for next page
                link = resp.headers.get("Link", "")
                url = None
                for part in link.split(","):
                    if 'rel="next"' in part:
                        url = part[part.index("<") + 1 : part.index(">")]

    except httpx.HTTPError:
        logger.exception("Error fetching GitHub org members")

    return sorted(members, key=lambda m: m.login.lower())
