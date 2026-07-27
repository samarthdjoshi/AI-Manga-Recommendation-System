"""
Metadata generation for downloaded Bronze datasets.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


class MetadataWriter:
    """Writes a metadata.json summary for a completed download run."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir

    def write(
        self,
        *,
        source_name: str,
        elapsed_seconds: float,
        media_extractor: Callable[[dict], list] | None = None,
    ) -> Path:
        """
        Write metadata by scanning every page file currently on disk,
        rather than trusting an in-memory counter passed in by the
        caller. A counter that starts at 0 each run under-reports
        totals whenever a download is interrupted and resumed across
        multiple executions - scanning disk is always accurate
        regardless of how many runs it took to produce the data.
        """

        if media_extractor is None:
            media_extractor = lambda page: page.get("media", [])

        page_files = sorted(self.output_dir.glob("page_*.json"))

        total_records = 0
        for page_file in page_files:
            try:
                with page_file.open("r", encoding="utf-8") as file:
                    data = json.load(file)
                total_records += len(media_extractor(data))
            except (json.JSONDecodeError, OSError):
                continue

        metadata = {
            "source": source_name,
            "total_pages": len(page_files),
            "total_records": total_records,
            "elapsed_seconds": round(elapsed_seconds, 2),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        metadata_path = self.output_dir / "metadata.json"

        with metadata_path.open("w", encoding="utf-8") as file:
            json.dump(metadata, file, indent=4)

        return metadata_path
