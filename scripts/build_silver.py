"""
Builds the Silver layer: normalizes all three Bronze sources into the
unified UnifiedMangaRecord schema, writing clean sequential pages.

This does NOT merge/deduplicate records ACROSS sources (e.g. the same
manga appearing in both AniList and MangaUpdates) - that is entity
resolution, a separate and harder step planned after this.
"""

from __future__ import annotations

import json
from pathlib import Path

from common.paths import (
    ANILIST_BRONZE_DIR,
    MANGADEX_BRONZE_DIR,
    MANGAUPDATES_BRONZE_DIR,
    SILVER_DIR,
)

from ml.ingestion.metadata import MetadataWriter
from ml.normalization.anilist_normalizer import normalize_anilist_record
from ml.normalization.mangadex_normalizer import normalize_mangadex_record
from ml.normalization.mangaupdates_normalizer import normalize_mangaupdates_record
from ml.normalization.schema import UnifiedMangaRecord

PAGE_SIZE = 500


def build_source(
    *,
    name: str,
    bronze_dir: Path,
    bronze_extractor,
    normalizer,
) -> None:
    silver_dir = SILVER_DIR / name
    silver_dir.mkdir(parents=True, exist_ok=True)

    page_files = sorted(bronze_dir.glob("page_*.json"))

    normalized: list[dict] = []
    errors = 0

    for page_file in page_files:
        with page_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        for raw_record in bronze_extractor(data):
            try:
                unified: UnifiedMangaRecord = normalizer(raw_record)
                normalized.append(unified.to_dict())
            except Exception as exc:  # noqa: BLE001
                errors += 1
                print(f"  WARNING: failed to normalize a {name} record: {exc}")

    print(f"\n{name}: normalized {len(normalized)} records ({errors} errors)")

    for index in range(0, len(normalized), PAGE_SIZE):
        chunk = normalized[index : index + PAGE_SIZE]
        page_number = (index // PAGE_SIZE) + 1
        output_path = silver_dir / f"page_{page_number:04d}.json"

        with output_path.open("w", encoding="utf-8") as file:
            json.dump({"records": chunk}, file, ensure_ascii=False, indent=2)

    metadata_writer = MetadataWriter(silver_dir)
    metadata_writer.write(
        source_name=name,
        elapsed_seconds=0,
        media_extractor=lambda d: d.get("records", []),
    )

    print(f"{name}: wrote {-(-len(normalized) // PAGE_SIZE)} silver pages to {silver_dir}")


def main() -> None:
    build_source(
        name="anilist",
        bronze_dir=ANILIST_BRONZE_DIR,
        bronze_extractor=lambda d: d.get("media", []),
        normalizer=normalize_anilist_record,
    )

    build_source(
        name="mangadex",
        bronze_dir=MANGADEX_BRONZE_DIR,
        bronze_extractor=lambda d: d.get("data", []),
        normalizer=normalize_mangadex_record,
    )

    build_source(
        name="mangaupdates",
        bronze_dir=MANGAUPDATES_BRONZE_DIR,
        bronze_extractor=lambda d: d.get("media", []),
        normalizer=normalize_mangaupdates_record,
    )

    print("\nSilver layer build complete.")


if __name__ == "__main__":
    main()
