"""
common/constants.py

Centralized project-wide constants.

Purpose
-------
This module contains immutable values that are shared across the entire
application.

A constant should:
    - Never change while the application is running.
    - Be environment-independent.
    - Represent a fixed concept used by multiple modules.

Do NOT store:
    - Secrets
    - API keys
    - URLs
    - Timeouts
    - Database credentials
Those belong in config.py.
"""

from __future__ import annotations

# =============================================================================
# Project Information
# =============================================================================

PROJECT_NAME: str = "AI Manga Recommendation System"

# =============================================================================
# Data Pipeline Layers
# =============================================================================

BRONZE: str = "bronze"
SILVER: str = "silver"
GOLD: str = "gold"

PIPELINE_LAYERS: tuple[str, ...] = (
    BRONZE,
    SILVER,
    GOLD,
)

# =============================================================================
# Supported Data Sources
# =============================================================================

SUPPORTED_DATA_SOURCES: tuple[str, ...] = (
    "anilist",
    "mangadex",
    "jikan",
    "mangaupdates",
)

# =============================================================================
# Supported File Formats
# =============================================================================

SUPPORTED_FILE_FORMATS: tuple[str, ...] = (
    "json",
    "csv",
    "parquet",
)

# =============================================================================
# Logging
# =============================================================================

DEFAULT_LOG_FILENAME: str = "project.log"

DEFAULT_LOG_FORMAT: str = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)