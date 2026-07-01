"""
common/logger.py

Centralized logging configuration.

Why does this module exist?
---------------------------
Instead of every module configuring its own logger, the project
uses one shared logging system.

Benefits
--------
- Consistent log formatting
- Console + file logging
- Easier debugging
- No duplicated configuration

Example
-------
from common.logger import get_logger

logger = get_logger(__name__)

logger.info("Application started")
"""

from __future__ import annotations

import logging
from logging import Logger

from common.paths import LOGS_DIR

# Ensure the logs directory exists.
LOGS_DIR.mkdir(parents=True, exist_ok=True)


def get_logger(name: str) -> Logger:
    """
    Return a configured logger for the given module.

    Parameters
    ----------
    name : str
        Usually pass __name__.

    Returns
    -------
    logging.Logger
        Configured logger instance.
    """

    logger = logging.getLogger(name)

    # Prevent duplicate handlers when importing repeatedly.
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console output
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # File output
    file_handler = logging.FileHandler(
        LOGS_DIR / "project.log",
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    # Prevent duplicate logging from the root logger.
    logger.propagate = False

    return logger