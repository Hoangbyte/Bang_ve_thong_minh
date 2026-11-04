from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_title: str = "Smart Whiteboard Backend"
    app_description: str = "Backend API for the Smart Whiteboard application."
    app_version: str = "1.0.0"
    ai_provider: Literal["mock"] = "mock"
    recognition_timeout_seconds: float = Field(
        default=30.0,
        gt=0,
        allow_inf_nan=False,
    )
    max_concurrent_recognition_requests: int = Field(default=10, ge=1)
    max_request_body_bytes: int = Field(
        default=1_048_576,
        ge=1_024,
        le=16_777_216,
    )
    allowed_origins: list[str] = ["http://localhost:5173"]
    allow_credentials: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_cors_origins(self) -> "Settings":
        if self.allow_credentials and "*" in self.allowed_origins:
            raise ValueError(
                "Wildcard CORS origins cannot be used when credentials are enabled."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Load settings once and reuse them throughout the application."""
    return Settings()
