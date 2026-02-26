"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # team_members
    # -------------------------------------------------------------------------
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("plane_member_id", sa.String(length=255), nullable=True),
        sa.Column("github_username", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("role", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("github_username"),
        sa.UniqueConstraint("plane_member_id"),
    )
    op.create_index(
        "ix_team_members_email", "team_members", ["email"], unique=True
    )
    op.create_index(
        "ix_team_members_plane_member_id",
        "team_members",
        ["plane_member_id"],
        unique=True,
    )
    op.create_index(
        "ix_team_members_github_username",
        "team_members",
        ["github_username"],
        unique=True,
    )

    # -------------------------------------------------------------------------
    # plane_metrics_snapshots
    # -------------------------------------------------------------------------
    op.create_table(
        "plane_metrics_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_member_id", sa.Integer(), nullable=False),
        sa.Column("cycle_id", sa.String(length=255), nullable=True),
        sa.Column("story_points_completed", sa.Float(), nullable=True),
        sa.Column("tasks_completed", sa.Integer(), nullable=True),
        sa.Column("tasks_assigned", sa.Integer(), nullable=True),
        sa.Column("priority_avg", sa.Float(), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["team_member_id"],
            ["team_members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_plane_metrics_snapshots_team_member_id",
        "plane_metrics_snapshots",
        ["team_member_id"],
    )
    op.create_index(
        "ix_plane_metrics_snapshots_cycle_id",
        "plane_metrics_snapshots",
        ["cycle_id"],
    )
    op.create_index(
        "ix_plane_metrics_snapshots_snapshot_date",
        "plane_metrics_snapshots",
        ["snapshot_date"],
    )

    # -------------------------------------------------------------------------
    # github_metrics_snapshots
    # -------------------------------------------------------------------------
    op.create_table(
        "github_metrics_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_member_id", sa.Integer(), nullable=False),
        sa.Column("prs_opened", sa.Integer(), nullable=True),
        sa.Column("prs_merged", sa.Integer(), nullable=True),
        sa.Column("prs_rejected", sa.Integer(), nullable=True),
        sa.Column("commits_count", sa.Integer(), nullable=True),
        sa.Column("lines_added", sa.Integer(), nullable=True),
        sa.Column("lines_deleted", sa.Integer(), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["team_member_id"],
            ["team_members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_github_metrics_snapshots_team_member_id",
        "github_metrics_snapshots",
        ["team_member_id"],
    )
    op.create_index(
        "ix_github_metrics_snapshots_snapshot_date",
        "github_metrics_snapshots",
        ["snapshot_date"],
    )

    # -------------------------------------------------------------------------
    # project_status_history
    # -------------------------------------------------------------------------
    op.create_table(
        "project_status_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.String(length=255), nullable=False),
        sa.Column("project_name", sa.String(length=255), nullable=False),
        sa.Column("project_type", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("progress_pct", sa.Float(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_status_history_project_id",
        "project_status_history",
        ["project_id"],
    )
    op.create_index(
        "ix_project_status_history_snapshot_date",
        "project_status_history",
        ["snapshot_date"],
    )

    # -------------------------------------------------------------------------
    # cycle_snapshots
    # -------------------------------------------------------------------------
    op.create_table(
        "cycle_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cycle_id", sa.String(length=255), nullable=False),
        sa.Column("cycle_name", sa.String(length=255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("tasks_assigned", sa.Integer(), nullable=True),
        sa.Column("tasks_completed", sa.Integer(), nullable=True),
        sa.Column("completion_rate", sa.Float(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cycle_snapshots_cycle_id", "cycle_snapshots", ["cycle_id"]
    )
    op.create_index(
        "ix_cycle_snapshots_snapshot_date", "cycle_snapshots", ["snapshot_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_cycle_snapshots_snapshot_date", table_name="cycle_snapshots")
    op.drop_index("ix_cycle_snapshots_cycle_id", table_name="cycle_snapshots")
    op.drop_table("cycle_snapshots")

    op.drop_index(
        "ix_project_status_history_snapshot_date",
        table_name="project_status_history",
    )
    op.drop_index(
        "ix_project_status_history_project_id", table_name="project_status_history"
    )
    op.drop_table("project_status_history")

    op.drop_index(
        "ix_github_metrics_snapshots_snapshot_date",
        table_name="github_metrics_snapshots",
    )
    op.drop_index(
        "ix_github_metrics_snapshots_team_member_id",
        table_name="github_metrics_snapshots",
    )
    op.drop_table("github_metrics_snapshots")

    op.drop_index(
        "ix_plane_metrics_snapshots_snapshot_date",
        table_name="plane_metrics_snapshots",
    )
    op.drop_index(
        "ix_plane_metrics_snapshots_cycle_id", table_name="plane_metrics_snapshots"
    )
    op.drop_index(
        "ix_plane_metrics_snapshots_team_member_id",
        table_name="plane_metrics_snapshots",
    )
    op.drop_table("plane_metrics_snapshots")

    op.drop_index(
        "ix_team_members_github_username", table_name="team_members"
    )
    op.drop_index(
        "ix_team_members_plane_member_id", table_name="team_members"
    )
    op.drop_index("ix_team_members_email", table_name="team_members")
    op.drop_table("team_members")
