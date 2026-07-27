from __future__ import annotations

import math
import time

from common.paths import (
    ANILIST_BRONZE_DIR,
    ANILIST_CHECKPOINT_DIR,
)

from ml.clients.anilist_client import AniListClient
from ml.ingestion.checkpoint import IdBatchCheckpointManager
from ml.ingestion.downloader import Downloader
from ml.ingestion.metadata import MetadataWriter
from ml.ingestion.progress import ProgressTracker

BATCH_SIZE = 50


def main() -> None:
    client = AniListClient()
    downloader = Downloader(ANILIST_BRONZE_DIR)
    checkpoint = IdBatchCheckpointManager(ANILIST_CHECKPOINT_DIR / "checkpoint.json")
    metadata_writer = MetadataWriter(ANILIST_BRONZE_DIR)

    state = checkpoint.load()
    next_id = state["next_id"]
    max_id = state["max_id"]
    page = state["page_number"]

    if max_id is None:
        max_id = client.get_max_manga_id()

    start_time = time.monotonic()

    tracker = ProgressTracker(source_name="AniList")
    tracker.total_pages = math.ceil(max_id / BATCH_SIZE)

    while next_id <= max_id:
        batch_end = min(next_id + BATCH_SIZE - 1, max_id)
        batch_ids = list(range(next_id, batch_end + 1))

        response = client.get_manga_batch(batch_ids)
        media = client.extract_batch_media(response)

        downloader.save_page(page, {"media": media})

        tracker.update(page=page, records_in_page=len(media))
        tracker.print_progress()

        next_id = batch_end + 1
        page += 1

        checkpoint.save(
            next_id=next_id,
            max_id=max_id,
            page_number=page,
        )

    checkpoint.reset()
    client.close()

    elapsed = time.monotonic() - start_time

    metadata_writer.write(
        source_name="anilist",
        elapsed_seconds=elapsed,
    )

    print("\nDownload Complete")
    print(f"Last page processed : {page}")
    print(f"Metadata saved to   : {ANILIST_BRONZE_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
