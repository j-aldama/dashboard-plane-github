"""Add states table and state_group column to work_items

Revision ID: 003
Revises: 002
Create Date: 2026-03-02 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "states",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plane_state_id", sa.String(255), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("group", sa.String(50), nullable=False),
        sa.Column("color", sa.String(50), nullable=True),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint("plane_state_id"),
    )
    op.create_index("ix_states_plane_state_id", "states", ["plane_state_id"])
    op.create_index("ix_states_project_id", "states", ["project_id"])

    op.add_column(
        "work_items",
        sa.Column("state_group", sa.String(50), nullable=True),
    )
    op.create_index("ix_work_items_state_group", "work_items", ["state_group"])


def downgrade() -> None:
    op.drop_index("ix_work_items_state_group", table_name="work_items")
    op.drop_column("work_items", "state_group")
    op.drop_index("ix_states_project_id", table_name="states")
    op.drop_index("ix_states_plane_state_id", table_name="states")
    op.drop_table("states")
