from datetime import datetime

from pydantic import BaseModel


class ServiceStatus(BaseModel):
    database: str
    redis: str


class HealthResponse(BaseModel):
    status: str
    services: ServiceStatus
    timestamp: datetime
