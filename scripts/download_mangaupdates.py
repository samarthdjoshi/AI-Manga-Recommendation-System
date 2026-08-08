from __future__ import annotations

import string
import time

from common.paths import (
    MANGAUPDATES_BRONZE_DIR,
    MANGAUPDATES_CHECKPOINT_DIR,
)

from ml.clients.mangaupdates_client import MangaUpdatesClient
from ml.ingestion.checkpoint import PartitionCheckpointManager
from ml.ingestion.downloader import Downloader
from ml.ingestion.metadata import MetadataWriter
from ml.ingestion.progress import ProgressTracker

PER_PAGE = 100
MAX_SEARCH_RESULT_WINDOW = 10000
MAX_PAGES_PER_PARTITION = MAX_SEARCH_RESULT_WINDOW // PER_PAGE

TYPES = [
    "Manga", "Manhwa", "Manhua", "Novel", "Artbook", "Doujinshi",
    "Drama CD", "Filipino", "Indonesian", "Thai", "Vietnamese", "Malaysian",
]

LETTERS = list(string.ascii_uppercase) + ["#"]

# Narrowed from 1900: manga/manhwa/manhua publishing is negligible
# before ~1950, so starting there avoids hundreds of near-guaranteed-
# empty year-partition requests without meaningfully risking coverage.
YEARS = [str(y) for y in range(1950, 2028)]


def build_initial_queue() -> list[dict]:
    return [
        {"type": [t], "letter": letter}
        for t in TYPES
        for letter in LETTERS
    ]


def split_partition(partition: dict) -> list[dict]:
    return [dict(partition, year=year) for year in YEARS]


def main() -> None:
    client = MangaUpdatesClient()
    downloader = Downloader(MANGAUPDATES_BRONZE_DIR)
    checkpoint = PartitionCheckpointManager(
        MANGAUPDATES_CHECKPOINT_DIR / "checkpoint.json"
    )
    metadata_writer = MetadataWriter(MANGAUPDATES_BRONZE_DIR)

    state = checkpoint.load()

    if state is None:
        queue = build_initial_queue()
        current_partition = None
        current_page = 1
        next_output_page = 1
        partitions_completed = 0
    else:
        queue = state["queue"]
        current_partition = state["current_partition"]
        current_page = state["current_page"]
        next_output_page = state["next_output_page"]
        partitions_completed = state.get("partitions_completed", 0)

    total_records = 0
    start_time = time.monotonic()

    tracker = ProgressTracker(source_name="MangaUpdates")
    tracker.total_pages = None

    def update_total_pages_estimate() -> None:
        """
        Feed the ProgressTracker a live-updating estimated total page
        count, derived from how many of the known partitions are done.
        This makes render() print "Current Page : X / Y", a Progress %,
        and an ETA automatically - same as AniList - even though the
        true total isn't known upfront (it grows as capped buckets get
        split). The estimate self-corrects as more partitions resolve.
        """

        pending = len(queue) + (1 if current_partition else 0)
        total_known_partitions = partitions_completed + pending
        fraction_done = (
            partitions_completed / total_known_partitions
            if total_known_partitions
            else 0
        )

        if fraction_done > 0:
            tracker.total_pages = round(next_output_page / fraction_done)

    while current_partition is not None or queue:
        if current_partition is None:
            current_partition = queue.pop(0)
            current_page = 1

            needs_probe = "year" not in current_partition

            if needs_probe:
                probe = client.search_series(
                    {**current_partition, "page": 1, "perpage": 1}
                )
                total_hits = client.get_total_hits(probe)

                if total_hits == 0:
                    partitions_completed += 1
                    current_partition = None
                    continue

                if total_hits >= MAX_SEARCH_RESULT_WINDOW:
                    queue = split_partition(current_partition) + queue
                    current_partition = None
                    checkpoint.save(
                        queue=queue,
                        current_partition=None,
                        current_page=1,
                        next_output_page=next_output_page,
                        partitions_completed=partitions_completed,
                    )
                    update_total_pages_estimate()
                    continue

        response = client.search_series(
            {**current_partition, "page": current_page, "perpage": PER_PAGE}
        )
        records = client.get_results(response)

        if not records:
            partitions_completed += 1
            current_partition = None
            continue

        downloader.save_page(next_output_page, {"media": records})

        total_records += len(records)

        tracker.update(page=next_output_page, records_in_page=len(records))
        tracker.print_progress()
        update_total_pages_estimate()

        next_output_page += 1

        is_last_page = len(records) < PER_PAGE
        is_year_partition = "year" in current_partition

        if is_last_page:
            partitions_completed += 1
            current_partition = None
            current_page = 1
        elif is_year_partition and current_page >= MAX_PAGES_PER_PARTITION:
            print(
                f"WARNING: partition still capped after year-split, "
                f"stopping here (possible data loss): {current_partition}"
            )
            partitions_completed += 1
            current_partition = None
            current_page = 1
        else:
            current_page += 1

        checkpoint.save(
            queue=queue,
            current_partition=current_partition,
            current_page=current_page,
            next_output_page=next_output_page,
            partitions_completed=partitions_completed,
        )

    checkpoint.reset()
    client.close()

    elapsed = time.monotonic() - start_time

    metadata_writer.write(
        source_name="mangaupdates",
        total_pages=next_output_page - 1,
        total_records=total_records,
        elapsed_seconds=elapsed,
    )

    print("\nDownload Complete")
    print(f"Total pages saved : {next_output_page - 1}")
    print(f"Total manga       : {total_records}")
    print(f"Metadata saved to : {MANGAUPDATES_BRONZE_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()

