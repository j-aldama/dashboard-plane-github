from datetime import datetime, timezone

from fastapi import APIRouter

from app.redis_client import ping_redis
from app.database import ping_database
from app.schemas.health import HealthResponse, ServiceStatus

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    tags=["health"],
)
async def health_check() -> HealthResponse:
    """
    Return the health status of the API and all dependent services.

    Checks:
    - PostgreSQL database connectivity
    - Redis cache connectivity
    """
    db_ok = await ping_database()
    redis_ok = await ping_redis()

    services = ServiceStatus(
        database="connected" if db_ok else "disconnected",
        redis="connected" if redis_ok else "disconnected",
    )

    all_ok = db_ok and redis_ok
    overall = "healthy" if all_ok else "degraded"

    return HealthResponse(
        status=overall,
        services=services,
        timestamp=datetime.now(tz=timezone.utc),
    )
