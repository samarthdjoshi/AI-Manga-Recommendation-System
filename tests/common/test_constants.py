from common.constants import (
    PROJECT_NAME,
    SUPPORTED_DATA_SOURCES,
    DATA_LAYERS,
    JSON_EXTENSION,
    PARQUET_EXTENSION,
    CSV_EXTENSION,
    DEFAULT_ENCODING,
)


def test_project_name() -> None:
    assert PROJECT_NAME == "AI Manga Recommendation System"


def test_supported_sources() -> None:
    assert "anilist" in SUPPORTED_DATA_SOURCES
    assert "mangadex" in SUPPORTED_DATA_SOURCES
    assert len(SUPPORTED_DATA_SOURCES) == 4


def test_data_layers() -> None:
    assert DATA_LAYERS == ("bronze", "silver", "gold")


def test_extensions() -> None:
    assert JSON_EXTENSION == ".json"
    assert PARQUET_EXTENSION == ".parquet"
    assert CSV_EXTENSION == ".csv"


def test_default_encoding() -> None:
    assert DEFAULT_ENCODING.lower() == "utf-8"