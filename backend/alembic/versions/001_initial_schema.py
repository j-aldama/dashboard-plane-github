"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-02-28 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- team_members ---
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("plane_user_id", sa.String(255), nullable=False),
        sa.Column("github_username", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plane_user_id"),
    )
    op.create_index(
        "ix_team_members_plane_user_id", "team_members", ["plane_user_id"]
    )

    # --- projects ---
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plane_project_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("identifier", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_support", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("support_start_date", sa.Date(), nullable=True),
        sa.Column("support_end_date", sa.Date(), nullable=True),
        sa.Column("project_start_date", sa.Date(), nullable=True),
        sa.Column("project_end_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plane_project_id"),
    )
    op.create_index(
        "ix_projects_plane_project_id", "projects", ["plane_project_id"]
    )

    # --- cycles ---
    op.create_table(
        "cycles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("plane_cycle_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plane_cycle_id"),
    )
    op.create_index("ix_cycles_project_id", "cycles", ["project_id"])
    op.create_index("ix_cycles_plane_cycle_id", "cycles", ["plane_cycle_id"])

    # --- work_items ---
    op.create_table(
        "work_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.Integer(), nullable=True),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("plane_issue_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(50), nullable=True),
        sa.Column("estimate_points", sa.Integer(), nullable=True),
        sa.Column("label_names", sa.JSON(), nullable=True),
        sa.Column("is_bug", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "is_client_blocked",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assignee_id"], ["team_members.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["cycles.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plane_issue_id"),
    )
    op.create_index("ix_work_items_project_id", "work_items", ["project_id"])
    op.create_index("ix_work_items_cycle_id", "work_items", ["cycle_id"])
    op.create_index("ix_work_items_assignee_id", "work_items", ["assignee_id"])
    op.create_index("ix_work_items_state", "work_items", ["state"])
    op.create_index("ix_work_items_plane_issue_id", "work_items", ["plane_issue_id"])

    # --- github_commits ---
    op.create_table(
        "github_commits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_member_id", sa.Integer(), nullable=False),
        sa.Column("repo_name", sa.String(255), nullable=False),
        sa.Column("sha", sa.String(40), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("lines_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lines_removed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_member_id"], ["team_members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sha"),
    )
    op.create_index(
        "ix_github_commits_team_member_id", "github_commits", ["team_member_id"]
    )
    op.create_index("ix_github_commits_repo_name", "github_commits", ["repo_name"])

    # --- github_pull_requests ---
    op.create_table(
        "github_pull_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_member_id", sa.Integer(), nullable=False),
        sa.Column("repo_name", sa.String(255), nullable=False),
        sa.Column("pr_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("state", sa.String(50), nullable=False),
        sa.Column("merged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_member_id"], ["team_members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "repo_name", "pr_number", name="uq_github_pull_requests_repo_pr"
        ),
    )
    op.create_index(
        "ix_github_pull_requests_team_member_id",
        "github_pull_requests",
        ["team_member_id"],
    )
    op.create_index(
        "ix_github_pull_requests_repo_name", "github_pull_requests", ["repo_name"]
    )

    # --- sync_logs ---
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sync_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("sync_logs")
    op.drop_index("ix_github_pull_requests_repo_name", table_name="github_pull_requests")
    op.drop_index(
        "ix_github_pull_requests_team_member_id", table_name="github_pull_requests"
    )
    op.drop_table("github_pull_requests")
    op.drop_index("ix_github_commits_repo_name", table_name="github_commits")
    op.drop_index("ix_github_commits_team_member_id", table_name="github_commits")
    op.drop_table("github_commits")
    op.drop_index("ix_work_items_plane_issue_id", table_name="work_items")
    op.drop_index("ix_work_items_state", table_name="work_items")
    op.drop_index("ix_work_items_assignee_id", table_name="work_items")
    op.drop_index("ix_work_items_cycle_id", table_name="work_items")
    op.drop_index("ix_work_items_project_id", table_name="work_items")
    op.drop_table("work_items")
    op.drop_index("ix_cycles_plane_cycle_id", table_name="cycles")
    op.drop_index("ix_cycles_project_id", table_name="cycles")
    op.drop_table("cycles")
    op.drop_index("ix_projects_plane_project_id", table_name="projects")
    op.drop_table("projects")
    op.drop_index("ix_team_members_plane_user_id", table_name="team_members")
    op.drop_table("team_members")
