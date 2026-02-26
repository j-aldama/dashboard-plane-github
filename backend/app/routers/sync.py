import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.redis_client import get_redis_client
from app.services.github_service import GitHubService
from app.services.plane_service import PlaneService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync")
async def sync_cache() -> dict:
    """Clear all Plane and GitHub cache keys so the next request fetches fresh data."""
    client = get_redis_client()
    deleted = 0

    for pattern in ("plane:*", "github:*"):
        cursor = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match=pattern, count=200)
            if keys:
                await client.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break

    logger.info("Cache sync: deleted %d keys", deleted)
    return {
        "status": "ok",
        "deleted_keys": deleted,
        "message": "Cache cleared, data will be fresh on next request",
    }


def _sse_event(data: dict, event_type: str | None = None) -> str:
    """Format a dict as a Server-Sent Events frame."""
    lines = []
    if event_type:
        lines.append(f"event: {event_type}")
    lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


async def _sync_stream_generator(db: AsyncSession) -> AsyncGenerator[str, None]:
    """Yield SSE events for each synchronization step."""
    steps_results: list[dict] = []

    # --- Step 1: clear_cache ---
    yield _sse_event(
        {
            "step": "clear_cache",
            "status": "in_progress",
            "message": "Limpiando caché...",
            "progress": 10,
        }
    )
    try:
        client = get_redis_client()
        deleted = 0
        for pattern in ("plane:*", "github:*"):
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=200)
                if keys:
                    await client.delete(*keys)
                    deleted += len(keys)
                if cursor == 0:
                    break
        logger.info("SSE sync — cache cleared: %d keys deleted", deleted)
        steps_results.append({"step": "clear_cache", "ok": True})
        yield _sse_event(
            {
                "step": "clear_cache",
                "status": "completed",
                "message": f"Caché limpiada ({deleted} claves eliminadas)",
                "progress": 20,
            }
        )
    except Exception as exc:
        logger.exception("SSE sync — error clearing cache: %s", exc)
        steps_results.append({"step": "clear_cache", "ok": False, "error": str(exc)})
        yield _sse_event(
            {
                "step": "clear_cache",
                "status": "error",
                "message": f"Error al limpiar caché: {exc}",
                "progress": 20,
            }
        )

    # --- Step 2: fetch_plane_metrics ---
    yield _sse_event(
        {
            "step": "fetch_plane_metrics",
            "status": "in_progress",
            "message": "Obteniendo métricas de Plane...",
            "progress": 30,
        }
    )
    try:
        plane_service = PlaneService(db)
        await plane_service.get_team_metrics()
        logger.info("SSE sync — plane metrics fetched")
        steps_results.append({"step": "fetch_plane_metrics", "ok": True})
        yield _sse_event(
            {
                "step": "fetch_plane_metrics",
                "status": "completed",
                "message": "Métricas de Plane obtenidas",
                "progress": 45,
            }
        )
    except Exception as exc:
        logger.exception("SSE sync — error fetching plane metrics: %s", exc)
        steps_results.append({"step": "fetch_plane_metrics", "ok": False, "error": str(exc)})
        yield _sse_event(
            {
                "step": "fetch_plane_metrics",
                "status": "error",
                "message": f"Error al obtener métricas de Plane: {exc}",
                "progress": 45,
            }
        )

    # --- Step 3: fetch_plane_projects ---
    yield _sse_event(
        {
            "step": "fetch_plane_projects",
            "status": "in_progress",
            "message": "Obteniendo proyectos de Plane...",
            "progress": 55,
        }
    )
    try:
        plane_service = PlaneService(db)
        await plane_service.get_projects()
        logger.info("SSE sync — plane projects fetched")
        steps_results.append({"step": "fetch_plane_projects", "ok": True})
        yield _sse_event(
            {
                "step": "fetch_plane_projects",
                "status": "completed",
                "message": "Proyectos de Plane obtenidos",
                "progress": 65,
            }
        )
    except Exception as exc:
        logger.exception("SSE sync — error fetching plane projects: %s", exc)
        steps_results.append({"step": "fetch_plane_projects", "ok": False, "error": str(exc)})
        yield _sse_event(
            {
                "step": "fetch_plane_projects",
                "status": "error",
                "message": f"Error al obtener proyectos de Plane: {exc}",
                "progress": 65,
            }
        )

    # --- Step 4: fetch_plane_cycles ---
    yield _sse_event(
        {
            "step": "fetch_plane_cycles",
            "status": "in_progress",
            "message": "Obteniendo ciclos de Plane...",
            "progress": 75,
        }
    )
    try:
        plane_service = PlaneService(db)
        await plane_service.get_cycles()
        logger.info("SSE sync — plane cycles fetched")
        steps_results.append({"step": "fetch_plane_cycles", "ok": True})
        yield _sse_event(
            {
                "step": "fetch_plane_cycles",
                "status": "completed",
                "message": "Ciclos de Plane obtenidos",
                "progress": 85,
            }
        )
    except Exception as exc:
        logger.exception("SSE sync — error fetching plane cycles: %s", exc)
        steps_results.append({"step": "fetch_plane_cycles", "ok": False, "error": str(exc)})
        yield _sse_event(
            {
                "step": "fetch_plane_cycles",
                "status": "error",
                "message": f"Error al obtener ciclos de Plane: {exc}",
                "progress": 85,
            }
        )

    # --- Step 5: fetch_github_metrics ---
    yield _sse_event(
        {
            "step": "fetch_github_metrics",
            "status": "in_progress",
            "message": "Obteniendo métricas de GitHub...",
            "progress": 90,
        }
    )
    try:
        github_service = GitHubService(db)
        await github_service.get_team_metrics()
        logger.info("SSE sync — github metrics fetched")
        steps_results.append({"step": "fetch_github_metrics", "ok": True})
        yield _sse_event(
            {
                "step": "fetch_github_metrics",
                "status": "completed",
                "message": "Métricas de GitHub obtenidas",
                "progress": 98,
            }
        )
    except Exception as exc:
        logger.exception("SSE sync — error fetching github metrics: %s", exc)
        steps_results.append({"step": "fetch_github_metrics", "ok": False, "error": str(exc)})
        yield _sse_event(
            {
                "step": "fetch_github_metrics",
                "status": "error",
                "message": f"Error al obtener métricas de GitHub: {exc}",
                "progress": 98,
            }
        )

    # --- Final summary event ---
    successful = [s["step"] for s in steps_results if s.get("ok")]
    failed = [s["step"] for s in steps_results if not s.get("ok")]
    yield _sse_event(
        {
            "step": "complete",
            "status": "completed",
            "message": "Sincronización finalizada",
            "progress": 100,
            "summary": {
                "successful": successful,
                "failed": failed,
                "total_steps": len(steps_results),
            },
        },
        event_type="complete",
    )


@router.post("/sync/stream")
async def sync_stream(db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Stream synchronization progress via Server-Sent Events.

    Executes 5 sequential steps: clear_cache, fetch_plane_metrics,
    fetch_plane_projects, fetch_plane_cycles, fetch_github_metrics.
    Each step emits at least two SSE events (in_progress + completed/error).
    A final event with type 'complete' summarises the run.
    """
    return StreamingResponse(
        _sync_stream_generator(db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
