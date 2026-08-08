"""
Checkpoint management.

Allows interrupted downloads to resume automatically.

Two strategies are provided:

- CheckpointManager: for page-number pagination (e.g. AniList).
- CursorCheckpointManager: for cursor-based pagination (e.g. MangaDex,
  where offset/limit has a hard cap and we page by "give me everything
  created after this timestamp" instead).
"""

from __future__ import annotations

import json
from pathlib import Path


class CheckpointManager:
    """Checkpoint manager for simple page-number pagination."""

    def __init__(
        self,
        checkpoint_file: Path,
    ) -> None:
        self.checkpoint_file = checkpoint_file

    def load(self) -> int:
        """Return next page to download."""

        if not self.checkpoint_file.exists():
            return 1

        with self.checkpoint_file.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        return data.get("next_page", 1)

    def save(
        self,
        next_page: int,
    ) -> None:
        """Save next page."""

        with self.checkpoint_file.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "next_page": next_page,
                },
                file,
                indent=4,
            )

    def reset(self) -> None:
        """Delete checkpoint after successful download."""

        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()


class CursorCheckpointManager:
    """
    Checkpoint manager for cursor-based pagination.

    Stores the cursor value, the current page number, and the total
    page count established on the very first request (before any
    createdAtSince filter narrows the result set). MangaDex's `total`
    field is scoped to the current filter, so it shrinks as the cursor
    advances — total_pages must be captured once and persisted, never
    recomputed mid-run or after a resume.
    """

    def __init__(
        self,
        checkpoint_file: Path,
    ) -> None:
        self.checkpoint_file = checkpoint_file

    def load(self) -> dict:
        """Return the saved cursor state, or fresh defaults."""

        if not self.checkpoint_file.exists():
            return {
                "created_at_since": None,
                "page_number": 1,
                "total_pages": None,
            }

        with self.checkpoint_file.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        return {
            "created_at_since": data.get("created_at_since"),
            "page_number": data.get("page_number", 1),
            "total_pages": data.get("total_pages"),
        }

    def save(
        self,
        *,
        created_at_since: str,
        page_number: int,
        total_pages: int | None = None,
    ) -> None:
        """Save the current cursor, page number, and fixed total_pages."""

        with self.checkpoint_file.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "created_at_since": created_at_since,
                    "page_number": page_number,
                    "total_pages": total_pages,
                },
                file,
                indent=4,
            )

    def reset(self) -> None:
        """Delete checkpoint after successful download."""

        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()


class IdBatchCheckpointManager:
    """
    Checkpoint manager for exhaustive ID-based batch scanning.

    AniList has no `id_greater` filter on media, and page*perPage
    pagination is capped at 5000 entries per query/filter combination.
    The reliable way to enumerate the entire catalog is to scan every
    possible AniList ID directly via batched Media(id: X) lookups (IDs
    are shared and sequential across anime+manga, with gaps where an ID
    doesn't exist or belongs to an anime). Stores the next ID to scan,
    the highest ID known to exist at scan-start time, and a page number
    used only for output filenames.
    """

    def __init__(
        self,
        checkpoint_file: Path,
    ) -> None:
        self.checkpoint_file = checkpoint_file

    def load(self) -> dict:
        """Return the saved scan state, or fresh defaults."""

        if not self.checkpoint_file.exists():
            return {
                "next_id": 1,
                "max_id": None,
                "page_number": 1,
            }

        with self.checkpoint_file.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        return {
            "next_id": data.get("next_id", 1),
            "max_id": data.get("max_id"),
            "page_number": data.get("page_number", 1),
        }

    def save(
        self,
        *,
        next_id: int,
        max_id: int,
        page_number: int,
    ) -> None:
        """Save the current scan position."""

        with self.checkpoint_file.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "next_id": next_id,
                    "max_id": max_id,
                    "page_number": page_number,
                },
                file,
                indent=4,
            )

    def reset(self) -> None:
        """Delete checkpoint after successful download."""

        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()


class PartitionCheckpointManager:
    """
    Checkpoint manager for adaptive partition-based crawling.

    Used for sources like MangaUpdates where no single pagination
    method can reach the full catalog (search results are capped at
    10000 hits per filter combination). The crawl works through a
    queue of filter partitions (e.g. type=Manga + letter=A); any
    partition reporting exactly 10000 hits is assumed possibly-capped
    and gets split into finer sub-partitions (e.g. by year) which are
    pushed back onto the queue instead of being downloaded directly.

    Stores the remaining partition queue, the partition currently being
    downloaded (if any) and its in-progress page number, and the next
    output page number to use for filenames.
    """

    def __init__(
        self,
        checkpoint_file: Path,
    ) -> None:
        self.checkpoint_file = checkpoint_file

    def load(self) -> dict:
        """Return the saved crawl state, or None if starting fresh."""

        if not self.checkpoint_file.exists():
            return None

        with self.checkpoint_file.open(
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    def save(
        self,
        *,
        queue: list[dict],
        current_partition: dict | None,
        current_page: int,
        next_output_page: int,
        partitions_completed: int = 0,
    ) -> None:
        """Save the current crawl state."""

        with self.checkpoint_file.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "queue": queue,
                    "current_partition": current_partition,
                    "current_page": current_page,
                    "next_output_page": next_output_page,
                "partitions_completed": partitions_completed,
                },                file,
                indent=4,
            )

    def reset(self) -> None:
        """Delete checkpoint after successful download."""

        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()

