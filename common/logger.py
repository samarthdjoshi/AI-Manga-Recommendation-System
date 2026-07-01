"""
common.logger
~~~~~~~~~~~~~

Centralized logging configuration for the AI Manga Recommendation System.

This module provides a reusable logger configured with both console and
rotating file handlers.

Why centralize logging?
-----------------------
Instead of every module configuring its own logger, the application
uses a single configuration that ensures:

- Consistent formatting
- Unified log levels
- Automatic log rotation
- No duplicate handlers
- Easy debugging

Example
-------
from common.logger import get_logger

logger = get_logger(__name__)

logger.info("Application started")
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from common.paths import LOGS_DIR

# =============================================================================
# Logging Configuration
# =============================================================================

LOG_FILE: Path = LOGS_DIR / "application.log"

LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | "
    "%(name)s | %(message)s"
)

DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

DEFAULT_LOG_LEVEL = logging.INFO

_MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB
_BACKUP_COUNT = 5


# =============================================================================
# Logger Factory
# =============================================================================

def get_logger(name: str) -> logging.Logger:
    """
    Return a configured logger.

    The logger is configured only once. Subsequent calls reuse the
    existing configuration and avoid adding duplicate handlers.

    Parameters
    ----------
    name:
        Usually __name__ from the calling module.

    Returns
    -------
    logging.Logger
        Configured logger instance.
    """

    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    logger.setLevel(DEFAULT_LOG_LEVEL)

    formatter = logging.Formatter(
        fmt=LOG_FORMAT,
        datefmt=DATE_FORMAT,
    )

    # -------------------------------------------------------------------------
    # Console Handler
    # -------------------------------------------------------------------------

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # -------------------------------------------------------------------------
    # Rotating File Handler
    # -------------------------------------------------------------------------

    file_handler = RotatingFileHandler(
        filename=LOG_FILE,
        maxBytes=_MAX_LOG_SIZE,
        backupCount=_BACKUP_COUNT,
        encoding="utf-8",
    )

    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    logger.propagate = False

    return logger