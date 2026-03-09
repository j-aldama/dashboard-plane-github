"""Make team_member_id nullable on GitHub tables and add github_author_login

Allows storing GitHub commits/PRs from org contributors that are not yet
mapped to a Plane team member.  The github_author_login column always stores
the GitHub login of the author.

Revision ID: 004
Revises: 003
Create Date: 2026-03-02 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -- github_commits --
    op.alter_column(
        "github_commits",
        "team_member_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "github_commits",
        sa.Column("github_author_login", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_github_commits_author_login",
        "github_commits",
        ["github_author_login"],
    )

    # -- github_pull_requests --
    op.alter_column(
        "github_pull_requests",
        "team_member_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "github_pull_requests",
        sa.Column("github_author_login", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_github_pull_requests_author_login",
        "github_pull_requests",
        ["github_author_login"],
    )


def downgrade() -> None:
    op.drop_index("ix_github_pull_requests_author_login", "github_pull_requests")
    op.drop_column("github_pull_requests", "github_author_login")
    op.alter_column(
        "github_pull_requests",
        "team_member_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_index("ix_github_commits_author_login", "github_commits")
    op.drop_column("github_commits", "github_author_login")
    op.alter_column(
        "github_commits",
        "team_member_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
