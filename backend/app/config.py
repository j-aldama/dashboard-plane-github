from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    DATABASE_URL: str

    PLANE_API_KEY: str = ""
    PLANE_BASE_URL: str = ""
    PLANE_WORKSPACE_SLUG: str = ""

    GITHUB_TOKEN: str = ""
    GITHUB_ORG: str = ""

    REDIS_URL: str = "redis://localhost:6379"

    API_KEY: str = ""

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    CORS_METHODS: List[str] = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    CORS_HEADERS: List[str] = ["Content-Type", "X-API-Key"]

    DOCS_ENABLED: bool = True

    @field_validator("CORS_ORIGINS", "CORS_METHODS", "CORS_HEADERS", mode="before")
    @classmethod
    def parse_comma_list(cls, v: object) -> object:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
