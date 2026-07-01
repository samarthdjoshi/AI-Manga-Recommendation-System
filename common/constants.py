"""
common.constants
~~~~~~~~~~~~~~~~

Project-wide constants.

This module defines values that are constant throughout the application
lifecycle and are shared across multiple modules.

Constants differ from configuration:

- Constants never change at runtime.
- Configuration may differ between environments.

Examples
--------
Constants:
    - File extensions
    - Default retry count
    - Default page size

Configuration:
    - Database URL
    - API Keys
    - Environment
"""

from __future__ import annotations

# =============================================================================
# Project
# =============================================================================

PROJECT_NAME = "AI Manga Recommendation System"

PROJECT_VERSION = "0.1.0"

# =============================================================================
# HTTP
# =============================================================================

DEFAULT_TIMEOUT = 30

DEFAULT_RETRIES = 3

USER_AGENT = (
    f"{PROJECT_NAME}/{PROJECT_VERSION}"
)

# =============================================================================
# Pagination
# =============================================================================

DEFAULT_PAGE_SIZE = 50

MAX_PAGE_SIZE = 500

# =============================================================================
# File Extensions
# =============================================================================

JSON_EXTENSION = ".json"

PARQUET_EXTENSION = ".parquet"

CSV_EXTENSION = ".csv"

# =============================================================================
# Data Layers
# =============================================================================

BRONZE_LAYER = "bronze"

SILVER_LAYER = "silver"

GOLD_LAYER = "gold"

# =============================================================================
# Logging
# =============================================================================

DEFAULT_LOGGER_NAME = "ai_manga"