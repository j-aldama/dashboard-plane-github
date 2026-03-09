"""Tests for the per-person metrics endpoints.

Covers:
- GET /api/metrics/person/{user_id} — person Plane metrics
- GET /api/metrics/person/{user_id}/github — person GitHub metrics
- 404 on missing team member
- Empty data scenarios (zero counters, empty lists)
- Filter by project_id, cycle_id, date_from/date_to
- GitHub data: commits, PRs, weekly activity, recent PRs
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    create_cycle,
    create_github_commit,
    create_github_pr,
    create_project,
    create_team_member,
    create_work_item,
)


# ---------------------------------------------------------------------------
# GET /api/metrics/person/{user_id}
# ---------------------------------------------------------------------------


async def test_person_metrics_not_found(client: AsyncClient) -> None:
    """GET /api/metrics/person/999 returns 404 when member does not exist."""
    response = await client.get("/api/metrics/person/999")
    assert response.status_code == 404


async def test_person_metrics_empty_data(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id} returns zeroed counters for a member with no tasks."""
    member = await create_team_member(
        db_session,
        name="Empty Member",
        plane_user_id="uid-001",
        email="empty@test.com",
        github_username="emptymember",
    )

    response = await client.get(f"/api/metrics/person/{member.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["user_id"] == str(member.id)
    assert data["display_name"] == "Empty Member"
    assert data["email"] == "empty@test.com"
    assert data["github_username"] == "emptymember"
    assert data["completed_tasks"] == 0
    assert data["completed_points"] == 0
    assert data["active_tasks"] == 0
    assert data["overdue_tasks"] == 0
    assert data["bug_tasks"] == 0
    assert data["assigned_tasks"] == []


async def test_person_metrics_response_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id} returns all required top-level fields."""
    member = await create_team_member(db_session, plane_user_id="uid-001")

    response = await client.get(f"/api/metrics/person/{member.id}")
    assert response.status_code == 200

    data = response.json()
    required_fields = {
        "user_id",
        "display_name",
        "email",
        "github_username",
        "avatar_url",
        "completed_tasks",
        "completed_points",
        "active_tasks",
        "overdue_tasks",
        "bug_tasks",
        "assigned_tasks",
    }
    assert required_fields.issubset(data.keys())


async def test_person_metrics_with_assigned_tasks(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id} includes tasks assigned to the member."""
    member = await create_team_member(db_session, plane_user_id="uid-001")
    project = await create_project(db_session, plane_project_id="proj-001")

    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        title="Task One",
        assignee=member,
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-002",
        title="Task Two",
        assignee=member,
    )
    # Unassigned task — should not appear in this person's results
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-003",
        title="Unassigned Task",
    )

    response = await client.get(f"/api/metrics/person/{member.id}")
    assert response.status_code == 200

    data = response.json()
    titles = {t["title"] for t in data["assigned_tasks"]}
    assert "Task One" in titles
    assert "Task Two" in titles
    assert "Unassigned Task" not in titles


async def test_person_metrics_filter_by_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}?project_id=X scopes tasks to that project."""
    member = await create_team_member(db_session, plane_user_id="uid-001")
    p1 = await create_project(db_session, plane_project_id="proj-001", name="P1")
    p2 = await create_project(db_session, plane_project_id="proj-002", name="P2")

    await create_work_item(
        db_session, p1, plane_issue_id="issue-001", title="P1 Task", assignee=member
    )
    await create_work_item(
        db_session, p2, plane_issue_id="issue-002", title="P2 Task", assignee=member
    )

    response = await client.get(
        f"/api/metrics/person/{member.id}?project_id={p1.id}"
    )
    assert response.status_code == 200

    data = response.json()
    titles = [t["title"] for t in data["assigned_tasks"]]
    assert "P1 Task" in titles
    assert "P2 Task" not in titles


async def test_person_metrics_filter_by_cycle(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}?cycle_id=X scopes tasks to that cycle."""
    member = await create_team_member(db_session, plane_user_id="uid-001")
    project = await create_project(db_session, plane_project_id="proj-001")
    cycle = await create_cycle(
        db_session, project, plane_cycle_id="cycle-001", name="Sprint 1"
    )

    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        title="Cycle Task",
        assignee=member,
        cycle=cycle,
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-002",
        title="No Cycle Task",
        assignee=member,
    )

    response = await client.get(
        f"/api/metrics/person/{member.id}?cycle_id={cycle.id}"
    )
    assert response.status_code == 200

    data = response.json()
    titles = [t["title"] for t in data["assigned_tasks"]]
    assert "Cycle Task" in titles
    assert "No Cycle Task" not in titles


