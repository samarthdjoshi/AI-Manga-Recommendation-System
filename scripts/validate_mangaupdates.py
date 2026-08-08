from __future__ import annotations

import sys

from common.paths import MANGAUPDATES_BRONZE_DIR
from ml.ingestion.validation import validate_bronze_directory


def main() -> None:
    report = validate_bronze_directory(
        bronze_dir=MANGAUPDATES_BRONZE_DIR,
        source_name="MangaUpdates",
        expected_records_per_page=None,
        media_extractor=lambda data: data.get("media", []),
        id_key="series_id",
    )

    print(report.render())

    if not report.is_valid:
        sys.exit(1)


if __name__ == "__main__":
    main()
