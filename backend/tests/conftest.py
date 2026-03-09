"""Shared test fixtures for the backend test suite.

Provides:
- An async SQLite in-memory engine with all tables created.
- An async session factory bound to that engine.
- A dependency override for ``get_db`` so all endpoints use the test DB.
- An ``httpx.AsyncClient`` wired to the FastAPI application.
- Factory helpers to seed common data (team members, projects, cycles,
  work items, commits, pull requests).

Important: We pre-inject ``app.config`` and ``app.database`` into
``sys.modules`` BEFORE the real modules are imported. This avoids two
problems:
1. ``app.config.Settings()`` reading a ``.env`` file with extra keys that
   the pydantic-settings model rejects.
2. ``app.database.create_async_engine`` receiving ``pool_size`` /
   ``max_overflow`` which SQLite does not support.
"""

from __future__ import annotations

import os
import sys
import types

# ---------------------------------------------------------------------------
# 1. Set required environment variables.
# ---------------------------------------------------------------------------

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ.setdefault("PLANE_API_KEY", "")
os.environ.setdefault("PLANE_BASE_URL", "")
os.environ.setdefault("PLANE_WORKSPACE_SLUG", "")
os.environ.setdefault("GITHUB_TOKEN", "")
os.environ.setdefault("GITHUB_ORG", "")

# ---------------------------------------------------------------------------
# 2. Remove stale app modules from the cache.
# ---------------------------------------------------------------------------

for _mod_name in list(sys.modules):
    if _mod_name.startswith("app.") or _mod_name == "app":
        del sys.modules[_mod_name]

# ---------------------------------------------------------------------------
# 3. Inject a test-safe app.config module.
# ---------------------------------------------------------------------------

from pydantic_settings import BaseSettings, SettingsConfigDict  # noqa: E402
from pydantic import field_validator  # noqa: E402


class _TestSettings(BaseSettings):
    """Test-safe Settings that ignores .env and extra env vars."""

    model_config = SettingsConfigDict(
        env_file=None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    DATABASE_URL: str

    PLANE_API_KEY: str = ""
    PLANE_BASE_URL: str = ""
    PLANE_WORKSPACE_SLUG: str = ""

    GITHUB_TOKEN: str = ""
    GITHUB_ORG: str = ""

    REDIS_URL: str = "redis://localhost:6379"

    API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    CORS_METHODS: list[str] = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    CORS_HEADERS: list[str] = ["Content-Type", "X-API-Key"]

    DOCS_ENABLED: bool = True

    @field_validator("CORS_ORIGINS", "CORS_METHODS", "CORS_HEADERS", mode="before")
    @classmethod
    def parse_comma_list(cls, v: object) -> object:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


# Build a fake app package first.
_app_pkg = types.ModuleType("app")
_app_pkg.__path__ = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")
]
_app_pkg.__package__ = "app"
sys.modules["app"] = _app_pkg

# Build and inject the config module.
_config_module = types.ModuleType("app.config")
_config_module.__package__ = "app"
_config_module.Settings = _TestSettings
_config_module.get_settings = lambda: _TestSettings()
_config_module.settings = _TestSettings()
sys.modules["app.config"] = _config_module

# ---------------------------------------------------------------------------
# 4. Inject a test-safe app.database module (no pool_size for SQLite).
# ---------------------------------------------------------------------------

from collections.abc import AsyncGenerator as _AsyncGenerator  # noqa: E402

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession as _AsyncSession,
    async_sessionmaker as _async_sessionmaker,
    create_async_engine as _create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase as _DeclarativeBase  # noqa: E402

from sqlalchemy import event as _sa_event  # noqa: E402

_TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_engine = _create_async_engine(_TEST_DATABASE_URL, echo=False)


