"""
common.paths
~~~~~~~~~~~~

Centralized project path management.

This module provides a single source of truth for all important
directories used throughout the project.

Why use this module?
--------------------
Hardcoding file and directory paths across multiple modules makes a
project difficult to maintain. By defining paths in one place, every
component imports the same locations, reducing duplication and making
future maintenance straightforward.

The project uses `pathlib` instead of `os.path` because it provides a
clean, object-oriented, and cross-platform interface for filesystem
operations.

Example
-------
from common.paths import BRONZE_DIR

dataset = BRONZE_DIR / "anilist" / "page_0001.json"
"""

from __future__ import annotations

from pathlib import Path

# =============================================================================
# Project Root
# =============================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# =============================================================================
# Core Project Directories
# =============================================================================

ASSETS_DIR = PROJECT_ROOT / "assets"
BACKEND_DIR = PROJECT_ROOT / "backend"
COMMON_DIR = PROJECT_ROOT / "common"
CONFIGS_DIR = PROJECT_ROOT / "configs"

DATA_DIR = PROJECT_ROOT / "data"
DATABASE_DIR = PROJECT_ROOT / "database"
DEPLOYMENT_DIR = PROJECT_ROOT / "deployment"
DOCS_DIR = PROJECT_ROOT / "docs"

FRONTEND_DIR = PROJECT_ROOT / "frontend"
LOGS_DIR = PROJECT_ROOT / "logs"

ML_DIR = PROJECT_ROOT / "ml"

MONITORING_DIR = PROJECT_ROOT / "monitoring"
PIPELINES_DIR = PROJECT_ROOT / "pipelines"
REQUIREMENTS_DIR = PROJECT_ROOT / "requirements"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SECURITY_DIR = PROJECT_ROOT / "security"
STORAGE_DIR = PROJECT_ROOT / "storage"
TESTS_DIR = PROJECT_ROOT / "tests"

# =============================================================================
# Data Engineering Layers
# =============================================================================

BRONZE_DIR = DATA_DIR / "bronze"
SILVER_DIR = DATA_DIR / "silver"
GOLD_DIR = DATA_DIR / "gold"

# =============================================================================
# Bronze Data Sources
# =============================================================================

ANILIST_BRONZE_DIR = BRONZE_DIR / "anilist"
MANGADEX_BRONZE_DIR = BRONZE_DIR / "mangadex"
JIKAN_BRONZE_DIR = BRONZE_DIR / "jikan"
MANGAUPDATES_BRONZE_DIR = BRONZE_DIR / "mangaupdates"

# =============================================================================
# Create Required Directories
# =============================================================================

_REQUIRED_DIRECTORIES = (
    LOGS_DIR,
    BRONZE_DIR,
    SILVER_DIR,
    GOLD_DIR,
    ANILIST_BRONZE_DIR,
    MANGADEX_BRONZE_DIR,
    JIKAN_BRONZE_DIR,
    MANGAUPDATES_BRONZE_DIR,
)

for directory in _REQUIRED_DIRECTORIES:
    directory.mkdir(parents=True, exist_ok=True)