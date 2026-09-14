"""
Manga Discovery Service Orchestrator.
Manages feed caching, provider switching, and seamless fallback to local catalog.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from common.logger import get_logger
from services.manga_discovery.base import BaseDiscoveryProvider
from services.manga_discovery.cache import DiscoveryCache
from services.manga_discovery.providers.anilist import AniListDiscoveryProvider
from services.manga_discovery.providers.local_fallback import LocalFallbackProvider
from services.manga_discovery.schemas import DiscoveryFeedResponse, MangaDiscoveryItem

if TYPE_CHECKING:
    from ml.recommender.service import RecommenderService

logger = get_logger(__name__)

# Default TTLs (seconds)
TTL_TRENDING = 900       # 15 mins
TTL_POPULAR = 3600       # 1 hour
TTL_TOP_100 = 7200       # 2 hours
TTL_MANHWA = 3600        # 1 hour


class MangaDiscoveryService:
    """Central orchestrator for all discovery feeds."""

    def __init__(
        self,
        primary_provider: BaseDiscoveryProvider | None = None,
        fallback_provider: BaseDiscoveryProvider | None = None,
        cache: DiscoveryCache | None = None,
    ) -> None:
        self.primary = primary_provider or AniListDiscoveryProvider()
        self.fallback = fallback_provider
        self.cache = cache or DiscoveryCache()

    def set_fallback_service(self, local_recommender: RecommenderService) -> None:
        """Configure local Gold fallback provider from running RecommenderService."""
        self.fallback = LocalFallbackProvider(local_recommender)

    def _fetch_feed(
        self,
        feed_type: str,
        ttl_seconds: int,
        limit: int,
        page: int,
        fetcher_method_name: str,
    ) -> DiscoveryFeedResponse:
        cache_key = f"{feed_type}:{limit}:{page}"
        cached_data, is_stale = self.cache.get(cache_key)

        if cached_data is not None and not is_stale:
            return DiscoveryFeedResponse(
                feed_type=feed_type,
                provider=self.primary.name,
                total=len(cached_data),
                page=page,
                per_page=limit,
                cached=True,
                results=cached_data,
            )

        # Attempt primary provider
        try:
            method = getattr(self.primary, fetcher_method_name)
            results: list[MangaDiscoveryItem] = method(limit=limit, page=page)
            if results:
                self.cache.set(cache_key, results, ttl_seconds)
                return DiscoveryFeedResponse(
                    feed_type=feed_type,
                    provider=self.primary.name,
                    total=len(results),
                    page=page,
                    per_page=limit,
                    cached=False,
                    results=results,
                )
        except Exception as exc:  # noqa: BLE001 - resilience boundary: never crash on external provider errors
            logger.warning(
                f"[discovery] Primary provider '{self.primary.name}' failed for {feed_type}: {exc}. "
                "Attempting fallback."
            )

        # If primary failed, check if we have stale cached data
        if cached_data is not None:
            logger.info(f"[discovery] Serving stale cached data for {cache_key}")
            return DiscoveryFeedResponse(
                feed_type=feed_type,
                provider=self.primary.name,
                total=len(cached_data),
                page=page,
                per_page=limit,
                cached=True,
                results=cached_data,
            )

        # Fallback to local Gold catalog
        if self.fallback is not None:
            try:
                fallback_method = getattr(self.fallback, fetcher_method_name)
                fallback_results: list[MangaDiscoveryItem] = fallback_method(limit=limit, page=page)
                return DiscoveryFeedResponse(
                    feed_type=feed_type,
                    provider=self.fallback.name,
                    total=len(fallback_results),
                    page=page,
                    per_page=limit,
                    cached=False,
                    results=fallback_results,
                )
            except Exception as fb_exc:  # noqa: BLE001 - resilience boundary: never crash on fallback errors
                logger.error(f"[discovery] Fallback provider failed for {feed_type}: {fb_exc}")

        # Ultimate graceful response: empty feed instead of crashing
        return DiscoveryFeedResponse(
            feed_type=feed_type,
            provider="none",
            total=0,
            page=page,
            per_page=limit,
            cached=False,
            results=[],
        )

    def get_trending(self, limit: int = 20, page: int = 1) -> DiscoveryFeedResponse:
        return self._fetch_feed("trending", TTL_TRENDING, limit, page, "get_trending")

    def get_popular(self, limit: int = 20, page: int = 1) -> DiscoveryFeedResponse:
        return self._fetch_feed("popular", TTL_POPULAR, limit, page, "get_popular")

    def get_top_100(self, limit: int = 100, page: int = 1) -> DiscoveryFeedResponse:
        return self._fetch_feed("top_100", TTL_TOP_100, limit, page, "get_top_100")

    def get_popular_manhwa(self, limit: int = 20, page: int = 1) -> DiscoveryFeedResponse:
        return self._fetch_feed("manhwa", TTL_MANHWA, limit, page, "get_popular_manhwa")