# Register PostgreSQL-specific functions that SQLite lacks.
@_sa_event.listens_for(_engine.sync_engine, "connect")
def _register_sqlite_functions(dbapi_conn, connection_record):
    """Add a ``date_trunc`` UDF so queries using the PostgreSQL function
    work transparently on SQLite during tests."""
    import sqlite3

    if isinstance(dbapi_conn, sqlite3.Connection):
        raw = dbapi_conn
    else:
        # aiosqlite wraps the real connection
        raw = getattr(dbapi_conn, "_conn", dbapi_conn)

    def _date_trunc(unit: str, value: str | None) -> str | None:
        if value is None:
            return None
        # Parse ISO datetime strings such as "2025-01-15 10:00:00+00:00"
        from datetime import datetime as _dt, date as _d
        try:
            if isinstance(value, str):
                # Strip trailing timezone info for fromisoformat compat
                v = value.replace("Z", "+00:00")
                parsed = _dt.fromisoformat(v)
            elif isinstance(value, (_dt, _d)):
                parsed = value if isinstance(value, _dt) else _dt(value.year, value.month, value.day)
            else:
                return value
        except (ValueError, TypeError):
            return value

        if unit == "day":
            return parsed.strftime("%Y-%m-%d 00:00:00")
        elif unit == "week":
            # Truncate to Monday of the week
            weekday = parsed.weekday()  # Mon=0
            monday = parsed.replace(hour=0, minute=0, second=0, microsecond=0)
            monday = monday - __import__("datetime").timedelta(days=weekday)
            return monday.strftime("%Y-%m-%d 00:00:00")
        elif unit == "month":
            return parsed.strftime("%Y-%m-01 00:00:00")
        else:
            return parsed.strftime("%Y-%m-%d 00:00:00")

    raw.create_function("date_trunc", 2, _date_trunc)

