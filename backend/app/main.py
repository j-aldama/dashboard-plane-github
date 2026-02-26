import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.redis_client import close_redis
from app.config import settings
from app.routers import health, plane, github

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Executive Dashboard API",
    description="Business dashboard API integrating Plane and GitHub metrics.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router, tags=["health"])
# app.include_router(plane_router, prefix="/api/plane", tags=["plane"])  # EXEC-002
# app.include_router(github_router, prefix="/api/github", tags=["github"])  # EXEC-003
app.include_router(plane.router)
app.include_router(github.router)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Starting Executive Dashboard API v%s", app.version)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("Shutting down — closing Redis connection")
    await close_redis()


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------
@app.get("/", tags=["root"])
async def root() -> dict:
    return {"message": "Executive Dashboard API", "docs": "/docs"}
