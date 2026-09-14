"""
AniList GraphQL Discovery Provider.
Provides real-time discovery feeds for Trending, Popular, Top 100, and Manhwa.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from common.logger import get_logger
from services.manga_discovery.base import BaseDiscoveryProvider
from services.manga_discovery.schemas import MangaDiscoveryItem

logger = get_logger(__name__)

ANILIST_API_URL = "https://graphql.anilist.co"

DISCOVERY_QUERY = """
query ($page: Int, $perPage: Int, $sort: [MediaSort], $countryOfOrigin: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    media(type: MANGA, sort: $sort, countryOfOrigin: $countryOfOrigin) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      averageScore
      popularity
      trending
      status
      format
      countryOfOrigin
      genres
      description(asHtml: false)
      siteUrl
      staff(perPage: 6) {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
    }
  }
}
"""


def _strip_html(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned if cleaned else None


def _normalize_anilist_media(media: dict[str, Any], default_rank: int | None = None) -> MangaDiscoveryItem:
    titles = media.get("title") or {}
    primary_title = titles.get("english") or titles.get("romaji") or titles.get("native") or "Untitled"
    
    alternatives: list[str] = []
    for candidate in [titles.get("english"), titles.get("romaji"), titles.get("native")]:
        if candidate and candidate != primary_title and candidate not in alternatives:
            alternatives.append(candidate)

    cover = (media.get("coverImage") or {}).get("extraLarge") or (media.get("coverImage") or {}).get("large")
    banner = media.get("bannerImage")
    raw_score = media.get("averageScore")
    normalized_score = round(raw_score / 10.0, 2) if raw_score is not None else None

    # Parse staff for author / artist
    authors: list[str] = []
    artists: list[str] = []
    staff_edges = (media.get("staff") or {}).get("edges") or []
    for edge in staff_edges:
        role = (edge.get("role") or "").lower()
        name = ((edge.get("node") or {}).get("name") or {}).get("full")
        if not name:
            continue
        if ("story" in role or "original" in role or "author" in role) and name not in authors:
            authors.append(name)
        if ("art" in role or "illustration" in role or "artist" in role) and name not in artists:
            artists.append(name)

    return MangaDiscoveryItem(
        external_id=str(media["id"]),
        provider="anilist",
        title=primary_title,
        alternative_titles=alternatives,
        cover_url=cover,
        banner_url=banner,
        score=normalized_score,
        popularity=media.get("popularity"),
        rank=default_rank,
        trend=media.get("trending"),
        status=media.get("status"),
        type=media.get("format") or "MANGA",
        genres=media.get("genres") or [],
        authors=authors,
        artists=artists,
        demographic=None,
        description=_strip_html(media.get("description")),
        country=media.get("countryOfOrigin"),
        source_url=media.get("siteUrl") or f"https://anilist.co/manga/{media['id']}",
        gold_id=f"anilist:{media['id']}",
    )


class AniListDiscoveryProvider(BaseDiscoveryProvider):
    """Fetches real-time discovery feeds from AniList."""

    def __init__(self, timeout_seconds: float = 10.0) -> None:
        self.timeout = timeout_seconds

    @property
    def name(self) -> str:
        return "anilist"

    def _execute_query(self, variables: dict[str, Any]) -> list[dict[str, Any]]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AI-Manga-Recommendation-System/0.1.0",
        }
        payload = {
            "query": DISCOVERY_QUERY,
            "variables": variables,
        }
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(ANILIST_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return ((data.get("data") or {}).get("Page") or {}).get("media") or []

    def get_trending(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        raw_items = self._execute_query({
            "page": page,
            "perPage": min(limit, 50),
            "sort": ["TRENDING_DESC", "POPULARITY_DESC"],
        })
        return [_normalize_anilist_media(m, default_rank=idx + 1 + (page - 1) * limit) for idx, m in enumerate(raw_items)]

    def get_popular(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        raw_items = self._execute_query({
            "page": page,
            "perPage": min(limit, 50),
            "sort": ["POPULARITY_DESC"],
        })
        return [_normalize_anilist_media(m, default_rank=idx + 1 + (page - 1) * limit) for idx, m in enumerate(raw_items)]

    def get_top_100(self, limit: int = 100, page: int = 1) -> list[MangaDiscoveryItem]:
        raw_items = self._execute_query({
            "page": page,
            "perPage": min(limit, 100),
            "sort": ["SCORE_DESC"],
        })
        return [_normalize_anilist_media(m, default_rank=idx + 1 + (page - 1) * limit) for idx, m in enumerate(raw_items)]

    def get_popular_manhwa(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        raw_items = self._execute_query({
            "page": page,
            "perPage": min(limit, 50),
            "countryOfOrigin": "KR",
            "sort": ["POPULARITY_DESC"],
        })
        return [_normalize_anilist_media(m, default_rank=idx + 1 + (page - 1) * limit) for idx, m in enumerate(raw_items)]
