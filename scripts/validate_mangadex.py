from __future__ import annotations

import sys

from common.paths import MANGADEX_BRONZE_DIR
from ml.ingestion.validation import validate_bronze_directory


def main() -> None:
    report = validate_bronze_directory(
        bronze_dir=MANGADEX_BRONZE_DIR,
        source_name="MangaDex",
        expected_records_per_page=100,
        media_extractor=lambda data: data.get("data", []),
    )

    print(report.render())

    if not report.is_valid:
        sys.exit(1)


if __name__ == "__main__":
    main()
