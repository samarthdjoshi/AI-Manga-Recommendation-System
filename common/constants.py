"""
Application-wide constants.

Only values that never change during runtime belong here.

Environment-specific values belong in config.py.
"""

from __future__ import annotations

# =============================================================================
# Project
# =============================================================================

PROJECT_NAME = "AI Manga Recommendation System"

DEFAULT_ENCODING = "utf-8"

# =============================================================================
# Data Sources
# =============================================================================

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
# File Extensions
# =============================================================================

JSON_EXTENSION = ".json"

PARQUET_EXTENSION = ".parquet"

CSV_EXTENSION = ".csv"

# =============================================================================
# Date Formats
# =============================================================================

DEFAULT_DATE_FORMAT = "%Y-%m-%d"

DEFAULT_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"