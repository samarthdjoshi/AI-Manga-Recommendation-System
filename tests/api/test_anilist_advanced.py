from __future__ import annotations

from collections.abc import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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


def _register(client: TestClient, email: str, username: str, password: str = "Password123!") -> str:
    res = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_account_password_change(client: TestClient):
    token = _register(client, "user_pw@example.com", "user_pw", "OldPassword123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong current password fails
    bad_res = client.post(
        "/auth/account/password",
        headers=headers,
        json={"current_password": "WrongPassword!", "new_password": "NewPassword123!"},
    )
    assert bad_res.status_code == 400
    assert "Incorrect current password" in bad_res.json()["detail"]

    # Same new password fails
    same_res = client.post(
        "/auth/account/password",
        headers=headers,
        json={"current_password": "OldPassword123!", "new_password": "OldPassword123!"},
    )
    assert same_res.status_code == 400

    # Successful password change
    good_res = client.post(
        "/auth/account/password",
        headers=headers,
        json={"current_password": "OldPassword123!", "new_password": "BrandNewPassword123!"},
    )
    assert good_res.status_code == 200
    assert good_res.json()["message"] == "Password updated successfully"

    # Verify old password login fails
    fail_login = client.post(
        "/auth/login",
        json={"email": "user_pw@example.com", "password": "OldPassword123!"},
    )
    assert fail_login.status_code == 401

    # Verify new password login succeeds
    succ_login = client.post(
        "/auth/login",
        json={"email": "user_pw@example.com", "password": "BrandNewPassword123!"},
    )
    assert succ_login.status_code == 200
    assert "access_token" in succ_login.json()


def test_account_email_update(client: TestClient):
    token1 = _register(client, "alice_acc@example.com", "alice_acc")
    _register(client, "bob_acc@example.com", "bob_acc")
    headers = {"Authorization": f"Bearer {token1}"}

    # Conflict with existing email
    conflict_res = client.patch(
        "/auth/account",
        headers=headers,
        json={"email": "bob_acc@example.com"},
    )
    assert conflict_res.status_code == 409

    # Successful email update
    succ_res = client.patch(
        "/auth/account",
        headers=headers,
        json={"email": "alice_new@example.com"},
    )
    assert succ_res.status_code == 200
    assert succ_res.json()["email"] == "alice_new@example.com"

    # Login works with new email
    login_res = client.post(
        "/auth/login",
        json={"email": "alice_new@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200


def test_public_user_tracking_and_favorites(client: TestClient):
    token = _register(client, "reader_public@example.com", "reader_public")
    headers = {"Authorization": f"Bearer {token}"}

    # Add favorite
    fav_res = client.post("/auth/favorites/anilist:30002", headers=headers)
    assert fav_res.status_code == 201

    # Add tracking entries
    track_res = client.put(
        "/auth/tracking/anilist:30002",
        headers=headers,
        json={"status": "reading", "progress": 15, "score": 9.5},
    )
    assert track_res.status_code == 200

    track_res2 = client.put(
        "/auth/tracking/anilist:21",
        headers=headers,
        json={"status": "completed", "progress": 50, "score": 10.0},
    )
    assert track_res2.status_code == 200

    # Public user favorites endpoint
    pub_fav = client.get("/auth/users/reader_public/favorites")
    assert pub_fav.status_code == 200
    fav_data = pub_fav.json()
    assert fav_data["count"] == 1
    assert fav_data["favorites"][0]["gold_id"] == "anilist:30002"

    # Public user tracking endpoint
    pub_track = client.get("/auth/users/reader_public/tracking")
    assert pub_track.status_code == 200
    track_data = pub_track.json()
    assert track_data["count"] == 2

    # Public user tracking filtered by status
    pub_reading = client.get("/auth/users/reader_public/tracking?status=reading")
    assert pub_reading.status_code == 200
    assert pub_reading.json()["count"] == 1
    assert pub_reading.json()["entries"][0]["gold_id"] == "anilist:30002"
    assert pub_reading.json()["entries"][0]["progress"] == 15
