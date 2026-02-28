import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.routers import health
from app.routers import sync_members
from app.routers import sync_projects
from app.routers import metrics_plane
from app.routers import metrics_github

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
    yield
    logger.info("Shutting down — disposing database engine...")
    await engine.dispose()


app = FastAPI(
    title="Dashboard de Productividad API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
