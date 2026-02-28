from pydantic import BaseModel


class SyncWorkItemsResponse(BaseModel):
    created: int
    updated: int
    total: int
