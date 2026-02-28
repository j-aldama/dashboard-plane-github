from pydantic import BaseModel


class SyncMembersResponse(BaseModel):
    created: int
    updated: int
    total: int
