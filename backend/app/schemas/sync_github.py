from pydantic import BaseModel


class SyncGitHubResponse(BaseModel):
    commits_created: int
    commits_updated: int
    prs_created: int
    prs_updated: int
    repos_scanned: int
