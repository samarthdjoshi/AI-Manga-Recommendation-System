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