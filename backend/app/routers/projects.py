"""Router for project management (type classification)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectOut, ProjectTypeUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[ProjectOut]:
    """List all non-archived projects."""
    result = await db.execute(
        select(Project)
        .where(Project.is_archived.is_(False))
        .order_by(Project.name)
    )
    projects = result.scalars().all()
    return [
        ProjectOut(
            id=p.id,
            name=p.name,
            identifier=p.identifier,
            project_type=p.project_type,
            is_archived=p.is_archived,
        )
        for p in projects
    ]


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project_type(
    project_id: int,
    payload: ProjectTypeUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    """Update a project's type classification."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    project.project_type = payload.project_type
    project.is_support = payload.project_type == "support"
    await db.commit()
    await db.refresh(project)

    return ProjectOut(
        id=project.id,
        name=project.name,
        identifier=project.identifier,
        project_type=project.project_type,
        is_archived=project.is_archived,
    )
