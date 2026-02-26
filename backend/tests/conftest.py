import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport

from app.database import get_db
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def mock_db():
    """Return a mock AsyncSession to replace the real DB dependency."""
    session = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_redis():
    """Return a mock Redis client with scan returning empty results."""
    client = AsyncMock()
    client.scan = AsyncMock(return_value=(0, []))
    client.delete = AsyncMock(return_value=True)
    return client


@pytest.fixture
async def client(mock_db, mock_redis):
    """Async HTTP client for testing FastAPI endpoints.

    Overrides get_db with a mock session and patches get_redis_client
    so no real Redis connection is required.
    """

    async def _override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_get_db

    with patch("app.routers.sync.get_redis_client", return_value=mock_redis):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()
