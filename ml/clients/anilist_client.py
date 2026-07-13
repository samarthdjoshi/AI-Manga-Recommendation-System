from __future__ import annotations

from ml.clients.base_client import BaseAPIClient
from ml.clients.endpoints import ANILIST_GRAPHQL_URL
from ml.clients.queries import (
    MANGA_PAGE_QUERY,
    MAX_MANGA_ID_QUERY,
    MEDIA_BATCH_QUERY,
)


class AniListClient(BaseAPIClient):
    """Client for the AniList GraphQL API."""

    def __init__(self) -> None:
        # AniList enforces ~30 requests/minute — stricter than the
        # shared default. 2.2s per request keeps us safely under that
        # (~27 req/min) for the duration of a long full-catalog scan.
        super().__init__(
            base_url=ANILIST_GRAPHQL_URL,
            request_delay_seconds=2.2,
        )

    def get_manga_page(
        self,
        *,
        page: int,
        per_page: int = 50,
    ) -> dict:
        """
        Legacy page/perPage method. Kept for reference only — AniList
        caps page * perPage at 5000 entries, and with no explicit sort
        this defaults to POPULARITY_DESC/SCORE_DESC rather than ID
        order, so it cannot produce a complete, gap-free catalog.
        """

        response = self.post(
            json={
                "query": MANGA_PAGE_QUERY,
                "variables": {
                    "page": page,
                    "perPage": per_page,
                },
            }
        )

        return response.json()

    def get_max_manga_id(self) -> int:
        """Return the highest AniList ID currently assigned to a manga."""

        response = self.post(json={"query": MAX_MANGA_ID_QUERY})
        data = response.json()

        media = data["data"]["Page"]["media"]

        return media[0]["id"] if media else 0

    def get_manga_batch(self, ids: list[int]) -> dict:
        """
        Look up many manga IDs in one request via id_in on the list
        field `media`. IDs that don't exist, or belong to an anime,
        are simply absent from the results — no error, unlike the
        singular Media(id:) field.
        """

        response = self.post(
            json={
                "query": MEDIA_BATCH_QUERY,
                "variables": {
                    "ids": ids,
                    "perPage": len(ids),
                },
            }
        )

        return response.json()

    @staticmethod
    def extract_batch_media(response: dict) -> list[dict]:
        """Return the manga entries found for the requested ID batch."""

        return response["data"]["Page"]["media"]

    @staticmethod
    def get_page_info(response: dict) -> dict:
        """Return AniList page information (legacy page method only)."""

        return response["data"]["Page"]["pageInfo"]

    @staticmethod
    def get_media(response: dict) -> list[dict]:
        """Return manga list (legacy page method only)."""

        return response["data"]["Page"]["media"]
