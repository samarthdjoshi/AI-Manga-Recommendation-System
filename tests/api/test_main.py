"""
Fast FastAPI contract tests using the deterministic in-memory test catalog.

The separate real-catalog smoke test validates the on-disk Gold/FAISS assets
when explicitly requested, without making ordinary endpoint tests memory-heavy.
"""
from fastapi.testclient import TestClient

from api.main import app, extract_current_user_id_from_auth_token

# A real, indexed gold_id confirmed present in this dataset (Berserk).
KNOWN_GOLD_ID = "anilist:30002"


def test_health_ok():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["total_gold_records"] > 0
        assert body["indexed_records"] > 0


def test_extract_current_user_id_from_invalid_auth_token_returns_none():
    assert extract_current_user_id_from_auth_token("not-a-jwt") is None


def test_search_requires_query():
    with TestClient(app) as client:
        response = client.get("/search")
        assert response.status_code == 422


def test_search_returns_results():
    with TestClient(app) as client:
        response = client.get("/search", params={"q": "one piece", "limit": 5})
        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "one piece"
        assert body["count"] <= 5
        assert isinstance(body["results"], list)


def test_manga_detail_known_id():
    with TestClient(app) as client:
        response = client.get(f"/manga/{KNOWN_GOLD_ID}")
        assert response.status_code == 200
        body = response.json()
    assert body["gold_id"] == KNOWN_GOLD_ID
    assert body["title"]
    assert body["media_type"] == "Manga"
    assert body["authors"] == ["Kentaro Miura"]
    assert body["rating_combined"] == 9.4
    assert body["rating_combined_sources"] == ["anilist", "mangaupdates"]
    assert body["rating_anilist"] == 9.5
    assert body["rating_mangaupdates"] == 9.3


def test_manga_detail_unrated_title():
    with TestClient(app) as client:
        response = client.get("/manga/anilist:101")
        assert response.status_code == 200
        body = response.json()
    assert body["gold_id"] == "anilist:101"
    assert body["rating_combined"] is None
    assert body["rating_combined_sources"] == []
    assert body["rating_anilist"] is None
    assert body["rating_mangaupdates"] is None


def test_manga_detail_unknown_id_404():
    with TestClient(app) as client:
        response = client.get("/manga/anilist:not-a-real-id")
        assert response.status_code == 404


def test_recommend_known_id():
    with TestClient(app) as client:
        response = client.get(f"/recommend/{KNOWN_GOLD_ID}", params={"top_k": 5})
        assert response.status_code == 200
        body = response.json()
        assert body["query_manga"]["gold_id"] == KNOWN_GOLD_ID
        assert len(body["results"]) <= 5
        # The query manga itself should never appear in its own recommendations.
        assert all(r["gold_id"] != KNOWN_GOLD_ID for r in body["results"])


def test_recommend_unknown_id_404():
    with TestClient(app) as client:
        response = client.get("/recommend/anilist:not-a-real-id")
        assert response.status_code == 404


def test_genres_returns_list():
    with TestClient(app) as client:
        response = client.get("/genres")
        assert response.status_code == 200
        genres = response.json()["genres"]
        assert isinstance(genres, list)
        assert "Action" in genres


def test_browse_default_returns_paginated_results():
    with TestClient(app) as client:
        response = client.get("/browse", params={"limit": 5})
        assert response.status_code == 200
        body = response.json()
        assert body["count"] <= 5
        assert body["total"] > 0


def test_browse_hide_explicit_reduces_or_equal_total():
    with TestClient(app) as client:
        hidden = client.get("/browse", params={"hide_explicit": "true", "limit": 1}).json()
        shown = client.get("/browse", params={"hide_explicit": "false", "limit": 1}).json()
        assert hidden["total"] <= shown["total"]


def test_browse_genre_or_match_returns_more_than_and_match():
    with TestClient(app) as client:
        and_result = client.get(
            "/browse", params=[("genre", "Action"), ("genre", "Drama"), ("genre_match", "and"), ("limit", 1)]
        ).json()
        or_result = client.get(
            "/browse", params=[("genre", "Action"), ("genre", "Drama"), ("genre_match", "or"), ("limit", 1)]
        ).json()
        assert or_result["total"] >= and_result["total"]


def test_search_whitespace_query_returns_empty_results():
    with TestClient(app) as client:
        response = client.get("/search", params={"q": "   ", "limit": 5})
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 0
        assert body["results"] == []


def test_browse_inverted_year_range_returns_zero_results():
    with TestClient(app) as client:
        response = client.get("/browse", params={"year_min": 2025, "year_max": 2010})
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 0
        assert body["total"] == 0


def test_browse_genre_whitespace_normalization():
    with TestClient(app) as client:
        response = client.get("/browse", params=[("genre", "  Action  ")])
        assert response.status_code == 200
        body = response.json()
        assert body["total"] > 0


def test_browse_offset_beyond_total_returns_empty_page():
    with TestClient(app) as client:
        response = client.get("/browse", params={"offset": 99999})
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 0
        assert body["results"] == []
