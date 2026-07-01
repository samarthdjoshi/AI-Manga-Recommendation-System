"""
Unit tests for common.constants.
"""

from common.constants import (
    PROJECT_NAME,
    BRONZE,
    SILVER,
    GOLD,
    PIPELINE_LAYERS,
    SUPPORTED_DATA_SOURCES,
    SUPPORTED_FILE_FORMATS,
    DEFAULT_LOG_FILENAME,
)


def test_project_name():
    assert PROJECT_NAME == "AI Manga Recommendation System"


def test_pipeline_layers():
    assert BRONZE == "bronze"
    assert SILVER == "silver"
    assert GOLD == "gold"
    assert len(PIPELINE_LAYERS) == 3


def test_supported_data_sources():
    assert "anilist" in SUPPORTED_DATA_SOURCES
    assert "mangadex" in SUPPORTED_DATA_SOURCES
    assert "jikan" in SUPPORTED_DATA_SOURCES
    assert "mangaupdates" in SUPPORTED_DATA_SOURCES


def test_supported_file_formats():
    assert "json" in SUPPORTED_FILE_FORMATS
    assert "csv" in SUPPORTED_FILE_FORMATS
    assert "parquet" in SUPPORTED_FILE_FORMATS


def test_default_log_filename():
    assert DEFAULT_LOG_FILENAME == "project.log"