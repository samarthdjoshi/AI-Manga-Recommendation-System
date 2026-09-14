"""End-to-end authentication and favorites tests with an isolated SQLite DB."""

from __future__ import annotations

from collections.abc import Generator

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from api.main import app
from auth.database import Base, get_db
from common.config import settings


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


def register(client: TestClient, email: str, username: str) -> str:
    response = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "safe-password-123"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_registration_login_and_me_persist(client: TestClient) -> None:
    token = register(client, "reader@example.com", "reader")
    me = client.get("/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "reader@example.com"

    login = client.post(
        "/auth/login",
        json={"email": "reader@example.com", "password": "safe-password-123"},
    )
    assert login.status_code == 200
    assert client.get("/auth/me", headers=auth_header(login.json()["access_token"])).status_code == 200


def test_auth_rejects_missing_bad_and_malformed_subject_tokens(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_header("not-a-token")).status_code == 401

    malformed_subject = jwt.encode(
        {"sub": "not-an-id"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    assert client.get("/auth/me", headers=auth_header(malformed_subject)).status_code == 401


def test_favorites_persist_reject_duplicates_and_unknown_titles(client: TestClient) -> None:
    token = register(client, "favorite@example.com", "favorite")
    headers = auth_header(token)

    assert client.post("/auth/favorites/anilist:30002", headers=headers).status_code == 201
    favorites = client.get("/auth/favorites", headers=headers)
    assert favorites.status_code == 200
    assert favorites.json()["favorites"][0]["gold_id"] == "anilist:30002"

    assert client.post("/auth/favorites/anilist:30002", headers=headers).status_code == 400
    assert client.post("/auth/favorites/anilist:does-not-exist", headers=headers).status_code == 404

    assert client.delete("/auth/favorites/anilist:30002", headers=headers).status_code == 204
    assert client.get("/auth/favorites", headers=headers).json()["count"] == 0
    assert client.delete("/auth/favorites/anilist:30002", headers=headers).status_code == 404


def test_favorites_are_isolated_between_users(client: TestClient) -> None:
    first_headers = auth_header(register(client, "first@example.com", "first"))
    second_headers = auth_header(register(client, "second@example.com", "second"))

    assert client.post("/auth/favorites/anilist:30002", headers=first_headers).status_code == 201
    assert client.get("/auth/favorites", headers=second_headers).json()["favorites"] == []
    assert client.delete("/auth/favorites/anilist:30002", headers=second_headers).status_code == 404
    assert client.get("/auth/favorites", headers=first_headers).json()["count"] == 1


def test_tracking_persists_validates_and_isolated_between_users(client: TestClient) -> None:
    first_headers = auth_header(register(client, "tracker@example.com", "tracker"))
    second_headers = auth_header(register(client, "other@example.com", "other"))
    payload = {
        "status": "reading",
        "progress": 42,
        "score": 9.5,
        "notes": "  Reading with friends.  ",
    }

    saved = client.put("/auth/tracking/anilist:30002", headers=first_headers, json=payload)
    assert saved.status_code == 200
    assert saved.json() == {
        **payload,
        "notes": "Reading with friends.",
        "gold_id": "anilist:30002",
        "updated_at": saved.json()["updated_at"],
    }
    assert client.get("/auth/tracking", headers=first_headers).json()["entries"][0]["progress"] == 42

    assert client.put(
        "/auth/tracking/anilist:30002", headers=first_headers, json={"status": "completed", "progress": 380}
    ).status_code == 200
    assert client.get("/auth/tracking", headers=second_headers).json()["entries"] == []
    assert client.delete("/auth/tracking/anilist:30002", headers=second_headers).status_code == 404
    assert client.put(
        "/auth/tracking/anilist:does-not-exist", headers=first_headers, json={}
    ).status_code == 404
    assert client.put(
        "/auth/tracking/anilist:30002", headers=first_headers, json={"progress": -1}
    ).status_code == 422
    assert client.delete("/auth/tracking/anilist:30002", headers=first_headers).status_code == 204