async def test_person_metrics_task_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Each task in assigned_tasks has the required fields."""
    member = await create_team_member(db_session, plane_user_id="uid-001")
    project = await create_project(
        db_session, plane_project_id="proj-001", name="My Project"
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        title="Feature Task",
        state="In Progress",
        estimate_points=5,
        assignee=member,
        is_bug=False,
    )

    response = await client.get(f"/api/metrics/person/{member.id}")
    assert response.status_code == 200

    tasks = response.json()["assigned_tasks"]
    assert len(tasks) == 1

    task = tasks[0]
    required = {"id", "title", "project", "state", "state_group", "points", "cycle", "is_bug"}
    assert required.issubset(task.keys())
    assert task["title"] == "Feature Task"
    assert task["project"] == "My Project"
    assert task["is_bug"] is False


# ---------------------------------------------------------------------------
# GET /api/metrics/person/{user_id}/github
# ---------------------------------------------------------------------------


async def test_person_github_not_found(client: AsyncClient) -> None:
    """GET /api/metrics/person/999/github returns 404 when member does not exist."""
    response = await client.get("/api/metrics/person/999/github")
    assert response.status_code == 404


async def test_person_github_empty_data(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github returns zeroed counters with no GitHub activity."""
    member = await create_team_member(
        db_session,
        plane_user_id="uid-001",
        github_username="someuser",
    )

    response = await client.get(f"/api/metrics/person/{member.id}/github")
    assert response.status_code == 200

    data = response.json()
    assert data["user_id"] == str(member.id)
    assert data["github_username"] == "someuser"
    assert data["commits"] == 0
    assert data["pull_requests"] == 0
    assert data["prs_merged"] == 0
    assert data["lines_added"] == 0
    assert data["lines_deleted"] == 0
    assert data["weekly_commits"] == []
    assert data["recent_prs"] == []


async def test_person_github_with_commits(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github counts commits and aggregates lines."""
    member = await create_team_member(
        db_session, plane_user_id="uid-001", github_username="devuser"
    )
    now = datetime.now(timezone.utc)

    await create_github_commit(
        db_session,
        member,
        sha="abc001",
        lines_added=100,
        lines_removed=20,
        committed_at=now,
    )
    await create_github_commit(
        db_session,
        member,
        sha="abc002",
        lines_added=50,
        lines_removed=10,
        committed_at=now - timedelta(days=1),
    )

    response = await client.get(f"/api/metrics/person/{member.id}/github")
    assert response.status_code == 200

    data = response.json()
    assert data["commits"] == 2
    assert data["lines_added"] == 150
    assert data["lines_deleted"] == 30


async def test_person_github_with_pull_requests(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github counts PRs and merged PRs."""
    member = await create_team_member(
        db_session, plane_user_id="uid-001", github_username="devuser"
    )
    now = datetime.now(timezone.utc)

    await create_github_pr(
        db_session,
        member,
        pr_number=1,
        title="feat: add feature",
        state="closed",
        merged_at=now,
    )
    await create_github_pr(
        db_session,
        member,
        pr_number=2,
        title="fix: small fix",
        state="open",
        merged_at=None,
    )

    response = await client.get(f"/api/metrics/person/{member.id}/github")
    assert response.status_code == 200

    data = response.json()
    assert data["pull_requests"] == 2
    assert data["prs_merged"] == 1


async def test_person_github_recent_prs_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github recent_prs have required fields."""
    member = await create_team_member(
        db_session, plane_user_id="uid-001", github_username="devuser"
    )
    now = datetime.now(timezone.utc)

    await create_github_pr(
        db_session,
        member,
        repo_name="my-repo",
        pr_number=42,
        title="feat: something",
        state="closed",
        merged_at=now,
    )

    response = await client.get(f"/api/metrics/person/{member.id}/github")
    assert response.status_code == 200

    prs = response.json()["recent_prs"]
    assert len(prs) == 1

    pr = prs[0]
    required = {"id", "title", "repo", "state", "merged_at", "created_at", "url"}
    assert required.issubset(pr.keys())
    assert pr["title"] == "feat: something"
    assert pr["repo"] == "my-repo"
    assert pr["state"] == "merged"


async def test_person_github_commits_scoped_to_member(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github only counts that member's commits."""
    m1 = await create_team_member(
        db_session, name="Alice", plane_user_id="uid-001", github_username="alice"
    )
    m2 = await create_team_member(
        db_session, name="Bob", plane_user_id="uid-002", github_username="bob"
    )
    now = datetime.now(timezone.utc)

    await create_github_commit(db_session, m1, sha="commit-a", committed_at=now)
    await create_github_commit(db_session, m1, sha="commit-b", committed_at=now)
    await create_github_commit(db_session, m2, sha="commit-c", committed_at=now)

    response = await client.get(f"/api/metrics/person/{m1.id}/github")
    assert response.status_code == 200
    assert response.json()["commits"] == 2


async def test_person_github_date_filter(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github?date_from=X&date_to=Y filters commits."""
    member = await create_team_member(
        db_session, plane_user_id="uid-001", github_username="devuser"
    )
    now = datetime.now(timezone.utc)

    # Commit within range
    await create_github_commit(
        db_session,
        member,
        sha="in-range",
        committed_at=now - timedelta(days=5),
    )
    # Commit outside range (90 days ago)
    await create_github_commit(
        db_session,
        member,
        sha="out-of-range",
        committed_at=now - timedelta(days=90),
    )

    date_from = (now - timedelta(days=10)).date().isoformat()
    date_to = now.date().isoformat()

    response = await client.get(
        f"/api/metrics/person/{member.id}/github"
        f"?date_from={date_from}&date_to={date_to}"
    )
    assert response.status_code == 200
    assert response.json()["commits"] == 1


async def test_person_github_response_shape(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/person/{id}/github response has all required top-level fields."""
    member = await create_team_member(db_session, plane_user_id="uid-001")

    response = await client.get(f"/api/metrics/person/{member.id}/github")
    assert response.status_code == 200

    data = response.json()
    required_fields = {
        "user_id",
        "github_username",
        "commits",
        "pull_requests",
        "prs_merged",
        "lines_added",
        "lines_deleted",
        "weekly_commits",
        "recent_prs",
    }
    assert required_fields.issubset(data.keys())
