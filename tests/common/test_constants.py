from common.constants import (
    PROJECT_NAME,
    DEFAULT_ENCODING,
    SUPPORTED_DATA_SOURCES,
    DATA_LAYERS,
    JSON_EXTENSION,
    PARQUET_EXTENSION,
    CSV_EXTENSION,
)


def test_project_name() -> None:
    assert PROJECT_NAME == "AI Manga Recommendation System"


def test_encoding() -> None:
    assert DEFAULT_ENCODING == "utf-8"


def test_data_sources() -> None:
    assert len(SUPPORTED_DATA_SOURCES) == 4
    assert "anilist" in SUPPORTED_DATA_SOURCES


def test_layers() -> None:
    assert DATA_LAYERS == ("bronze", "silver", "gold")


def test_extensions() -> None:
    assert JSON_EXTENSION == ".json"
    assert PARQUET_EXTENSION == ".parquet"
    assert CSV_EXTENSION == ".csv"