"""
Centralized application configuration.

Configuration values are loaded from environment variables
(or a .env file) and validated using Pydantic Settings.

Every module in the project should access runtime
configuration through the shared `settings` object.

Example
-------
from common.config import settings

print(settings.APP_NAME)
print(settings.API_TIMEOUT)
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration.

    Values are loaded in this order:

    1. Environment variables
    2. .env file
    3. Default values
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ======================================================
    # Application
    # ======================================================

    APP_NAME: str = "AI Manga Recommendation System"

    APP_VERSION: str = "0.1.0"

    APP_ENV: str = "development"

    DEBUG: bool = True

    # Comma-separated browser origins permitted to call the API.  Keep this
    # explicit: authenticated APIs must not accept credentialed requests from
    # arbitrary websites.
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ======================================================
    # API
    # ======================================================

    API_TIMEOUT: int = Field(default=30, ge=1)

    API_RETRIES: int = Field(default=3, ge=0)

    USER_AGENT: str = "AI-Manga-Recommendation-System/0.1.0"

    # ======================================================
    # API Rate Limiting
    # ======================================================

    API_REQUEST_DELAY: float = Field(
        default=1.5,
        ge=0,
    )

    API_MAX_BACKOFF: int = Field(
        default=60,
        ge=1,
    )

    API_RETRY_STATUS_CODES: tuple[int, ...] = (
        429,
        500,
        502,
        503,
        504,
    )

    # ======================================================
    # Logging
    # ======================================================

    LOG_LEVEL: str = "INFO"

    # ======================================================
    # Database
    # ======================================================

    DATABASE_URL: str = "sqlite:///database/app.db"

    # ======================================================
    # Authentication / JWT
    # ======================================================
    JWT_SECRET_KEY: str = "dev-only-secret-change-me-in-.env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30

    # ======================================================
    # Gemini API (AI chatbot)
    # ======================================================
    GEMINI_API_KEY: str = ""

    @property
    def cors_allowed_origins(self) -> list[str]:
        """Return normalized, non-empty CORS origins from environment config."""
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> Settings:
        """Prevent accidentally deploying with the documented development key."""
        if self.APP_ENV.lower() == "production":
            if self.JWT_SECRET_KEY == "dev-only-secret-change-me-in-.env":
                raise ValueError("JWT_SECRET_KEY must be changed for production")
            if not self.cors_allowed_origins or "*" in self.cors_allowed_origins:
                raise ValueError("CORS_ALLOWED_ORIGINS must list explicit production origins")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached application settings.

    Using lru_cache ensures that configuration is loaded
    only once during application startup.
    """
    return Settings()


settings = get_settings()
