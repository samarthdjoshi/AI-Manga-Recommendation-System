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

from pydantic import Field
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

    # ======================================================
    # API
    # ======================================================

    API_TIMEOUT: int = Field(default=30, ge=1)

    API_RETRIES: int = Field(default=3, ge=0)

    USER_AGENT: str = "AI-Manga-Recommendation-System/0.1.0"

    # ======================================================
    # Logging
    # ======================================================

    LOG_LEVEL: str = "INFO"

    # ======================================================
    # Database
    # ======================================================

    DATABASE_URL: str = "sqlite:///database/app.db"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached application settings.

    Using lru_cache ensures that configuration is loaded
    only once during application startup.
    """
    return Settings()


settings = get_settings()