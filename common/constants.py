"""
Application-wide constants.

These values are fixed for the lifetime of the application.
If a value is expected to change between environments,
it belongs in config.py instead.
"""

from __future__ import annotations

# =============================================================================
# Project Metadata
# =============================================================================

PROJECT_NAME = "AI Manga Recommendation System"

SUPPORTED_DATA_SOURCES = (
    "anilist",
    "mangadex",
    "jikan",
    "mangaupdates",
)

# =============================================================================
# Data Layers
# =============================================================================

DATA_LAYERS = (
    "bronze",
    "silver",
    "gold",
)

# =============================================================================
# File Formats
# =============================================================================

JSON_EXTENSION = ".json"
PARQUET_EXTENSION = ".parquet"
CSV_EXTENSION = ".csv"

DEFAULT_ENCODING = "utf-8"

# =============================================================================
# Date & Time
# =============================================================================

DEFAULT_DATE_FORMAT = "%Y-%m-%d"
DEFAULT_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"