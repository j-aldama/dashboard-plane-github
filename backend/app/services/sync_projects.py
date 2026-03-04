import logging
from datetime import date, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.cycle import Cycle
from app.models.project import Project
from app.services.plane_client import plane_get

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 30.0


def _parse_date(value: str | None) -> date | None:
    """Parse an ISO-8601 date string ('YYYY-MM-DD') into a Python date.

    Returns None for null, empty, or unparseable values.
    """
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        logger.warning("Could not parse date value: %r", value)
        return None


def _is_cycle_active(start_date: date | None, end_date: date | None) -> bool:
    """Return True if today falls within [start_date, end_date] (inclusive)."""
    today = date.today()
    if start_date is None or end_date is None:
        return False
    return start_date <= today <= end_date


async def _fetch_all_pages(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch all pages from a Plane paginated endpoint.

    Plane returns results inside a ``results`` key and provides a
    ``next_page_results`` boolean plus a ``next_cursor`` string for
    cursor-based pagination.  Pages are followed until ``next_page_results``
    is falsy or there is no next cursor.

    If the response body is a plain list (non-paginated), it is returned as-is.
    """
    results: list[dict[str, Any]] = []
    current_url: str | None = url

    while current_url:
        resp = await plane_get(client, current_url, headers)
        payload = resp.json()

        # Non-paginated response — plain list
        if isinstance(payload, list):
            results.extend(payload)
            break

        page_results = payload.get("results", [])
        results.extend(page_results)

        if payload.get("next_page_results") and payload.get("next_cursor"):
            cursor = payload["next_cursor"]
            sep = "&" if "?" in url else "?"
            current_url = f"{url}{sep}cursor={cursor}"
        else:
            current_url = None

    return results


async def _upsert_project(
    db: AsyncSession,
    plane_data: dict[str, Any],
) -> tuple[Project, bool]:
    """Upsert a project record by plane_project_id.

    Returns (project_instance, created) where *created* is True when a new
    row was inserted.
    """
    plane_project_id: str = str(plane_data["id"])
    result = await db.execute(
        select(Project).where(Project.plane_project_id == plane_project_id)
    )
    project = result.scalar_one_or_none()
    created = project is None

    if created:
        project = Project(plane_project_id=plane_project_id)
        db.add(project)
        logger.info(
            "Creating project: %s (%s)",
            plane_data.get("name"),
            plane_project_id,
        )
    else:
        logger.info(
            "Updating project: %s (%s)",
            plane_data.get("name"),
            plane_project_id,
        )

    project.name = plane_data.get("name") or ""
    project.identifier = plane_data.get("identifier")
    project.description = plane_data.get("description")
    project.is_archived = plane_data.get("archived_at") is not None
    project.is_support = bool(plane_data.get("intake_view"))

    # Only set project_type on new projects (from intake_view heuristic).
    # Existing projects keep their manually-set project_type.
    if created:
        project.project_type = "support" if project.is_support else "client"

    return project, created


async def _upsert_cycle(
    db: AsyncSession,
    plane_data: dict[str, Any],
    project: Project,
) -> tuple[Cycle, bool]:
    """Upsert a cycle record by plane_cycle_id.

    Returns (cycle_instance, created).
    """
    plane_cycle_id: str = str(plane_data["id"])
    result = await db.execute(
        select(Cycle).where(Cycle.plane_cycle_id == plane_cycle_id)
    )
    cycle = result.scalar_one_or_none()
    created = cycle is None

    start_date = _parse_date(plane_data.get("start_date"))
    end_date = _parse_date(plane_data.get("end_date"))
    is_active = _is_cycle_active(start_date, end_date)

    if created:
        cycle = Cycle(plane_cycle_id=plane_cycle_id)
        db.add(cycle)
        logger.info(
            "Creating cycle: %s (%s) — active=%s",
            plane_data.get("name"),
            plane_cycle_id,
            is_active,
        )
    else:
        logger.info(
            "Updating cycle: %s (%s) — active=%s",
            plane_data.get("name"),
            plane_cycle_id,
            is_active,
        )

    cycle.project_id = project.id
    cycle.name = plane_data.get("name") or ""
    cycle.start_date = start_date
    cycle.end_date = end_date
    cycle.is_active = is_active

    return cycle, created


async def sync_projects_and_cycles(db: AsyncSession) -> dict[str, int]:
    """Sync all projects and their cycles from the Plane workspace.

    Performs an upsert (insert-or-update) keyed on plane_project_id and
    plane_cycle_id respectively.  Handles paginated API responses.

    Returns a summary dict with counts of created/updated records:
        {
            "projects_created": int,
            "projects_updated": int,
            "cycles_created": int,
            "cycles_updated": int,
        }

    Raises:
        httpx.TimeoutException: when the Plane API does not respond within 30 s.
        httpx.HTTPStatusError: for non-2xx responses (e.g. 401, 429).
    """
    base_url = settings.PLANE_BASE_URL.rstrip("/")
    slug = settings.PLANE_WORKSPACE_SLUG
    headers = {"X-API-Key": settings.PLANE_API_KEY}

    projects_created = 0
    projects_updated = 0
    cycles_created = 0
    cycles_updated = 0

    projects_url = f"{base_url}/api/v1/workspaces/{slug}/projects/"

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        logger.info("Fetching projects from Plane workspace '%s'", slug)

        try:
            plane_projects = await _fetch_all_pages(client, projects_url, headers)
        except httpx.TimeoutException:
            logger.error(
                "Timeout while fetching projects from Plane (url=%s)", projects_url
            )
            raise
        except httpx.HTTPStatusError as exc:
            logger.error(
                "HTTP %s error fetching projects: %s",
                exc.response.status_code,
                exc.response.text[:200],
            )
            raise

        logger.info("Fetched %d project(s) from Plane", len(plane_projects))

        for plane_proj in plane_projects:
            project, created = await _upsert_project(db, plane_proj)
            # Flush to obtain the auto-generated primary key before FK use.
            await db.flush()

            if created:
                projects_created += 1
            else:
                projects_updated += 1

            plane_project_id = str(plane_proj["id"])
            cycles_url = (
                f"{base_url}/api/v1/workspaces/{slug}"
                f"/projects/{plane_project_id}/cycles/"
            )

            logger.info(
                "Fetching cycles for project '%s' (%s)",
                plane_proj.get("name"),
                plane_project_id,
            )

            try:
                plane_cycles = await _fetch_all_pages(client, cycles_url, headers)
            except httpx.TimeoutException:
                logger.error(
                    "Timeout fetching cycles for project %s — skipping",
                    plane_project_id,
                )
                continue
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "HTTP %s error fetching cycles for project %s: %s",
                    exc.response.status_code,
                    plane_project_id,
                    exc.response.text[:200],
                )
                continue

            logger.info(
                "Fetched %d cycle(s) for project '%s'",
                len(plane_cycles),
                plane_proj.get("name"),
            )

            for plane_cycle in plane_cycles:
                _, c_created = await _upsert_cycle(db, plane_cycle, project)
                if c_created:
                    cycles_created += 1
                else:
                    cycles_updated += 1

        await db.commit()

    summary: dict[str, int] = {
        "projects_created": projects_created,
        "projects_updated": projects_updated,
        "cycles_created": cycles_created,
        "cycles_updated": cycles_updated,
    }
    logger.info("Sync complete: %s", summary)
    return summary
