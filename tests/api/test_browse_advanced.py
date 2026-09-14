from fastapi.testclient import TestClient
from api.main import app


def test_browse_exclude_genre():
    with TestClient(app) as client:
        # Default with genre Action has Berserk (Action, Drama, Fantasy) and One Piece (Action, Adventure)
        included = client.get("/browse", params=[("genre", "Action")]).json()
        assert included["total"] >= 2

        # Exclude Fantasy should remove Berserk but keep One Piece
        excluded = client.get(
            "/browse",
            params=[("genre", "Action"), ("exclude_genre", "Fantasy")],
        ).json()
        assert any(r["title"] == "One Piece" for r in excluded["results"])
        assert not any(r["title"] == "Berserk" for r in excluded["results"])


def test_browse_publication_status():
    with TestClient(app) as client:
        # Status completed should match One Piece (status_raw: completed)
        completed = client.get("/browse", params={"status": "completed"}).json()
        assert any(r["title"] == "One Piece" for r in completed["results"])
        assert not any(r["title"] == "Berserk" for r in completed["results"])

        # Status releasing should match Berserk (status_raw: releasing)
        releasing = client.get("/browse", params={"status": "releasing"}).json()
        assert any(r["title"] == "Berserk" for r in releasing["results"])
        assert not any(r["title"] == "One Piece" for r in releasing["results"])


def test_browse_rating_filter():
    with TestClient(app) as client:
        # Only titles with rating_combined >= 9.2 (Berserk has 9.4, One Piece has 9.1)
        high_rated = client.get("/browse", params={"min_rating": 9.2}).json()
        assert any(r["title"] == "Berserk" for r in high_rated["results"])
        assert not any(r["title"] == "One Piece" for r in high_rated["results"])


def test_browse_chapter_range():
    with TestClient(app) as client:
        # Berserk has 380 chapters, One Piece has 1100, Quiet Drama has 20
        mid_chapters = client.get(
            "/browse",
            params={"min_chapters": 100, "max_chapters": 500},
        ).json()
        assert any(r["title"] == "Berserk" for r in mid_chapters["results"])
        assert not any(r["title"] == "One Piece" for r in mid_chapters["results"])
        assert not any(r["title"] == "Quiet Drama" for r in mid_chapters["results"])


def test_browse_has_official_links():
    with TestClient(app) as client:
        # One Piece has official read links, Berserk does not in test mock
        with_links = client.get("/browse", params={"has_official_links": "true"}).json()
        assert any(r["title"] == "One Piece" for r in with_links["results"])
        assert not any(r["title"] == "Berserk" for r in with_links["results"])


def test_browse_min_sources():
    with TestClient(app) as client:
        # Berserk has 3 sources, One Piece has 2, Quiet Drama has 1
        triple_source = client.get("/browse", params={"min_sources": 3}).json()
        assert any(r["title"] == "Berserk" for r in triple_source["results"])
        assert not any(r["title"] == "One Piece" for r in triple_source["results"])


def test_browse_validation_errors():
    with TestClient(app) as client:
        # Invalid status
        assert client.get("/browse", params={"status": "invalid_status"}).status_code == 422
        # Negative min_chapters
        assert client.get("/browse", params={"min_chapters": -1}).status_code == 422
        # Negative max_chapters
        assert client.get("/browse", params={"max_chapters": -1}).status_code == 422
        # Rating out of bounds (> 10)
        assert client.get("/browse", params={"min_rating": 11.0}).status_code == 422
        # Rating out of bounds (< 0)
        assert client.get("/browse", params={"min_rating": -0.5}).status_code == 422
        # Sources out of bounds (> 3)
        assert client.get("/browse", params={"min_sources": 4}).status_code == 422


def test_browse_query_search_with_filters():
    with TestClient(app) as client:
        res = client.get("/browse", params={"q": "piece", "status": "completed"}).json()
        assert res["total"] >= 1
        assert all("piece" in r["title"].lower() for r in res["results"])
        assert any(r["title"] == "One Piece" for r in res["results"])

        # Title query matching Berserk but filtering with status=completed should return 0 results
        res2 = client.get("/browse", params={"q": "berserk", "status": "completed"}).json()
        assert res2["total"] == 0
        assert res2["results"] == []


def test_browse_hide_doujinshi():
    with TestClient(app) as client:
        # Default hide_doujinshi=True excludes doujinshi
        res = client.get("/browse", params={"hide_doujinshi": "true"}).json()
        for r in res["results"]:
            assert "doujinshi" not in [g.lower() for g in (r.get("genres") or [])]


def test_browse_sort_options():
    all_sorts = [
        "best_match",
        "latest_update",
        "recently_added",
        "title_asc",
        "title_desc",
        "year_newest",
        "year_oldest",
        "highest_rated",
        "most_viewed_7d",
        "most_viewed_30d",
        "most_viewed_90d",
        "most_viewed_all",
        "most_followed",
        # Legacy
        "rating",
        "corroborated",
        "newest",
        "title",
    ]
    with TestClient(app) as client:
        for s in all_sorts:
            res = client.get("/browse", params={"sort": s})
            assert res.status_code == 200, f"Sort '{s}' failed with status {res.status_code}"
            data = res.json()
            assert "results" in data
            assert len(data["results"]) > 0


def test_browse_sort_ordering_details():
    with TestClient(app) as client:
        # title_asc vs title_desc
        asc_res = client.get("/browse", params={"sort": "title_asc"}).json()["results"]
        desc_res = client.get("/browse", params={"sort": "title_desc"}).json()["results"]
        asc_titles = [r["title"].lower() for r in asc_res]
        desc_titles = [r["title"].lower() for r in desc_res]
        assert asc_titles == sorted(asc_titles)
        assert desc_titles == sorted(desc_titles, reverse=True)

        # year_newest vs year_oldest
        newest_res = client.get("/browse", params={"sort": "year_newest"}).json()["results"]
        oldest_res = client.get("/browse", params={"sort": "year_oldest"}).json()["results"]
        assert newest_res[0]["year"] >= newest_res[-1]["year"]
        assert oldest_res[0]["year"] <= oldest_res[-1]["year"]

        # highest_rated
        rated_res = client.get("/browse", params={"sort": "highest_rated"}).json()["results"]
        assert rated_res[0]["title"] == "Berserk"  # Berserk has 9.4, One Piece has 9.1

        # best_match with search query
        match_res = client.get("/browse", params={"sort": "best_match", "q": "Berserk"}).json()["results"]
        assert match_res[0]["title"] == "Berserk"

        # latest_update (releasing titles prioritized, Berserk is releasing vs One Piece completed)
        latest_res = client.get("/browse", params={"sort": "latest_update"}).json()["results"]
        assert latest_res[0]["title"] == "Berserk"

