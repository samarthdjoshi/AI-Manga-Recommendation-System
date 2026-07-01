"""
common/paths.py

Centralized project path management.

Why does this module exist?
---------------------------
Every module in the project needs to work with files and directories.

Instead of hardcoding paths throughout the codebase, we define every important
directory here and import them wherever needed.

Benefits
--------
- Single source of truth
- Easy maintenance
- Cross-platform compatibility
- Cleaner code
- Automatic directory creation

Example
-------
from common.paths import GOLD_DIR

dataset = GOLD_DIR / "manga.parquet"
"""

from __future__ import annotations

from pathlib import Path

# =============================================================================
# Project Root
# =============================================================================
#
# Project Structure
#
# AI-Manga-Recommendation-System/
# │
# ├── common/
# │      paths.py
#
# __file__
#      ↓
# paths.py
#
# parent
#      ↓
# common/
#
# parent.parent
#      ↓
# AI-Manga-Recommendation-System/
#
# =============================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# =============================================================================
# Top-Level Directories
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
# Bronze Source Directories
# =============================================================================

ANILIST_BRONZE_DIR = BRONZE_DIR / "anilist"

MANGADEX_BRONZE_DIR = BRONZE_DIR / "mangadex"

JIKAN_BRONZE_DIR = BRONZE_DIR / "jikan"

MANGAUPDATES_BRONZE_DIR = BRONZE_DIR / "mangaupdates"

# =============================================================================
# Automatically Create Required Directories
# =============================================================================

for directory in (
    LOGS_DIR,
    BRONZE_DIR,
    SILVER_DIR,
    GOLD_DIR,
    ANILIST_BRONZE_DIR,
    MANGADEX_BRONZE_DIR,
    JIKAN_BRONZE_DIR,
    MANGAUPDATES_BRONZE_DIR,
):
    directory.mkdir(parents=True, exist_ok=True)