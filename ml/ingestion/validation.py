"""
Validation for downloaded Bronze datasets.

Checks:
    - Every page file is valid, parseable JSON
    - Every page has the expected record count (except possibly the last page)
      - if expected_records_per_page is None, this check is skipped entirely,
        since some sources (e.g. AniList's ID-batch enumeration) legitimately
        vary in record count per page throughout, not just on the last page
    - No duplicate manga IDs across pages
    - No gaps in the page sequence (1..N with nothing missing)

Different sources have different JSON shapes (AniList wraps manga in
data.Page.media, MangaDex returns a flat data list, and the AniList
ID-batch downloader wraps in a flat media list), so callers can supply
a media_extractor to tell the validator how to pull the list of
records out of each page's JSON. Defaults to the legacy AniList
Page-query shape.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable


def _default_media_extractor(data: dict) -> list[dict]:
    return data.get("data", {}).get("Page", {}).get("media", [])


@dataclass
class ValidationReport:
    source_name: str
    total_pages_found: int = 0
    total_records: int = 0
    expected_records_per_page: int | None = 50
    invalid_json_files: list[str] = field(default_factory=list)
    unexpected_record_counts: list[str] = field(default_factory=list)
    duplicate_ids: list[Any] = field(default_factory=list)
    missing_pages: list[int] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not (
            self.invalid_json_files
            or self.unexpected_record_counts
            or self.duplicate_ids
            or self.missing_pages
        )

    def render(self) -> str:
        lines = ["=" * 50, "", f"{self.source_name} Validation Report", ""]
        lines.append(f"Pages found      : {self.total_pages_found}")
        lines.append(f"Total records    : {self.total_records}")
        lines.append(f"Status           : {'PASS' if self.is_valid else 'FAIL'}")
        lines.append("")

        if self.invalid_json_files:
            lines.append(f"Invalid JSON files ({len(self.invalid_json_files)}):")
            for name in self.invalid_json_files:
                lines.append(f"  - {name}")
            lines.append("")

        if self.missing_pages:
            lines.append(f"Missing pages ({len(self.missing_pages)}):")
            lines.append(f"  {self.missing_pages}")
            lines.append("")

        if self.unexpected_record_counts:
            lines.append(f"Pages with unexpected record counts ({len(self.unexpected_record_counts)}):")
            for entry in self.unexpected_record_counts:
                lines.append(f"  - {entry}")
            lines.append("")

        if self.duplicate_ids:
            lines.append(f"Duplicate manga IDs ({len(self.duplicate_ids)}):")
            lines.append(f"  {self.duplicate_ids[:20]}{' ...' if len(self.duplicate_ids) > 20 else ''}")
            lines.append("")

        lines.append("=" * 50)
        return "\n".join(lines)


def validate_bronze_directory(
    bronze_dir: Path,
    source_name: str,
    expected_records_per_page: int | None = 50,
    media_extractor: Callable[[dict], list[dict]] | None = None,
    id_key: str = "id",
) -> ValidationReport:
    if media_extractor is None:
        media_extractor = _default_media_extractor

    report = ValidationReport(
        source_name=source_name,
        expected_records_per_page=expected_records_per_page,
    )

    page_files = sorted(bronze_dir.glob("page_*.json"))
    report.total_pages_found = len(page_files)

    if not page_files:
        return report

    seen_ids: set[Any] = set()
    page_numbers: list[int] = []

    for page_file in page_files:
        page_number = _extract_page_number(page_file.name)
        if page_number is not None:
            page_numbers.append(page_number)

        try:
            with page_file.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (json.JSONDecodeError, OSError):
            report.invalid_json_files.append(page_file.name)
            continue

        media = media_extractor(data)
        report.total_records += len(media)

        if expected_records_per_page is not None:
            is_last_page = page_number == max(page_numbers) if page_numbers else False
            if len(media) != expected_records_per_page and not is_last_page:
                report.unexpected_record_counts.append(
                    f"{page_file.name}: expected {expected_records_per_page}, got {len(media)}"
                )

        for item in media:
            record_id = item.get(id_key)
            if record_id is None:
                continue
            if record_id in seen_ids:
                report.duplicate_ids.append(record_id)
            else:
                seen_ids.add(record_id)

    if page_numbers:
        expected_sequence = set(range(1, max(page_numbers) + 1))
        report.missing_pages = sorted(expected_sequence - set(page_numbers))

    return report


def _extract_page_number(filename: str) -> int | None:
    """Extract the page number from a filename like 'page_0007.json'."""

    stem = filename.replace("page_", "").replace(".json", "")
    try:
        return int(stem)
    except ValueError:
        return None
