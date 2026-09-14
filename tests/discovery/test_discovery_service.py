from __future__ import annotations

import time
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.main import app
from services.manga_discovery.base import BaseDiscoveryProvider
from services.manga_discovery.cache import DiscoveryCache
from services.manga_discovery.providers.anilist import _normalize_anilist_media
from services.manga_discovery.providers.local_fallback import LocalFallbackProvider
from services.manga_discovery.schemas import DiscoveryFeedResponse, MangaDiscoveryItem
from services.manga_discovery.service import MangaDiscoveryService


def test_manga_discovery_item_schema() -> None:
    item = MangaDiscoveryItem(
        external_id="12345",
        provider="anilist",
        title="Chainsaw Man",
        alternative_titles=["CSM"],
        cover_url="https://example.com/cover.jpg",
        score=8.75,
        popularity=120000,
        rank=1,
        genres=["Action", "Supernatural"],
        authors=["Tatsuki Fujimoto"],
    )
    assert item.external_id == "12345"
    assert item.score == 8.75
    assert item.gold_id is None

    feed = DiscoveryFeedResponse(
        feed_type="trending",
        provider="anilist",
        total=1,
        page=1,
        per_page=20,
        results=[item],
    )
    assert feed.total == 1
    assert len(feed.results) == 1
    assert feed.results[0].title == "Chainsaw Man"


def test_discovery_cache_ttl_and_stale() -> None:
    cache = DiscoveryCache()
    cache.set("feed_key", ["item1", "item2"], ttl_seconds=1)

    val, is_stale = cache.get("feed_key")
    assert val == ["item1", "item2"]
    assert is_stale is False

    # Simulate expiration
    time.sleep(1.05)
    val_after, is_stale_after = cache.get("feed_key")
    assert val_after == ["item1", "item2"]
    assert is_stale_after is True

    # Unknown key
    empty_val, is_empty_stale = cache.get("nonexistent")
    assert empty_val is None
    assert is_empty_stale is True


def test_anilist_media_normalization() -> None:
    raw_media = {
        "id": 105398,
        "title": {
            "romaji": "Chainsaw Man",
            "english": "Chainsaw Man",
            "native": "チェンソーマン",
        },
        "coverImage": {
            "extraLarge": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398.jpg",
            "large": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398_lg.jpg",
        },
        "averageScore": 87,
        "popularity": 195000,
        "trending": 45,
        "status": "RELEASING",
        "format": "MANGA",
        "countryOfOrigin": "JP",
        "genres": ["Action", "Comedy", "Drama", "Horror", "Supernatural"],
        "description": "<p>Denji was a small-time devil hunter...</p><br>",
        "siteUrl": "https://anilist.co/manga/105398",
        "staff": {
            "edges": [
                {
                    "role": "Story & Art",
                    "node": {"name": {"full": "Tatsuki Fujimoto"}},
                }
            ]
        },
    }

    item = _normalize_anilist_media(raw_media, default_rank=1)
    assert item.external_id == "105398"
    assert item.title == "Chainsaw Man"
    assert "チェンソーマン" in item.alternative_titles
    assert item.score == 8.7
    assert item.popularity == 195000
    assert item.rank == 1
    assert item.trend == 45
    assert item.genres == ["Action", "Comedy", "Drama", "Horror", "Supernatural"]
    assert item.authors == ["Tatsuki Fujimoto"]
    assert item.artists == ["Tatsuki Fujimoto"]
    assert item.gold_id == "anilist:105398"
    assert "<p>" not in (item.description or "")


def test_local_fallback_provider() -> None:
    mock_recommender = MagicMock()
    mock_recommender.discover.return_value = [
        {
            "gold_id": "test:1",
            "title": "One Piece",
            "rating_combined": 9.2,
            "source_count": 3,
            "genres": ["Action", "Adventure"],
            "authors": ["Eiichiro Oda"],
            "artists": ["Eiichiro Oda"],
            "cover_image_url": "https://example.com/op.jpg",
        }
    ]
    mock_recommender.browse.return_value = (
        [
            {
                "gold_id": "test:2",
                "title": "Solo Leveling",
                "rating_combined": 8.9,
                "source_count": 2,
                "genres": ["Action", "Manhwa"],
                "cover_image_url": "https://example.com/sl.jpg",
            }
        ],
        1,
    )

    provider = LocalFallbackProvider(mock_recommender)
    trending = provider.get_trending(limit=5)
    assert len(trending) == 1
    assert trending[0].title == "One Piece"
    assert trending[0].score == 9.2
    assert trending[0].provider == "local_gold"

    manhwa = provider.get_popular_manhwa(limit=5)
    assert len(manhwa) == 1
    assert manhwa[0].title == "Solo Leveling"


def test_discovery_service_fallback_on_primary_error() -> None:
    failing_primary = MagicMock(spec=BaseDiscoveryProvider)
    failing_primary.name = "failing_primary"
    failing_primary.get_trending.side_effect = RuntimeError("AniList API connection timeout")

    mock_recommender = MagicMock()
    mock_recommender.discover.return_value = [
        {
            "gold_id": "test:fallback",
            "title": "Berserk",
            "rating_combined": 9.4,
            "source_count": 3,
            "genres": ["Action", "Dark Fantasy"],
        }
    ]
    fallback_provider = LocalFallbackProvider(mock_recommender)

    svc = MangaDiscoveryService(
        primary_provider=failing_primary,
        fallback_provider=fallback_provider,
    )

    feed = svc.get_trending(limit=10)
    assert feed.feed_type == "trending"
    assert feed.provider == "local_gold"
    assert len(feed.results) == 1
    assert feed.results[0].title == "Berserk"


def test_api_discovery_endpoints() -> None:
    client = TestClient(app)

    for path in ["/discovery/trending", "/discovery/popular", "/discovery/top-100", "/discovery/manhwa"]:
        resp = client.get(f"{path}?limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "feed_type" in data
        assert "results" in data
        assert isinstance(data["results"], list)


def test_api_discovery_validation_edges() -> None:
    client = TestClient(app)

    # Negative limit
    assert client.get("/discovery/trending?limit=-1").status_code == 422
    # Zero limit
    assert client.get("/discovery/trending?limit=0").status_code == 422
    # Exceeded limit
    assert client.get("/discovery/trending?limit=51").status_code == 422
    # Zero page
    assert client.get("/discovery/trending?page=0").status_code == 422
    # Exceeded page
    assert client.get("/discovery/trending?page=51").status_code == 422
    # Non-integer query
    assert client.get("/discovery/trending?limit=abc").status_code == 422
    # Top 100 limit over 100
    assert client.get("/discovery/top-100?limit=101").status_code == 422
    # Top 100 page over 10
    assert client.get("/discovery/top-100?page=11").status_code == 422

