from __future__ import annotations

import math
import time

from common.paths import (
    MANGADEX_BRONZE_DIR,
    MANGADEX_CHECKPOINT_DIR,
)

from ml.clients.mangadex_client import MangaDexClient
from ml.ingestion.checkpoint import CursorCheckpointManager
from ml.ingestion.downloader import Downloader
from ml.ingestion.metadata import MetadataWriter
from ml.ingestion.progress import ProgressTracker

PAGE_LIMIT = 100


def main() -> None:
    client = MangaDexClient()
    downloader = Downloader(MANGADEX_BRONZE_DIR)
    checkpoint = CursorCheckpointManager(MANGADEX_CHECKPOINT_DIR / "checkpoint.json")
    metadata_writer = MetadataWriter(MANGADEX_BRONZE_DIR)

    state = checkpoint.load()
    created_at_since = state["created_at_since"]
    page = state["page_number"]
    total_pages = state["total_pages"]

    total_records = 0
    start_time = time.monotonic()

    tracker = ProgressTracker(source_name="MangaDex")
    tracker.total_pages = total_pages

    while True:
        response = client.get_manga_page(
            created_at_since=created_at_since,
            limit=PAGE_LIMIT,
        )

        data = client.get_data(response)

        if not data:
            checkpoint.reset()
            break

        downloader.save_page(page, response)

        total_records += len(data)
        total = client.get_total(response)

        # Only ever set this ONCE, on the very first request of the
        # very first run (created_at_since is still None at that point).
        # After that, total_pages is locked in and carried forward via
        # the checkpoint, since MangaDex's `total` field only reflects
        # manga remaining after the current cursor, not the full catalog.
        if tracker.total_pages is None and total and created_at_since is None:
            tracker.total_pages = math.ceil(total / PAGE_LIMIT)
            total_pages = tracker.total_pages

        tracker.update(page=page, records_in_page=len(data))
        tracker.print_progress()

        is_last_page = len(data) < PAGE_LIMIT

        if is_last_page:
            checkpoint.reset()
            break

        created_at_since = data[-1]["attributes"]["createdAt"]
        checkpoint.save(
            created_at_since=created_at_since,
            page_number=page + 1,
            total_pages=total_pages,
        )
        page += 1

    client.close()

    elapsed = time.monotonic() - start_time

    metadata_writer.write(
        source_name="mangadex",
        total_pages=page,
        total_records=total_records,
        elapsed_seconds=elapsed,
    )

    print("\nDownload Complete")
    print(f"Last page processed : {page}")
    print(f"Total manga         : {total_records}")
    print(f"Metadata saved to   : {MANGADEX_BRONZE_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
