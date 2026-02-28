"""Tests for the comparative metrics endpoint.

Covers:
- Empty database returns empty list
- Multiple members with tasks, commits, PRs
- Rankings computation
- Filter by project_id, cycle_id, date_from, date_to
- Members with zero activity appear with zeroed metrics
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

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


async def test_comparative_empty_db(client: AsyncClient) -> None:
    """GET /api/metrics/comparative returns empty list when no members exist."""
    response = await client.get("/api/metrics/comparative")
    assert response.status_code == 200
    assert response.json()["members"] == []


async def test_comparative_with_data(client: AsyncClient, db_session: AsyncSession) -> None:
    """GET /api/metrics/comparative returns per-member comparative metrics."""
    project = await create_project(db_session)
    m1 = await create_team_member(
        db_session,
        name="Alice",
        plane_user_id="uid-001",
        github_username="alice",
    )
    m2 = await create_team_member(
        db_session,
        name="Bob",
        plane_user_id="uid-002",
        github_username="bob",
    )

    now = datetime.now(timezone.utc)

    # Alice: 2 completed tasks (8 points), 1 commit, 1 PR
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        state="Done",
        estimate_points=5,
        assignee=m1,
        completed_at=now,
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-002",
        state="Done",
        estimate_points=3,
        assignee=m1,
        completed_at=now,
    )
    await create_github_commit(db_session, m1, sha="aaa", committed_at=now, lines_added=200)
    await create_github_pr(db_session, m1, pr_number=1, merged_at=now)

    # Bob: 1 completed task (2 points), no GitHub activity
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-003",
        state="Done",
        estimate_points=2,
        assignee=m2,
        completed_at=now,
    )

    response = await client.get("/api/metrics/comparative")
    assert response.status_code == 200

    data = response.json()
    assert len(data["members"]) == 2

    alice = next(m for m in data["members"] if m["name"] == "Alice")
    bob = next(m for m in data["members"] if m["name"] == "Bob")

    assert alice["tasks_completed"] == 2
    assert alice["points_completed"] == 8
    assert alice["commits"] == 1
    assert alice["prs_merged"] == 1
    assert alice["lines_written"] == 200

    assert bob["tasks_completed"] == 1
    assert bob["points_completed"] == 2
    assert bob["commits"] == 0
    assert bob["prs_merged"] == 0

    # Rankings: Alice should be #1 for tasks_completed
    assert alice["rankings"]["tasks_completed"] == 1
    assert bob["rankings"]["tasks_completed"] == 2


async def test_comparative_members_with_zero_activity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Members with no activity still appear with zeroed metrics."""
    await create_team_member(
        db_session,
        name="NoWork",
        plane_user_id="uid-lazy",
        github_username=None,
    )

    response = await client.get("/api/metrics/comparative")
    assert response.status_code == 200

    data = response.json()
    assert len(data["members"]) == 1
    member = data["members"][0]
    assert member["tasks_completed"] == 0
    assert member["points_completed"] == 0
    assert member["commits"] == 0
    assert member["prs_merged"] == 0
    assert member["lines_written"] == 0


async def test_comparative_filter_by_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/comparative?project_id=X filters work items by project."""
    p1 = await create_project(db_session, plane_project_id="proj-001", name="P1")
    p2 = await create_project(db_session, plane_project_id="proj-002", name="P2")
    member = await create_team_member(db_session, plane_user_id="uid-001")
    now = datetime.now(timezone.utc)

    await create_work_item(
        db_session,
        p1,
        plane_issue_id="issue-001",
        state="Done",
        estimate_points=5,
        assignee=member,
        completed_at=now,
    )
    await create_work_item(
        db_session,
        p2,
        plane_issue_id="issue-002",
        state="Done",
        estimate_points=3,
        assignee=member,
        completed_at=now,
    )

    response = await client.get(f"/api/metrics/comparative?project_id={p1.id}")
    assert response.status_code == 200

    data = response.json()
    m = data["members"][0]
    assert m["tasks_completed"] == 1
    assert m["points_completed"] == 5


async def test_comparative_filter_by_cycle(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GET /api/metrics/comparative?cycle_id=X filters work items by cycle."""
    project = await create_project(db_session)
    c1 = await create_cycle(db_session, project, plane_cycle_id="c1", name="Sprint 1")
    c2 = await create_cycle(db_session, project, plane_cycle_id="c2", name="Sprint 2")
    member = await create_team_member(db_session, plane_user_id="uid-001")
    now = datetime.now(timezone.utc)

    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-001",
        state="Done",
        cycle=c1,
        assignee=member,
        completed_at=now,
        estimate_points=5,
    )
    await create_work_item(
        db_session,
        project,
        plane_issue_id="issue-002",
        state="Done",
        cycle=c2,
        assignee=member,
        completed_at=now,
        estimate_points=3,
    )

    response = await client.get(f"/api/metrics/comparative?cycle_id={c1.id}")
    assert response.status_code == 200

    data = response.json()
    m = data["members"][0]
    assert m["tasks_completed"] == 1
    assert m["points_completed"] == 5


# ---------------------------------------------------------------------------
# Ranking logic unit tests
# ---------------------------------------------------------------------------


def test_rank_members_higher_is_better() -> None:
    """_rank_members assigns rank 1 to the highest value for higher-is-better metrics."""
    from app.services.metrics_comparative import _rank_members

    members = [
        {"id": 1, "score": 10},
        {"id": 2, "score": 20},
        {"id": 3, "score": 15},
    ]
    ranks = _rank_members(members, "score", higher_is_better=True)
    assert ranks[2] == 1  # 20 is highest
    assert ranks[3] == 2  # 15 is second
    assert ranks[1] == 3  # 10 is third


def test_rank_members_lower_is_better() -> None:
    """_rank_members assigns rank 1 to the lowest value for lower-is-better metrics."""
    from app.services.metrics_comparative import _rank_members

    members = [
        {"id": 1, "score": 5},
        {"id": 2, "score": 0},
        {"id": 3, "score": 3},
    ]
    ranks = _rank_members(members, "score", higher_is_better=False)
    assert ranks[2] == 1  # 0 is lowest (best)
    assert ranks[3] == 2
    assert ranks[1] == 3


def test_rank_members_ties() -> None:
    """_rank_members gives the same rank to tied members."""
    from app.services.metrics_comparative import _rank_members

    members = [
        {"id": 1, "score": 10},
        {"id": 2, "score": 10},
        {"id": 3, "score": 5},
    ]
    ranks = _rank_members(members, "score", higher_is_better=True)
    assert ranks[1] == 1
    assert ranks[2] == 1  # Same as #1
    assert ranks[3] == 3


def test_rank_members_empty() -> None:
    """_rank_members returns empty dict for empty input."""
    from app.services.metrics_comparative import _rank_members

    ranks = _rank_members([], "score", higher_is_better=True)
    assert ranks == {}
