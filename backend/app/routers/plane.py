"""Plane API router — stub for EXEC-001.

Full implementation is delivered in EXEC-002.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/plane", tags=["plane"])


@router.get("/ping", summary="Plane router ping")
async def plane_ping() -> dict:
    return {"message": "Plane router ready"}
