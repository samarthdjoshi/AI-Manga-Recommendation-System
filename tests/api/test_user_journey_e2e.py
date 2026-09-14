"""
Maintainable end-to-end user journey test:
Registration -> Login -> Catalog Search & Detail -> Favorite & Tracking ->
Profile Data Validation -> Chat Integration -> Removal.
"""

from __future__ import annotations

from collections.abc import Generator
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import api.main as api_main
from api.main import app
from auth.database import Base, get_db


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db() -> Generator[Session, None, None]:
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_complete_user_journey_e2e(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # 1. User Registration & Login
    reg_resp = client.post(
        "/auth/register",
        json={"email": "journey@example.com", "username": "journey_user", "password": "secure_password_99"},
    )
    assert reg_resp.status_code == 201
    auth_data = reg_resp.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /auth/me returns the registered user
    me_resp = client.get("/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "journey_user"

    # 2. Browse & Search Catalog
    search_resp = client.get("/search", params={"q": "Berserk"})
    assert search_resp.status_code == 200
    results = search_resp.json()["results"]
    assert len(results) > 0
    berserk_id = results[0]["gold_id"]
    assert berserk_id == "anilist:30002"

    # 3. View Manga Detail (verifying MangaMeter & VibeChart data presence)
    detail_resp = client.get(f"/manga/{berserk_id}")
    assert detail_resp.status_code == 200
    manga_detail = detail_resp.json()
    assert manga_detail["title"] == "Berserk"
    # Manga Meter data
    assert manga_detail["rating_combined"] is not None
    assert "anilist" in manga_detail["rating_combined_sources"]
    assert manga_detail["rating_anilist"] is not None
    # Vibe Chart data
    assert len(manga_detail["genres"]) > 0

    # 4. Add to Favorites
    fav_add = client.post(f"/auth/favorites/{berserk_id}", headers=headers)
    assert fav_add.status_code == 201
    assert fav_add.json()["gold_id"] == berserk_id

    # 5. Add to Tracking (Status: Reading, chapters=50, score=9.5, private notes)
    track_add = client.put(
        f"/auth/tracking/{berserk_id}",
        json={"status": "reading", "progress": 50, "score": 9.5, "notes": "Masterpiece manga"},
        headers=headers,
    )
    assert track_add.status_code == 200
    track_data = track_add.json()
    assert track_data["status"] == "reading"
    assert track_data["progress"] == 50
    assert track_data["score"] == 9.5
    assert track_data["notes"] == "Masterpiece manga"

    # 6. Verify User's Tracking & Favorites
    list_fav = client.get("/auth/favorites", headers=headers)
    assert list_fav.status_code == 200
    assert any(f["gold_id"] == berserk_id for f in list_fav.json()["favorites"])

    list_track = client.get("/auth/tracking", headers=headers)
    assert list_track.status_code == 200
    entries = list_track.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["gold_id"] == berserk_id
    assert entries[0]["status"] == "reading"

    # 7. Update Tracking to "Completed"
    track_update = client.put(
        f"/auth/tracking/{berserk_id}",
        json={"status": "completed", "progress": 380, "score": 10.0, "notes": "Finished reading"},
        headers=headers,
    )
    assert track_update.status_code == 200
    assert track_update.json()["status"] == "completed"
    assert track_update.json()["progress"] == 380
    assert track_update.json()["score"] == 10.0

    # 8. Chat Integration with User Authorization Header
    captured_chat_context: dict[str, object] = {}

    def mock_chat_agent(**kwargs):
        captured_chat_context.update(kwargs)
        return "Here is a recommendation based on your completed favorites.", [
            {"gold_id": berserk_id, "title": "Berserk", "cover_image_url": None, "year": 1989}
        ]

    monkeypatch.setattr(api_main, "get_chat_retriever", lambda: SimpleNamespace())
    monkeypatch.setattr(api_main, "run_agent_chat", mock_chat_agent)

    chat_resp = client.post(
        "/chat",
        json={"message": "recommend something like my favorites"},
        headers=headers,
    )
    assert chat_resp.status_code == 200
    chat_json = chat_resp.json()
    assert "Here is a recommendation" in chat_json["reply"]
    assert len(chat_json["sources"]) == 1
    # Verify the current user id was extracted and passed into the agent
    assert captured_chat_context.get("current_user_id") == auth_data["user"]["id"]

    # 9. Cleanup & Removal
    del_fav = client.delete(f"/auth/favorites/{berserk_id}", headers=headers)
    assert del_fav.status_code == 204

    del_track = client.delete(f"/auth/tracking/{berserk_id}", headers=headers)
    assert del_track.status_code == 204

    # Verify empty lists
    assert len(client.get("/auth/favorites", headers=headers).json()["favorites"]) == 0
    assert len(client.get("/auth/tracking", headers=headers).json()["entries"]) == 0
