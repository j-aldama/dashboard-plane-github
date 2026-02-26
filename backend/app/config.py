from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Plane
    plane_api_token: str = Field(default="", alias="PLANE_API_TOKEN")
    plane_workspace_slug: str = Field(default="", alias="PLANE_WORKSPACE_SLUG")
    plane_base_url: str = Field(default="https://api.plane.so", alias="PLANE_BASE_URL")

    # GitHub
    github_token: str = Field(default="", alias="GITHUB_TOKEN")
    github_org: str = Field(default="", alias="GITHUB_ORG")
    github_repos: str = Field(default="", alias="GITHUB_REPOS")

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://user:password@db:5432/dashboard_ralph",
        alias="DATABASE_URL",
    )

    # Redis
    redis_url: str = Field(default="redis://redis:6379", alias="REDIS_URL")

    # Cache TTL (seconds)
    cache_ttl: int = Field(default=300, alias="CACHE_TTL")

    # Backend
    api_port: int = Field(default=8000, alias="API_PORT")
    secret_key: str = Field(default="change-me-in-production", alias="SECRET_KEY")
    allowed_origins: str = Field(
        default="http://localhost:3000", alias="ALLOWED_ORIGINS"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]


settings = Settings()
