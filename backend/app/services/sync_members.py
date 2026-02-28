from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.team_member import TeamMember

logger = logging.getLogger(__name__)

_PLANE_MEMBERS_URL_TEMPLATE = (
    "{base_url}/api/v1/workspaces/{workspace_slug}/members/"
)


async def sync_members(db: AsyncSession) -> dict:
    """Sync team members from Plane API into the local database.

    Returns a dict with keys: created, updated, total.

    Raises HTTPException for recoverable API errors (401, 429, 5xx, timeout).
    """
    url = _PLANE_MEMBERS_URL_TEMPLATE.format(
        base_url=settings.PLANE_BASE_URL.rstrip("/"),
        workspace_slug=settings.PLANE_WORKSPACE_SLUG,
    )
    headers = {"X-API-Key": settings.PLANE_API_KEY}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.TimeoutException as exc:
        logger.error("Plane API request timed out: %s", exc)
        raise HTTPException(
            status_code=504,
            detail="Plane API request timed out",
        ) from exc
    except httpx.RequestError as exc:
        logger.error("Plane API connection error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Plane API",
        ) from exc

    if response.status_code == 401:
        logger.error("Plane API returned 401 — invalid or missing API key")
        raise HTTPException(
            status_code=502,
            detail="Plane API authentication failed",
        )

    if response.status_code == 429:
        logger.warning("Plane API returned 429 — rate limit exceeded")
        raise HTTPException(
            status_code=429,
            detail="Plane API rate limit exceeded, retry later",
        )

    if response.status_code >= 500:
        logger.error(
            "Plane API server error: status=%d body=%s",
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Plane API server error (status {response.status_code})",
        )

    if not response.is_success:
        logger.error(
            "Plane API unexpected status: %d body=%s",
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Plane API returned unexpected status {response.status_code}",
        )

    payload = response.json()

    # Plane returns either a list directly or {"results": [...]}
    if isinstance(payload, list):
        members_data = payload
    else:
        members_data = payload.get("results", [])

    created_count = 0
    updated_count = 0

    for raw in members_data:
        member_obj = raw.get("member", raw)
        plane_user_id: str | None = member_obj.get("id")

        if not plane_user_id:
            logger.warning("Skipping member entry with no id: %s", raw)
            continue

        name: str = member_obj.get("display_name") or member_obj.get("email", "")
        email: str | None = member_obj.get("email") or None
        avatar_url: str | None = member_obj.get("avatar") or None

        result = await db.execute(
            select(TeamMember).where(TeamMember.plane_user_id == plane_user_id)
        )
        existing: TeamMember | None = result.scalar_one_or_none()

        if existing is None:
            new_member = TeamMember(
                name=name,
                email=email,
                plane_user_id=plane_user_id,
                avatar_url=avatar_url,
            )
            db.add(new_member)
            created_count += 1
        else:
            existing.name = name
            existing.email = email
            existing.avatar_url = avatar_url
            updated_count += 1

    await db.commit()

    total = created_count + updated_count
    logger.info(
        "sync_members completed: created=%d updated=%d total=%d",
        created_count,
        updated_count,
        total,
    )

    return {"created": created_count, "updated": updated_count, "total": total}
