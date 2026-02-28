from pydantic import BaseModel


class SyncProjectsCyclesResponse(BaseModel):
    projects_created: int
    projects_updated: int
    cycles_created: int
    cycles_updated: int
