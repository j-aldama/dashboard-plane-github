"""Router for blocked tasks — issues with a 'bloqueada' label."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, cast, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.project import Project
from app.models.team_member import TeamMember
from app.models.work_item import WorkItem
from app.services.plane_client import plane_get

logger = logging.getLogger(__name__)

router = APIRouter(tags=["blocked-tasks"])


class BlockedTask(BaseModel):
    id: int
    title: str
    project_name: str
    project_identifier: str | None
    assignee_name: str | None
    state: str | None
    priority: str | None
    labels: list[str]
    plane_issue_id: str


class BlockedTasksResponse(BaseModel):
    count: int
    tasks: list[BlockedTask]


class IssueComment(BaseModel):
    actor_name: str
    body: str
    created_at: str


class IssueCommentsResponse(BaseModel):
    comments: list[IssueComment]


@router.get("/blocked-tasks")
async def get_blocked_tasks(
    db: AsyncSession = Depends(get_db),
) -> BlockedTasksResponse:
    """Return all active work items that have a 'bloqueada' label."""

    # Query work items where label_names (JSON array) contains "bloqueada"
    # Cast JSON to text and check case-insensitively
    stmt = (
        select(
            WorkItem.id,
            WorkItem.title,
            WorkItem.state,
            WorkItem.priority,
            WorkItem.label_names,
            WorkItem.plane_issue_id,
            Project.name.label("project_name"),
            Project.identifier.label("project_identifier"),
            TeamMember.name.label("assignee_name"),
        )
        .join(Project, WorkItem.project_id == Project.id)
        .outerjoin(TeamMember, WorkItem.assignee_id == TeamMember.id)
        .where(
            and_(
                cast(WorkItem.label_names, String).ilike("%bloqueada%"),
                # Only active items (not completed/cancelled)
                WorkItem.state_group.notin_(("completed", "cancelled")),
            )
        )
        .order_by(Project.name, WorkItem.id.desc())
    )

    rows = (await db.execute(stmt)).all()

    tasks = [
        BlockedTask(
            id=r.id,
            title=r.title,
            project_name=r.project_name,
            project_identifier=r.project_identifier,
            assignee_name=r.assignee_name,
            state=r.state,
            priority=r.priority,
            labels=r.label_names if isinstance(r.label_names, list) else [],
            plane_issue_id=r.plane_issue_id,
        )
        for r in rows
    ]

    return BlockedTasksResponse(count=len(tasks), tasks=tasks)


@router.get("/work-items/{work_item_id}/comments")
async def get_work_item_comments(
    work_item_id: int,
    db: AsyncSession = Depends(get_db),
) -> IssueCommentsResponse:
    """Fetch comments for a work item from the Plane API."""

    # Look up the work item and its project
    stmt = (
        select(
            WorkItem.plane_issue_id,
            Project.plane_project_id,
        )
        .join(Project, WorkItem.project_id == Project.id)
        .where(WorkItem.id == work_item_id)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return IssueCommentsResponse(comments=[])

    plane_issue_id = row.plane_issue_id
    plane_project_id = row.plane_project_id

    # Fetch comments from Plane API
    base_url = settings.PLANE_BASE_URL.rstrip("/")
    slug = settings.PLANE_WORKSPACE_SLUG
    url = (
        f"{base_url}/api/v1/workspaces/{slug}/projects/{plane_project_id}"
        f"/issues/{plane_issue_id}/activities/"
    )
    headers = {
        "X-API-Key": settings.PLANE_API_KEY,
        "Content-Type": "application/json",
    }

    comments: list[IssueComment] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await plane_get(client, url, headers)
            data = resp.json()

        results = data.get("results", data) if isinstance(data, dict) else data
        if not isinstance(results, list):
            results = []

        for activity in results:
            # Activities with comment field are comments
            comment_text = activity.get("comment", "")
            if not comment_text:
                continue

            actor = activity.get("actor_detail", {})
            actor_name = (
                actor.get("display_name")
                or actor.get("first_name", "")
                or "Desconocido"
            )
            created_at = activity.get("created_at", "")

            comments.append(
                IssueComment(
                    actor_name=actor_name,
                    body=comment_text,
                    created_at=created_at,
                )
            )
    except Exception:
        logger.error(
            "Failed to fetch comments for work_item %d",
            work_item_id,
            exc_info=True,
        )

    return IssueCommentsResponse(comments=comments)
