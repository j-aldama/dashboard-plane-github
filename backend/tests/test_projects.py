"""Tests for the project management endpoints.

Covers:
- GET /api/projects — list non-archived projects
- PATCH /api/projects/{id} — update project_type
- 404 on missing project
- Validation of project_type enum (only client/support/internal)
- Archived projects excluded from listing
- is_support flag set automatically based on project_type
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_project


# ---------------------------------------------------------------------------
# GET /api/projects
# ---------------------------------------------------------------------------


async def test_list_projects_empty(client: AsyncClient) -> None:
    """GET /api/projects returns empty list when no projects exist."""
    response = await client.get("/api/projects")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_projects_returns_all_non_archived(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/projects returns only non-archived projects sorted by name."""
    await create_project(
        db_session,
        plane_project_id="proj-001",
        name="Backend",
        identifier="BE",
        project_type="client",
    )
    await create_project(
        db_session,
        plane_project_id="proj-002",
        name="Alpha",
        identifier="AL",
        project_type="internal",
    )

    response = await client.get("/api/projects")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    # Sorted by name: Alpha first, then Backend
    assert data[0]["name"] == "Alpha"
    assert data[1]["name"] == "Backend"


async def test_list_projects_excludes_archived(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/projects does not return projects where is_archived is True."""
    # Non-archived
    await create_project(
        db_session,
        plane_project_id="proj-001",
        name="Active Project",
    )
    # Archived — created directly to bypass factory default
    from app.models.project import Project

    archived = Project(
        plane_project_id="proj-archived",
        name="Old Project",
        identifier="OLD",
        project_type="client",
        is_archived=True,
    )
    db_session.add(archived)
    await db_session.commit()

    response = await client.get("/api/projects")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Active Project"


async def test_list_projects_response_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/projects each item has the expected fields."""
    await create_project(
        db_session,
        plane_project_id="proj-001",
        name="My Project",
        identifier="MP",
        project_type="client",
    )

    response = await client.get("/api/projects")
    assert response.status_code == 200

    item = response.json()[0]
    assert "id" in item
    assert item["name"] == "My Project"
    assert item["identifier"] == "MP"
    assert item["project_type"] == "client"
    assert item["is_archived"] is False


# ---------------------------------------------------------------------------
# PATCH /api/projects/{id}
# ---------------------------------------------------------------------------


async def test_update_project_type_to_support(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets project_type to 'support' and sets is_support=True."""
    project = await create_project(
        db_session,
        plane_project_id="proj-001",
        name="My Project",
        project_type="client",
    )

    response = await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "support"},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["project_type"] == "support"
    assert data["id"] == project.id
    assert data["name"] == "My Project"


async def test_update_project_type_to_client(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets project_type to 'client'."""
    project = await create_project(
        db_session,
        plane_project_id="proj-001",
        name="My Project",
        project_type="support",
        is_support=True,
    )

    response = await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "client"},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["project_type"] == "client"


async def test_update_project_type_to_internal(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH sets project_type to 'internal'."""
    project = await create_project(
        db_session,
        plane_project_id="proj-001",
        name="Internal Tool",
        project_type="client",
    )

    response = await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "internal"},
    )
    assert response.status_code == 200
    assert response.json()["project_type"] == "internal"


async def test_update_project_type_not_found(client: AsyncClient) -> None:
    """PATCH on a non-existent project returns 404."""
    response = await client.patch(
        "/api/projects/999",
        json={"project_type": "client"},
    )
    assert response.status_code == 404


async def test_update_project_type_invalid_value(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH rejects project_type values outside the allowed enum."""
    project = await create_project(db_session, plane_project_id="proj-001")

    response = await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "unknown"},
    )
    assert response.status_code == 422


async def test_update_project_type_missing_body(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH without a body returns 422."""
    project = await create_project(db_session, plane_project_id="proj-001")

    response = await client.patch(f"/api/projects/{project.id}", json={})
    assert response.status_code == 422


async def test_update_project_type_support_sets_is_support_flag(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """PATCH to 'support' sets is_support=True; changing away from 'support' sets it False."""
    project = await create_project(
        db_session,
        plane_project_id="proj-001",
        name="Test",
        project_type="client",
    )

    # Set to support
    await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "support"},
    )

    # Verify in DB
    await db_session.refresh(project)
    assert project.is_support is True

    # Change back to client
    await client.patch(
        f"/api/projects/{project.id}",
        json={"project_type": "client"},
    )
    await db_session.refresh(project)
    assert project.is_support is False
