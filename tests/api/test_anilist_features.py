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


def _register(client: TestClient, email: str, username: str) -> str:
    res = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_profile_get_and_update(client: TestClient):
    token = _register(client, "alice_prof@example.com", "alice_prof")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial profile
    res = client.get("/auth/profile/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "alice_prof"
    assert data["score_system"] == "point_10_decimal"
    assert data["followers_count"] == 0
    assert data["following_count"] == 0

    # Update profile
    update_res = client.patch(
        "/auth/profile/me",
        headers=headers,
        json={
            "avatar_url": "https://example.com/alice.png",
            "banner_url": "https://example.com/banner.jpg",
            "bio": "Reading manga all day!",
            "score_system": "point_100",
            "title_language": "english",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["avatar_url"] == "https://example.com/alice.png"
    assert updated["banner_url"] == "https://example.com/banner.jpg"
    assert updated["bio"] == "Reading manga all day!"
    assert updated["score_system"] == "point_100"
    assert updated["title_language"] == "english"

    # Public profile access
    pub_res = client.get("/auth/users/alice_prof")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["username"] == "alice_prof"
    assert pub_data["avatar_url"] == "https://example.com/alice.png"
    assert pub_data["score_system"] == "point_100"


def test_follow_unfollow_and_notifications(client: TestClient):
    token_a = _register(client, "user_a@example.com", "user_a")
    token_b = _register(client, "user_b@example.com", "user_b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A follows User B
    follow_res = client.post("/auth/users/user_b/follow", headers=headers_a)
    assert follow_res.status_code == 200
    assert follow_res.json()["is_following"] is True
    assert follow_res.json()["followers_count"] == 1

    # Check User B's followers
    followers_b = client.get("/auth/users/user_b/followers", headers=headers_a).json()
    assert followers_b["count"] == 1
    assert followers_b["users"][0]["username"] == "user_a"

    # Check User A's following
    following_a = client.get("/auth/users/user_a/following", headers=headers_a).json()
    assert following_a["count"] == 1
    assert following_a["users"][0]["username"] == "user_b"

    # Check User B received a follow notification
    notif_b = client.get("/auth/notifications", headers=headers_b).json()
    assert notif_b["unread_count"] == 1
    assert notif_b["notifications"][0]["type"] == "follow"
    assert notif_b["notifications"][0]["actor_username"] == "user_a"

    # Mark all read for User B
    read_res = client.post("/auth/notifications/read-all", headers=headers_b)
    assert read_res.status_code == 200
    notif_b_after = client.get("/auth/notifications", headers=headers_b).json()
    assert notif_b_after["unread_count"] == 0

    # Unfollow
    unfollow_res = client.post("/auth/users/user_b/follow", headers=headers_a)
    assert unfollow_res.status_code == 200
    assert unfollow_res.json()["is_following"] is False
    assert unfollow_res.json()["followers_count"] == 0


def test_activities_and_likes_and_replies(client: TestClient):
    token_x = _register(client, "user_x@example.com", "user_x")
    token_y = _register(client, "user_y@example.com", "user_y")
    headers_x = {"Authorization": f"Bearer {token_x}"}
    headers_y = {"Authorization": f"Bearer {token_y}"}

    # User X creates an activity
    post_res = client.post(
        "/auth/activities",
        headers=headers_x,
        json={"text": "Just started reading Berserk! Amazing art."},
    )
    assert post_res.status_code == 201
    activity = post_res.json()
    activity_id = activity["id"]
    assert activity["text"] == "Just started reading Berserk! Amazing art."
    assert activity["username"] == "user_x"

    # User Y likes User X's activity
    like_res = client.post(f"/auth/activities/{activity_id}/like", headers=headers_y)
    assert like_res.status_code == 200
    assert like_res.json()["is_liked"] is True
    assert like_res.json()["like_count"] == 1

    # User Y replies to User X's activity
    reply_res = client.post(
        f"/auth/activities/{activity_id}/replies",
        headers=headers_y,
        json={"text": "Enjoy the journey! It only gets better."},
    )
    assert reply_res.status_code == 201
    reply = reply_res.json()
    assert reply["text"] == "Enjoy the journey! It only gets better."
    assert reply["username"] == "user_y"

    # User X should have notifications for like and reply
    notifs_x = client.get("/auth/notifications", headers=headers_x).json()
    assert notifs_x["unread_count"] == 2
    types = {n["type"] for n in notifs_x["notifications"]}
    assert "activity_like" in types
    assert "activity_reply" in types

    # Retrieve global activities
    act_feed = client.get("/auth/activities?feed=global", headers=headers_x).json()
    assert act_feed["count"] >= 1
    top_act = next(a for a in act_feed["activities"] if a["id"] == activity_id)
    assert top_act["like_count"] == 1
    assert top_act["replies_count"] == 1
    assert len(top_act["replies"]) == 1
    assert top_act["replies"][0]["username"] == "user_y"


def test_quick_chapter_increment(client: TestClient):
    token = _register(client, "tracker@example.com", "tracker_user")
    headers = {"Authorization": f"Bearer {token}"}

    # Increment Berserk (anilist:30002)
    inc_res = client.post("/auth/tracking/anilist:30002/increment", headers=headers)
    assert inc_res.status_code == 200
    data = inc_res.json()
    assert data["gold_id"] == "anilist:30002"
    assert data["progress"] == 1
    assert data["status"] == "reading"
    assert data["activity_created"] is True

    # Increment again
    inc_res2 = client.post("/auth/tracking/anilist:30002/increment", headers=headers)
    assert inc_res2.status_code == 200
    assert inc_res2.json()["progress"] == 2

    # Check that reading milestone activity appears in personal activity feed
    feed = client.get("/auth/activities?feed=user&username=tracker_user", headers=headers).json()
    assert feed["count"] >= 2
    manga_act = feed["activities"][0]
    assert manga_act["type"] == "manga_list"
    assert manga_act["gold_id"] == "anilist:30002"
    assert manga_act["progress"] == 2
