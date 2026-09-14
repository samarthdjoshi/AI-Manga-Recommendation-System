from pathlib import Path

import pytest
from pydantic import ValidationError

from common.config import Settings, settings


def test_settings_instance() -> None:
    assert isinstance(settings, Settings)


def test_app_name() -> None:
    assert settings.APP_NAME == "AI Manga Recommendation System"


def test_timeout_positive() -> None:
    assert settings.API_TIMEOUT > 0


def test_retry_non_negative() -> None:
    assert settings.API_RETRIES >= 0


def test_database_url_exists() -> None:
    assert settings.DATABASE_URL


def test_env_example_documents_required_secret_keys() -> None:
    example = Path(".env.example").read_text(encoding="utf-8")
    assert "JWT_SECRET_KEY=" in example
    assert "JWT_ALGORITHM=" in example
    assert "JWT_EXPIRE_DAYS=" in example
    assert "GEMINI_API_KEY=" in example
    assert "CORS_ALLOWED_ORIGINS=" in example


def test_production_rejects_the_documented_development_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="dev-only-secret-change-me-in-.env",
        )


def test_cors_origins_are_normalized() -> None:
    configured = Settings(CORS_ALLOWED_ORIGINS=" https://app.example.com/ , http://localhost:5173 ")
    assert configured.cors_allowed_origins == [
        "https://app.example.com",
        "http://localhost:5173",
    ]


def test_production_rejects_wildcard_or_empty_cors() -> None:
    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="a-secure-production-key-here-12345",
            CORS_ALLOWED_ORIGINS="*",
        )

    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="a-secure-production-key-here-12345",
            CORS_ALLOWED_ORIGINS=" , ",
        )
