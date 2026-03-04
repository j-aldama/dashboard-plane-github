"""Add project_type to projects

Revision ID: 008
Revises: 007
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "project_type",
            sa.String(20),
            server_default="client",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_projects_project_type",
        "projects",
        "project_type IN ('client', 'support', 'internal')",
    )
    # Migrate existing data: support projects get project_type='support'
    op.execute(
        "UPDATE projects SET project_type = 'support' WHERE is_support = true"
    )


def downgrade() -> None:
    op.drop_constraint("ck_projects_project_type", "projects", type_="check")
    op.drop_column("projects", "project_type")
