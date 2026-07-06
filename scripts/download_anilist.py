from __future__ import annotations

import time

from common.paths import (
    ANILIST_BRONZE_DIR,
    ANILIST_CHECKPOINT_DIR,
)

from ml.clients.anilist_client import AniListClient
from ml.ingestion.checkpoint import CheckpointManager
from ml.ingestion.downloader import Downloader
from ml.ingestion.metadata import MetadataWriter
from ml.ingestion.progress import ProgressTracker


def main() -> None:
    client = AniListClient()
    downloader = Downloader(ANILIST_BRONZE_DIR)
    checkpoint = CheckpointManager(ANILIST_CHECKPOINT_DIR / "checkpoint.json")
    metadata_writer = MetadataWriter(ANILIST_BRONZE_DIR)

    page = checkpoint.load()
    total_records = 0
    start_time = time.monotonic()

    tracker = ProgressTracker(source_name="AniList")

    while True:
        response = client.get_manga_page(page=page, per_page=50)

        downloader.save_page(page, response)

        page_info = client.get_page_info(response)
        media = client.get_media(response)

        total_records += len(media)

        last_page = page_info.get("lastPage")

        if tracker.total_pages is None:
            tracker.total_pages = last_page

        tracker.update(page=page, records_in_page=len(media))
        tracker.print_progress()

        # Stop if this was the final page, using BOTH signals:
        # hasNextPage can be unreliable on the boundary page for some
        # APIs, so we also guard using lastPage directly.
        is_last_page = (not page_info["hasNextPage"]) or (
            last_page is not None and page >= last_page
        )

        if is_last_page:
            checkpoint.reset()
            break

        checkpoint.save(page + 1)
        page += 1

    client.close()

    elapsed = time.monotonic() - start_time

    metadata_writer.write(
        source_name="anilist",
        total_pages=page,
        total_records=total_records,
        elapsed_seconds=elapsed,
    )

    print("\nDownload Complete")
    print(f"Last page processed : {page}")
    print(f"Total manga         : {total_records}")
    print(f"Metadata saved to   : {ANILIST_BRONZE_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
