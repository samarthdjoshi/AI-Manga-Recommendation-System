from __future__ import annotations

import sys

from common.paths import ANILIST_BRONZE_DIR
from ml.ingestion.validation import validate_bronze_directory


def main() -> None:
    report = validate_bronze_directory(
        bronze_dir=ANILIST_BRONZE_DIR,
        source_name="AniList",
        expected_records_per_page=None,
        media_extractor=lambda data: data.get("media", []),
    )

    print(report.render())

    if not report.is_valid:
        sys.exit(1)


if __name__ == "__main__":
    main()
