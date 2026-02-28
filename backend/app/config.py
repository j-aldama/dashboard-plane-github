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

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
