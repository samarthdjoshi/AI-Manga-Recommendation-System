"""
Client for the MangaDex REST API.

MangaDex requires a genuine, non-spoofed User-Agent header on all
requests. No authentication is required for public manga metadata.
"""

from __future__ import annotations

from common.config import settings
from ml.clients.base_client import BaseAPIClient
from ml.clients.endpoints import MANGADEX_API_URL


class MangaDexClient(BaseAPIClient):
    """Client for the MangaDex manga metadata endpoints."""

    def __init__(self) -> None:
        super().__init__(
            base_url=MANGADEX_API_URL,
            headers={"User-Agent": settings.USER_AGENT},
        )

    def get_manga_page(
        self,
        *,
        created_at_since: str | None = None,
        limit: int = 100,
    ) -> dict:
        """
        Download one page of manga, ordered by creation date ascending.

        Uses a createdAtSince cursor instead of offset/limit pagination
        because MangaDex caps offset + limit at 10,000, which is far
        below the total number of manga on the platform. Cursor-based
        pagination has no such cap.

        Includes cover art, author, and artist relationships expanded
        inline so no follow-up requests are needed per manga. Tags,
        content rating, publication demographic, and alternative titles
        are already embedded directly in each manga's attributes.
        """

        params: dict[str, object] = {
            "limit": limit,
            "order[createdAt]": "asc",
            "includes[]": ["cover_art", "author", "artist"],
            "contentRating[]": [
                "safe",
                "suggestive",
                "erotica",
                "pornographic",
            ],
        }

        if created_at_since:
            params["createdAtSince"] = self._normalize_timestamp(created_at_since)

        response = self.get("manga", params=params)

        return response.json()

    @staticmethod
    def _normalize_timestamp(timestamp: str) -> str:
        """
        MangaDex returns createdAt values with a timezone offset
        (e.g. '2018-01-20T04:14:26+00:00'), but its own createdAtSince
        filter rejects that exact format with a 400 error — it only
        accepts a bare 'YYYY-MM-DDTHH:mm:ss' with no offset or
        milliseconds. Strip anything from '+' or '.' onward.
        """

        timestamp = timestamp.split("+")[0]
        timestamp = timestamp.split(".")[0]
        timestamp = timestamp.rstrip("Z")
        return timestamp

    @staticmethod
    def get_data(response: dict) -> list[dict]:
        """Return the list of manga objects from a page response."""

        return response.get("data", [])

    @staticmethod
    def get_total(response: dict) -> int:
        """Return the total number of manga matching the query."""

        return response.get("total", 0)
