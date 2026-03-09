"""Service for syncing Plane project states into the local database.

Fetches states from /api/v1/workspaces/{slug}/projects/{pid}/states/
for each locally-known project, and upserts them keyed on plane_state_id.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.project import Project
from app.models.state import State
from app.services.plane_client import plane_get

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 30.0


async def sync_states(db: AsyncSession) -> dict[str, int]:
    """Sync all project states from Plane.

    Returns: {"created": int, "updated": int, "total": int}
    """
    base_url = settings.PLANE_BASE_URL.rstrip("/")
    slug = settings.PLANE_WORKSPACE_SLUG
    headers = {"X-API-Key": settings.PLANE_API_KEY}

    result = await db.execute(select(Project))
    projects = result.scalars().all()

    if not projects:
        logger.info("No projects found; skipping state sync.")
        return {"created": 0, "updated": 0, "total": 0}

    created_count = 0
    updated_count = 0

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        for project in projects:
            states_url = (
                f"{base_url}/api/v1/workspaces/{slug}"
                f"/projects/{project.plane_project_id}/states/"
            )

            logger.info(
                "Fetching states for project '%s' (%s)",
                project.name,
                project.plane_project_id,
            )

            try:
                resp = await plane_get(client, states_url, headers)
            except httpx.TimeoutException:
                logger.error(
                    "Timeout fetching states for project %s — skipping",
                    project.plane_project_id,
                )
                continue
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "HTTP %s fetching states for project %s: %s",
                    exc.response.status_code,
                    project.plane_project_id,
                    exc.response.text[:200],
                )
                continue

            payload = resp.json()
            states_data: list[dict[str, Any]] = (
                payload if isinstance(payload, list)
                else payload.get("results", [])
            )

            logger.info(
                "Fetched %d state(s) for project '%s'",
                len(states_data),
                project.name,
            )

            for state_data in states_data:
                plane_state_id = str(state_data.get("id", ""))
                if not plane_state_id:
                    continue

                name = state_data.get("name", "")
                group = state_data.get("group", "")
                color = state_data.get("color", None)

                existing_result = await db.execute(
                    select(State).where(State.plane_state_id == plane_state_id)
                )
                existing = existing_result.scalar_one_or_none()

                if existing is None:
                    db.add(State(
                        plane_state_id=plane_state_id,
                        project_id=project.id,
                        name=name,
                        group=group,
                        color=color,
                    ))
                    created_count += 1
                else:
                    existing.name = name
                    existing.group = group
                    existing.color = color
                    updated_count += 1

    await db.commit()

    total = created_count + updated_count
    logger.info(
        "sync_states completed: created=%d updated=%d total=%d",
        created_count,
        updated_count,
        total,
    )
    return {"created": created_count, "updated": updated_count, "total": total}
