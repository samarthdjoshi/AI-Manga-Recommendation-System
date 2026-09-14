import io
import xml.etree.ElementTree as ET
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from api.main import app
from auth.database import Base, get_db

SAMPLE_MAL_XML = """<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo><user_export_type>2</user_export_type></myinfo>
  <manga>
    <manga_mangadb_id>151150</manga_mangadb_id>
    <manga_title><![CDATA[ Berserk ]]></manga_title>
    <my_read_volumes>0</my_read_volumes>
    <my_read_chapters>35.000</my_read_chapters>
    <my_status>Completed</my_status>
    <my_score>9</my_score>
    <update_on_import>1</update_on_import>
  </manga>
  <manga>
    <manga_mangadb_id>167016</manga_mangadb_id>
    <manga_title><![CDATA[ One Piece ]]></manga_title>
    <my_read_volumes>0</my_read_volumes>
    <my_read_chapters>64.500</my_read_chapters>
    <my_status>Reading</my_status>
    <my_score>0</my_score>
    <update_on_import>1</update_on_import>
  </manga>
</myanimelist>
"""

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


def test_mal_xml_import_preview_and_commit(client: TestClient):
    # Register user
    reg = client.post("/auth/register", json={
        "username": "maltester",
        "email": "mal@test.com",
        "password": "Password123!"
    })
    assert reg.status_code == 201
    auth_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 1. Preview MAL XML with decimal float chapters and CDATA titles
    files = {
        "file": ("manga-list-test.xml", io.BytesIO(SAMPLE_MAL_XML.encode("utf-8")), "application/xml")
    }
    resp = client.post("/auth/library/import/preview", headers=auth_headers, files=files)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["source_format"] == "xml"
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert len(data["matched_entries"]) == 2

    preview_token = data["preview_token"]

    # 2. Commit import
    commit_payload = {
        "preview_token": preview_token,
        "conflict_strategy": "replace_existing"
    }
    c_resp = client.post("/auth/library/import/commit", headers=auth_headers, json=commit_payload)
    assert c_resp.status_code == 200, c_resp.text
    c_data = c_resp.json()
    assert c_data["success"] is True
    assert c_data["imported_count"] == 2

    # 3. Check library tracking reflects imported items and progress
    t_resp = client.get("/auth/tracking", headers=auth_headers)
    assert t_resp.status_code == 200
    entries = t_resp.json()["entries"]
    gids = {e["gold_id"]: e for e in entries}

    assert "anilist:30002" in gids
    berserk = gids["anilist:30002"]
    assert berserk["status"] == "completed"
    assert berserk["progress"] == 35
    assert berserk["score"] == 9.0

    assert "anilist:21" in gids
    op = gids["anilist:21"]
    assert op["status"] == "reading"
    assert op["progress"] == 64


def test_recommendations_endpoint_guest_and_authenticated(client: TestClient):
    # Guest user requesting 60 recommendations
    resp_guest = client.get("/recommend/for-me?top_k=60")
    assert resp_guest.status_code == 200
    data_guest = resp_guest.json()
    assert data_guest["count"] > 0
    assert len(data_guest["results"]) > 0

    # Register user
    reg = client.post("/auth/register", json={
        "username": "rectester",
        "email": "rec@test.com",
        "password": "Password123!"
    })
    auth_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Authenticated user requesting 60 recommendations
    resp_auth = client.get("/recommend/for-me?top_k=60", headers=auth_headers)
    assert resp_auth.status_code == 200
    data_auth = resp_auth.json()
    assert data_auth["count"] > 0
    assert len(data_auth["results"]) > 0