_AsyncSessionLocal = _async_sessionmaker(
    bind=_engine,
    class_=_AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class _Base(_DeclarativeBase):
    pass


async def _get_db() -> _AsyncGenerator[_AsyncSession, None]:
    async with _AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


_database_module = types.ModuleType("app.database")
_database_module.__package__ = "app"
_database_module.engine = _engine
_database_module.AsyncSessionLocal = _AsyncSessionLocal
_database_module.Base = _Base
_database_module.get_db = _get_db
_database_module.create_async_engine = _create_async_engine
_database_module.async_sessionmaker = _async_sessionmaker
_database_module.AsyncSession = _AsyncSession
_database_module.DeclarativeBase = _DeclarativeBase
sys.modules["app.database"] = _database_module

# ---------------------------------------------------------------------------
# Now it is safe to import all app modules.
# ---------------------------------------------------------------------------

from datetime import date, datetime, timezone  # noqa: E402
from typing import AsyncGenerator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Re-export the injected objects under the names the rest of the app expects.
Base = _Base
get_db = _get_db
engine = _engine

from app.models.cycle import Cycle  # noqa: E402
from app.models.github_commit import GitHubCommit  # noqa: E402
from app.models.github_pull_request import GitHubPullRequest  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.sync_log import SyncLog  # noqa: E402
from app.models.sync_schedule import SyncSchedule  # noqa: E402
from app.models.team_member import TeamMember  # noqa: E402
from app.models.work_item import WorkItem  # noqa: E402


# ---------------------------------------------------------------------------
# Engine & session (for test infrastructure)
# ---------------------------------------------------------------------------

TestingSessionLocal = _async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _deduplicate_indexes(metadata):
    """Remove duplicate index definitions from metadata tables.

    Several models define ``index=True`` on a column AND an explicit
    ``Index(...)`` in ``__table_args__`` with the same auto-generated name.
    PostgreSQL tolerates this but SQLite does not.  We keep only one index
    per name per table so ``create_all`` succeeds on SQLite.
    """
    for table in metadata.tables.values():
        seen: dict[str, object] = {}
        duplicates = []
        for idx in table.indexes:
            if idx.name in seen:
                duplicates.append(idx)
            else:
                seen[idx.name] = idx
        for dup in duplicates:
            table.indexes.discard(dup)


# Run deduplication once, right after all models have been imported.
_deduplicate_indexes(Base.metadata)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean async session for service-level tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an httpx AsyncClient wired to the FastAPI app with DB override."""
    from app.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Data factories
# ---------------------------------------------------------------------------


async def create_team_member(
    db: AsyncSession,
    *,
    name: str = "Juan Test",
    email: str | None = "juan@test.com",
    plane_user_id: str = "plane-user-001",
    github_username: str | None = "juantest",
    avatar_url: str | None = "https://avatar.test/juan.png",
) -> TeamMember:
    member = TeamMember(
        name=name,
        email=email,
        plane_user_id=plane_user_id,
        github_username=github_username,
        avatar_url=avatar_url,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def create_project(
    db: AsyncSession,
    *,
    plane_project_id: str = "plane-proj-001",
    name: str = "Test Project",
    identifier: str | None = "TP",
    description: str | None = "A test project",
    is_support: bool = False,
    project_type: str = "client",
    project_start_date: date | None = None,
    project_end_date: date | None = None,
    support_start_date: date | None = None,
    support_end_date: date | None = None,
) -> Project:
    project = Project(
        plane_project_id=plane_project_id,
        name=name,
        identifier=identifier,
        description=description,
        is_support=is_support,
        project_type=project_type,
        project_start_date=project_start_date,
        project_end_date=project_end_date,
        support_start_date=support_start_date,
        support_end_date=support_end_date,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def create_cycle(
    db: AsyncSession,
    project: Project,
    *,
    plane_cycle_id: str = "plane-cycle-001",
    name: str = "Sprint 1",
    start_date: date | None = None,
    end_date: date | None = None,
    is_active: bool = False,
) -> Cycle:
    cycle = Cycle(
        project_id=project.id,
        plane_cycle_id=plane_cycle_id,
        name=name,
        start_date=start_date,
        end_date=end_date,
        is_active=is_active,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return cycle


_STATE_TO_GROUP: dict[str | None, str | None] = {
    "Done": "completed",
    "Cancelled": "cancelled",
    "Backlog": "backlog",
    "In Progress": "started",
    "Todo": "unstarted",
    None: None,
}


async def create_work_item(
    db: AsyncSession,
    project: Project,
    *,
    plane_issue_id: str = "plane-issue-001",
    title: str = "Test Task",
    state: str | None = "In Progress",
    state_group: str | None = None,
    priority: str | None = "high",
    estimate_points: int | None = 3,
    label_names: list | None = None,
    is_bug: bool = False,
    is_client_blocked: bool = False,
    assignee: TeamMember | None = None,
    cycle: Cycle | None = None,
    completed_at: datetime | None = None,
) -> WorkItem:
    # Derive state_group from state when not explicitly provided
    resolved_group = state_group if state_group is not None else _STATE_TO_GROUP.get(state)
    work_item = WorkItem(
        project_id=project.id,
        cycle_id=cycle.id if cycle else None,
        assignee_id=assignee.id if assignee else None,
        plane_issue_id=plane_issue_id,
        title=title,
        state=state,
        state_group=resolved_group,
        priority=priority,
        estimate_points=estimate_points,
        label_names=label_names,
        is_bug=is_bug,
        is_client_blocked=is_client_blocked,
        completed_at=completed_at,
    )
    db.add(work_item)
    await db.commit()
    await db.refresh(work_item)
    return work_item


async def create_github_commit(
    db: AsyncSession,
    member: TeamMember,
    *,
    repo_name: str = "test-repo",
    sha: str = "abc123def456",
    message: str | None = "feat: add feature",
    lines_added: int = 100,
    lines_removed: int = 20,
    committed_at: datetime | None = None,
) -> GitHubCommit:
    if committed_at is None:
        committed_at = datetime.now(timezone.utc)
    commit = GitHubCommit(
        team_member_id=member.id,
        repo_name=repo_name,
        sha=sha,
        message=message,
        lines_added=lines_added,
        lines_removed=lines_removed,
        committed_at=committed_at,
    )
    db.add(commit)
    await db.commit()
    await db.refresh(commit)
    return commit


async def create_github_pr(
    db: AsyncSession,
    member: TeamMember,
    *,
    repo_name: str = "test-repo",
    pr_number: int = 1,
    title: str | None = "feat: new feature",
    state: str = "closed",
    merged_at: datetime | None = None,
) -> GitHubPullRequest:
    pr = GitHubPullRequest(
        team_member_id=member.id,
        repo_name=repo_name,
        pr_number=pr_number,
        title=title,
        state=state,
        merged_at=merged_at,
    )
    db.add(pr)
    await db.commit()
    await db.refresh(pr)
    return pr


async def create_sync_schedule(
    db: AsyncSession,
    *,
    enabled: bool = False,
    scheduled_time: str = "08:00",
    tz: str = "America/Mexico_City",
    last_run_at: datetime | None = None,
) -> SyncSchedule:
    row = SyncSchedule(
        enabled=enabled,
        scheduled_time=scheduled_time,
        timezone=tz,
        last_run_at=last_run_at,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
