from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.cycle import Cycle
from app.models.project import Project
from app.models.team_member import TeamMember
from app.models.work_item import WorkItem

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 30.0

COMPLETED_STATES = frozenset({"Done", "Cancelled", "done", "cancelled"})

BUG_LABEL_KEYWORDS = frozenset({"bug"})
CLIENT_BLOCKED_LABEL_KEYWORDS = frozenset({"cliente", "client"})


async def _fetch_all_issues(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch all issues from a Plane project endpoint with pagination.

    Plane uses cursor-based pagination: ``next_page_results`` (bool) plus
    ``next_cursor`` (str).  If the response is a plain list the endpoint
    is not paginated and the list is returned directly.
    """
    all_issues: list[dict[str, Any]] = []
    current_url: str | None = url

    while current_url:
        resp = await client.get(current_url, headers=headers)
        resp.raise_for_status()
        payload = resp.json()

        if isinstance(payload, list):
            all_issues.extend(payload)
            break

        page_results = payload.get("results", [])
        all_issues.extend(page_results)

        if payload.get("next_page_results") and payload.get("next_cursor"):
            cursor = payload["next_cursor"]
            sep = "&" if "?" in url else "?"
            current_url = f"{url}{sep}cursor={cursor}"
        else:
            current_url = None

    return all_issues


def _extract_labels(item: dict[str, Any]) -> list[str]:
    """Extract label name strings from an issue payload.

    Plane may provide labels as ``label_detail`` (list of dicts with a
    ``name`` key) or as ``labels`` (list of strings or dicts).
    """
    labels: list[str] = []
    raw = item.get("label_detail", item.get("labels", []))
    if not isinstance(raw, list):
        return labels

    for entry in raw:
        if isinstance(entry, dict):
            name = entry.get("name", "")
            if name:
                labels.append(name)
        elif isinstance(entry, str) and entry:
            labels.append(entry)

    return labels


def _has_label_match(labels: list[str], keywords: frozenset[str]) -> bool:
    """Return True if any label contains one of the given keywords (case-insensitive)."""
    for label in labels:
        lower = label.lower()
        for kw in keywords:
            if kw in lower:
                return True
    return False


def _extract_state_name(item: dict[str, Any]) -> str:
    """Extract the human-readable state name from an issue payload."""
    state_detail = item.get("state_detail")
    if isinstance(state_detail, dict):
        return state_detail.get("name", "")

    state = item.get("state")
    if isinstance(state, str):
        return state

    return ""


def _parse_completed_at(item: dict[str, Any], state_name: str) -> datetime | None:
    """Calculate completed_at for issues in a completed state.

    Returns None if the state is not a completed state.  If the API
    provides a ``completed_at`` timestamp it is parsed; otherwise the
    current UTC time is used as a fallback.
    """
    if state_name not in COMPLETED_STATES:
        return None

    raw = item.get("completed_at")
    if raw:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            logger.warning("Could not parse completed_at value: %r", raw)

    return datetime.now(timezone.utc)


def _resolve_assignee(
    item: dict[str, Any],
    member_lookup: dict[str, int],
) -> int | None:
    """Resolve the first assignee UUID to a local team_member.id."""
    assignees = item.get("assignees")
    if not isinstance(assignees, list) or not assignees:
        return None

    plane_user_id = str(assignees[0])
    return member_lookup.get(plane_user_id)


def _resolve_cycle(
    item: dict[str, Any],
    cycle_lookup: dict[str, int],
) -> int | None:
    """Resolve the issue's cycle reference to a local cycle.id."""
    issue_cycle = item.get("issue_cycle", item.get("cycle_id"))
    if not issue_cycle:
        return None

    if isinstance(issue_cycle, dict):
        plane_cid = str(issue_cycle.get("cycle_id", issue_cycle.get("id", "")))
    else:
        plane_cid = str(issue_cycle)

    if not plane_cid:
        return None

    return cycle_lookup.get(plane_cid)


async def _build_member_lookup(db: AsyncSession) -> dict[str, int]:
    """Build plane_user_id -> team_member.id mapping."""
    result = await db.execute(select(TeamMember))
    members = result.scalars().all()
    return {m.plane_user_id: m.id for m in members}


async def _build_cycle_lookup(db: AsyncSession) -> dict[str, int]:
    """Build plane_cycle_id -> cycle.id mapping."""
    result = await db.execute(select(Cycle))
    cycles = result.scalars().all()
    return {c.plane_cycle_id: c.id for c in cycles}


async def _upsert_work_item(
    db: AsyncSession,
    item: dict[str, Any],
    project: Project,
    member_lookup: dict[str, int],
    cycle_lookup: dict[str, int],
) -> bool:
    """Upsert a single work item.  Returns True if a new row was created."""
    plane_issue_id = str(item.get("id", ""))
    if not plane_issue_id:
        logger.warning("Skipping issue with no id in project %s", project.name)
        return False

    labels = _extract_labels(item)
    is_bug = _has_label_match(labels, BUG_LABEL_KEYWORDS)
    is_client_blocked = _has_label_match(labels, CLIENT_BLOCKED_LABEL_KEYWORDS)
    state_name = _extract_state_name(item)
    completed_at = _parse_completed_at(item, state_name)
    assignee_id = _resolve_assignee(item, member_lookup)
    cycle_id = _resolve_cycle(item, cycle_lookup)
    title = item.get("name", item.get("title", ""))
    raw_priority = item.get("priority")
    priority = str(raw_priority) if raw_priority is not None else None
    estimate_points = item.get("estimate_point")
    label_names = labels if labels else None

    result = await db.execute(
        select(WorkItem).where(WorkItem.plane_issue_id == plane_issue_id)
    )
    work_item = result.scalar_one_or_none()
    created = work_item is None

    if created:
        work_item = WorkItem(
            project_id=project.id,
            plane_issue_id=plane_issue_id,
        )
        db.add(work_item)

    work_item.title = title
    work_item.state = state_name
    work_item.priority = priority
    work_item.estimate_points = estimate_points
    work_item.label_names = label_names
    work_item.is_bug = is_bug
    work_item.is_client_blocked = is_client_blocked
    work_item.assignee_id = assignee_id
    work_item.cycle_id = cycle_id
    work_item.completed_at = completed_at

    return created


async def sync_work_items(db: AsyncSession) -> dict[str, int]:
    """Sync all work items from all projects in the Plane workspace.

    Iterates over every locally-known project, fetches its issues from
    Plane (with full pagination), and upserts each one keyed on
    ``plane_issue_id``.

    Returns a summary dict: ``{"created": int, "updated": int, "total": int}``.

    Raises:
        httpx.TimeoutException: when the Plane API does not respond in time.
        httpx.HTTPStatusError: for non-2xx responses (401, 429, 5xx, etc.).
    """
    base_url = settings.PLANE_BASE_URL.rstrip("/")
    slug = settings.PLANE_WORKSPACE_SLUG
    headers = {"X-API-Key": settings.PLANE_API_KEY}

    result = await db.execute(select(Project))
    projects = result.scalars().all()

    if not projects:
        logger.info("No projects found in the local database; nothing to sync.")
        return {"created": 0, "updated": 0, "total": 0}

    member_lookup = await _build_member_lookup(db)
    cycle_lookup = await _build_cycle_lookup(db)

    created_count = 0
    updated_count = 0

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        for project in projects:
            issues_url = (
                f"{base_url}/api/v1/workspaces/{slug}"
                f"/projects/{project.plane_project_id}/issues/"
            )

            logger.info(
                "Fetching work items for project '%s' (%s)",
                project.name,
                project.plane_project_id,
            )

            try:
                items = await _fetch_all_issues(client, issues_url, headers)
            except httpx.TimeoutException:
                logger.error(
                    "Timeout fetching issues for project %s — skipping",
                    project.plane_project_id,
                )
                continue
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "HTTP %s error fetching issues for project %s: %s",
                    exc.response.status_code,
                    project.plane_project_id,
                    exc.response.text[:200],
                )
                continue

            logger.info(
                "Fetched %d issue(s) for project '%s'",
                len(items),
                project.name,
            )

            for item in items:
                try:
                    was_created = await _upsert_work_item(
                        db, item, project, member_lookup, cycle_lookup
                    )
                    if was_created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception:
                    plane_id = item.get("id", "unknown")
                    logger.exception(
                        "Error upserting work item %s in project %s",
                        plane_id,
                        project.name,
                    )
                    continue

    await db.commit()

    total = created_count + updated_count
    logger.info(
        "sync_work_items completed: created=%d updated=%d total=%d",
        created_count,
        updated_count,
        total,
    )
    return {"created": created_count, "updated": updated_count, "total": total}
