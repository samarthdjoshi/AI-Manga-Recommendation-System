"""
API routes for live internet manga discovery feeds.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Query

from services.manga_discovery.schemas import DiscoveryFeedResponse
from services.manga_discovery.service import MangaDiscoveryService

if TYPE_CHECKING:
    from ml.recommender.service import RecommenderService

router = APIRouter(prefix="/discovery", tags=["Discovery"])

discovery_service = MangaDiscoveryService()


def configure_discovery_fallback(recommender: RecommenderService) -> None:
    """Wire in the local RecommenderService as the discovery fallback provider."""
    discovery_service.set_fallback_service(recommender)


@router.get("/trending", response_model=DiscoveryFeedResponse)
def get_trending_manga(
    limit: int = Query(20, ge=1, le=50, description="Max trending items"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
) -> DiscoveryFeedResponse:
    """Fetch real-time trending manga with caching and offline fallback."""
    return discovery_service.get_trending(limit=limit, page=page)


@router.get("/popular", response_model=DiscoveryFeedResponse)
def get_popular_manga(
    limit: int = Query(20, ge=1, le=50, description="Max popular items"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
) -> DiscoveryFeedResponse:
    """Fetch all-time popular manga."""
    return discovery_service.get_popular(limit=limit, page=page)


@router.get("/top-100", response_model=DiscoveryFeedResponse)
def get_top_100_manga(
    limit: int = Query(100, ge=1, le=100, description="Top ranked items limit"),
    page: int = Query(1, ge=1, le=10, description="Page number"),
) -> DiscoveryFeedResponse:
    """Fetch top ranked manga (#1 to #100)."""
    return discovery_service.get_top_100(limit=limit, page=page)


@router.get("/manhwa", response_model=DiscoveryFeedResponse)
def get_popular_manhwa(
    limit: int = Query(20, ge=1, le=50, description="Max manhwa items"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
) -> DiscoveryFeedResponse:
    """Fetch popular Korean manhwa / webtoons."""
    return discovery_service.get_popular_manhwa(limit=limit, page=page)

