"""
Generic dataset downloader.

Reusable by every API source.
"""

from __future__ import annotations

import json
from pathlib import Path

from common.logger import get_logger

logger = get_logger(__name__)


class Downloader:
    """Handles saving downloaded responses."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir

    def save_page(
        self,
        page: int,
        data: dict,
    ) -> Path:
        """Save one API response to disk."""

        file_path = self.output_dir / f"page_{page:04d}.json"

        with file_path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                data,
                file,
                ensure_ascii=False,
                indent=4,
            )

        logger.info("Saved %s", file_path.name)

        return file_path