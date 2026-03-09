import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Configure logging for the app — ensures INFO from sync services is visible.
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
            "datefmt": "%H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "loggers": {
        "app": {"level": "INFO", "handlers": ["console"], "propagate": False},
    },
})

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.auth import require_api_key
from app.config import settings
from app.database import engine
from app.routers import health
from app.routers import sync_members
from app.routers import sync_projects
from app.routers import metrics_plane
from app.routers import metrics_github
from app.routers import sync_work_items
from app.routers import sync_github
from app.routers import metrics_comparative
from app.routers import metrics_person
from app.routers import support
from app.routers import sync_all
from app.routers import sync_schedule
from app.routers import team_members
from app.routers import github_repositories
from app.routers import projects
from app.routers import blocked_tasks
from app.database import AsyncSessionLocal
from app.services.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting up — verifying database connection...")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection verified successfully.")
    except Exception as exc:
        logger.error("Failed to connect to database on startup: %s", exc)
    try:
        async with AsyncSessionLocal() as db:
            await start_scheduler(db)
        logger.info("Scheduler started successfully.")
    except Exception as exc:
        logger.error("Failed to start scheduler: %s", exc)
    yield
    stop_scheduler()
    logger.info("Shutting down — disposing database engine...")
    await engine.dispose()


_docs_kwargs: dict = {}
if not settings.DOCS_ENABLED:
    _docs_kwargs = {"docs_url": None, "redoc_url": None, "openapi_url": None}

app = FastAPI(
    title="Dashboard de Productividad API",
    version="0.1.0",
    lifespan=lifespan,
    dependencies=[Depends(require_api_key)],
    **_docs_kwargs,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception for %s %s: %s",
        request.method,
        request.url,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


app.include_router(health.router, prefix="/api")
app.include_router(sync_members.router, prefix="/api")
app.include_router(sync_projects.router, prefix="/api")
app.include_router(metrics_plane.router)
app.include_router(metrics_github.router)
app.include_router(sync_work_items.router, prefix="/api")
app.include_router(sync_github.router, prefix="/api")
app.include_router(metrics_comparative.router)
app.include_router(metrics_person.router)
app.include_router(support.router)
app.include_router(sync_all.router, prefix="/api")
app.include_router(sync_schedule.router, prefix="/api")
app.include_router(team_members.router, prefix="/api")
app.include_router(github_repositories.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(blocked_tasks.router, prefix="/api")
