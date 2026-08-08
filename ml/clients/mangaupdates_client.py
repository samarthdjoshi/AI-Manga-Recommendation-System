"""
Client for the MangaUpdates REST API.

No authentication is required for public series search/read endpoints.
Their Acceptable Use Policy asks for "reasonable spacing between
requests" without a specific number, so this client is deliberately
conservative (1s/request, ~60/min) out of courtesy, similar to Jikan.
"""

from __future__ import annotations

from ml.clients.base_client import BaseAPIClient
from ml.clients.endpoints import MANGAUPDATES_API_URL


class MangaUpdatesClient(BaseAPIClient):
    """Client for the MangaUpdates series search and detail endpoints."""

    def __init__(self) -> None:
        super().__init__(
            base_url=MANGAUPDATES_API_URL,
            request_delay_seconds=1.0,
        )

    def search_series(self, filters: dict) -> dict:
        """
        Search series with the given filter body (page, perpage, letter,
        type, year, etc). See SeriesSearchRequestV1 in their OpenAPI spec
        for the full field list.
        """

        response = self.post("series/search", json=filters)

        return response.json()

    @staticmethod
    def get_total_hits(response: dict) -> int:
        """
        Return the reported hit count for a search.

        NOTE: MangaUpdates (Elasticsearch-backed) reports exactly 10000
        when the true count is 10000 OR MORE — it does not distinguish
        "exactly 10000" from "capped at 10000". Any filter combination
        reporting this value should be treated as still needing further
        partitioning, not taken as a literal count.
        """

        return response.get("total_hits", 0)

    @staticmethod
    def get_results(response: dict) -> list[dict]:
        """Return the list of series records from a search response."""

        return [r["record"] for r in response.get("results", [])]
