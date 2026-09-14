"""
Integration tests for Library Management: Custom Lists, Private Tags,
Bulk Editing, JSON/CSV Export, and Preview-First Import.
"""

from __future__ import annotations

import csv
import io
import json

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



def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_user(client: TestClient, username: str, email: str) -> tuple[int, str]:
    res = client.post(
        "/auth/register",
        json={"username": username, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    data = res.json()
    return data["user"]["id"], data["access_token"]


def test_library_unauthenticated_rejected(client: TestClient) -> None:
    assert client.get("/auth/lists").status_code == 401
    assert client.post("/auth/lists", json={"name": "Test"}).status_code == 401
    assert client.get("/auth/tags").status_code == 401
    assert client.post("/auth/library/bulk", json={"gold_ids": ["anilist:30002"]}).status_code == 401
    assert client.get("/auth/library/export").status_code == 401
    assert client.post("/auth/library/import/commit", json={"preview_token": "abc"}).status_code == 401


def test_custom_lists_crud_and_duplicate_name(client: TestClient) -> None:
    _, token = _create_user(client, "alice_lists", "alice_lists@example.com")
    headers = _auth_header(token)

    # 1. Create list
    res = client.post(
        "/auth/lists",
        json={"name": "Top Recommendations", "description": "My all time top manga"},
        headers=headers,
    )
    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "Top Recommendations"
    assert created["entry_count"] == 0
    list_id = created["id"]

    # 2. Duplicate name should be rejected (400)
    res_dup = client.post(
        "/auth/lists",
        json={"name": "Top Recommendations"},
        headers=headers,
    )
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()

    # 3. List custom lists
    res_list = client.get("/auth/lists", headers=headers)
    assert res_list.status_code == 200
    lists_data = res_list.json()
    assert lists_data["count"] == 1
    assert lists_data["lists"][0]["id"] == list_id

    # 4. Update list name and description
    res_up = client.patch(
        f"/auth/lists/{list_id}",
        json={"name": "Top Tier Manga", "description": "Updated description"},
        headers=headers,
    )
    assert res_up.status_code == 200
    assert res_up.json()["name"] == "Top Tier Manga"
    assert res_up.json()["description"] == "Updated description"

    # 5. Delete list
    res_del = client.delete(f"/auth/lists/{list_id}", headers=headers)
    assert res_del.status_code == 204

    # 6. Verify deleted
    assert client.get(f"/auth/lists/{list_id}", headers=headers).status_code == 404


def test_custom_list_entries_and_catalog_validation(client: TestClient) -> None:
    _, token = _create_user(client, "bob_entries", "bob_entries@example.com")
    headers = _auth_header(token)

    res_l = client.post("/auth/lists", json={"name": "Action Reads"}, headers=headers)
    list_id = res_l.json()["id"]

    # Invalid catalog ID should be rejected
    res_bad = client.post(f"/auth/lists/{list_id}/entries/nonexistent_manga", headers=headers)
    assert res_bad.status_code == 404

    # Valid catalog ID
    res_add = client.post(f"/auth/lists/{list_id}/entries/anilist:30002", headers=headers)
    assert res_add.status_code == 204

    # Idempotent re-add
    res_add2 = client.post(f"/auth/lists/{list_id}/entries/anilist:30002", headers=headers)
    assert res_add2.status_code == 204

    # Check detail
    res_det = client.get(f"/auth/lists/{list_id}", headers=headers)
    assert res_det.status_code == 200
    assert res_det.json()["entries"] == ["anilist:30002"]

    # Remove entry
    res_rem = client.delete(f"/auth/lists/{list_id}/entries/anilist:30002", headers=headers)
    assert res_rem.status_code == 204
    assert client.get(f"/auth/lists/{list_id}", headers=headers).json()["entries"] == []


def test_custom_lists_idor_prevention(client: TestClient) -> None:
    _, token_a = _create_user(client, "alice_idor", "alice_idor@example.com")
    _, token_b = _create_user(client, "bob_idor", "bob_idor@example.com")

    # Alice creates a list
    res = client.post("/auth/lists", json={"name": "Alice Secret"}, headers=_auth_header(token_a))
    alice_list_id = res.json()["id"]

    # Bob attempts to get, modify, add entries to, or delete Alice's list
    b_headers = _auth_header(token_b)
    assert client.get(f"/auth/lists/{alice_list_id}", headers=b_headers).status_code == 404
    assert client.patch(f"/auth/lists/{alice_list_id}", json={"name": "Hacked"}, headers=b_headers).status_code == 404
    assert client.post(f"/auth/lists/{alice_list_id}/entries/anilist:30002", headers=b_headers).status_code == 404
    assert client.delete(f"/auth/lists/{alice_list_id}", headers=b_headers).status_code == 404


def test_private_tags_crud_and_isolation(client: TestClient) -> None:
    _, token_a = _create_user(client, "tag_alice", "tag_alice@example.com")
    _, token_b = _create_user(client, "tag_bob", "tag_bob@example.com")

    headers_a = _auth_header(token_a)
    headers_b = _auth_header(token_b)

    # Alice sets tags for anilist:30002
    res_put = client.put(
        "/auth/tags/anilist:30002",
        json={"tags": ["Masterpiece", "Physical-Copy", "masterpiece"]},
        headers=headers_a,
    )
    assert res_put.status_code == 200
    data = res_put.json()
    assert data["gold_id"] == "anilist:30002"
    assert sorted(data["tags"]) == ["masterpiece", "physical-copy"]

    # Alice gets all tags
    res_all = client.get("/auth/tags", headers=headers_a)
    assert res_all.status_code == 200
    assert "anilist:30002" in res_all.json()["tags_by_gold_id"]

    # Bob gets tags for same manga -> should see empty
    res_b = client.get("/auth/tags/anilist:30002", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["tags"] == []

    # Alice deletes a single tag
    res_del = client.delete("/auth/tags/anilist:30002/masterpiece", headers=headers_a)
    assert res_del.status_code == 204
    res_after = client.get("/auth/tags/anilist:30002", headers=headers_a)
    assert res_after.json()["tags"] == ["physical-copy"]


def test_bulk_update_atomic_and_validation(client: TestClient) -> None:
    _, token = _create_user(client, "bulk_user", "bulk_user@example.com")
    headers = _auth_header(token)

    # Create a list to add items to
    res_list = client.post("/auth/lists", json={"name": "Bulk Readlist"}, headers=headers)
    list_id = res_list.json()["id"]

    # Bulk update 2 valid titles
    res_bulk = client.post(
        "/auth/library/bulk",
        json={
            "gold_ids": ["anilist:30002", "anilist:21"],
            "status": "reading",
            "progress": 50,
            "score": 8.5,
            "add_tags": ["in-progress"],
            "add_to_list_ids": [list_id],
        },
        headers=headers,
    )
    assert res_bulk.status_code == 200
    assert res_bulk.json()["updated_count"] == 2

    # Verify tracking entries were created and updated
    res_track = client.get("/auth/tracking", headers=headers)
    entries = {e["gold_id"]: e for e in res_track.json()["entries"]}
    assert entries["anilist:30002"]["status"] == "reading"
    assert entries["anilist:30002"]["progress"] == 50
    assert entries["anilist:30002"]["score"] == 8.5
    assert entries["anilist:21"]["status"] == "reading"

    # Verify custom list has both entries
    res_ldet = client.get(f"/auth/lists/{list_id}", headers=headers)
    assert set(res_ldet.json()["entries"]) == {"anilist:30002", "anilist:21"}

    # Attempting to bulk-update with unowned list ID should fail with 403
    res_bad_list = client.post(
        "/auth/library/bulk",
        json={
            "gold_ids": ["anilist:30002"],
            "add_to_list_ids": [999999],
        },
        headers=headers,
    )
    assert res_bad_list.status_code == 403


def test_export_json_and_csv_formula_injection_defense(client: TestClient) -> None:
    _, token = _create_user(client, "exporter", "exporter@example.com")
    headers = _auth_header(token)

    client.post("/auth/favorites/anilist:30002", headers=headers)
    client.put(
        "/auth/tracking/anilist:30002",
        json={"status": "completed", "progress": 364, "score": 9.5, "notes": "=SUM(1,2)*cmd"},
        headers=headers,
    )
    res_l = client.post("/auth/lists", json={"name": "Classics"}, headers=headers)
    client.post(f"/auth/lists/{res_l.json()['id']}/entries/anilist:30002", headers=headers)
    client.put("/auth/tags/anilist:30002", json={"tags": ["dark-fantasy"]}, headers=headers)

    # 1. JSON Export
    res_json = client.get("/auth/library/export?format=json", headers=headers)
    assert res_json.status_code == 200
    assert "attachment; filename=" in res_json.headers["Content-Disposition"]
    payload = res_json.json()
    assert payload["version"] == "mangaverse_library_v1"
    assert payload["user"]["username"] == "exporter"
    assert len(payload["favorites"]) == 1
    assert payload["tracking"][0]["gold_id"] == "anilist:30002"
    assert payload["custom_lists"][0]["name"] == "Classics"
    assert payload["private_tags"][0]["tags"] == ["dark-fantasy"]

    # 2. CSV Export
    res_csv = client.get("/auth/library/export?format=csv", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    csv_text = res_csv.text

    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    assert len(rows) == 1
    row = rows[0]
    assert row["gold_id"] == "anilist:30002"
    assert row["favorite"] == "true"
    assert row["lists"] == "Classics"
    assert row["private_tags"] == "dark-fantasy"
    assert row["notes"].startswith("'=SUM(1,2)")


def test_import_preview_and_commit_roundtrip(client: TestClient) -> None:
    _, token_exp = _create_user(client, "roundtrip_src", "roundtrip_src@example.com")
    headers_exp = _auth_header(token_exp)

    client.post("/auth/favorites/anilist:30002", headers=headers_exp)
    client.put(
        "/auth/tracking/anilist:30002",
        json={"status": "reading", "progress": 100, "score": 9.0, "notes": "Epic story"},
        headers=headers_exp,
    )
    res_l = client.post("/auth/lists", json={"name": "Imported List"}, headers=headers_exp)
    client.post(f"/auth/lists/{res_l.json()['id']}/entries/anilist:30002", headers=headers_exp)
    client.put("/auth/tags/anilist:30002", json={"tags": ["must-read"]}, headers=headers_exp)

    exp_res = client.get("/auth/library/export?format=json", headers=headers_exp)
    json_bytes = exp_res.content

    _, token_imp = _create_user(client, "roundtrip_dst", "roundtrip_dst@example.com")
    headers_imp = _auth_header(token_imp)

    # 1. Preview
    files = {"file": ("backup.json", io.BytesIO(json_bytes), "application/json")}
    prev_res = client.post("/auth/library/import/preview", files=files, headers=headers_imp)
    assert prev_res.status_code == 200
    prev = prev_res.json()
    assert prev["valid_rows"] == 1
    assert prev["source_format"] == "json"
    assert len(prev["preview_token"]) > 0

    # Verify no writes occurred during dry run
    assert client.get("/auth/tracking", headers=headers_imp).json()["count"] == 0

    # 2. Commit import
    commit_res = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers_imp,
    )
    assert commit_res.status_code == 200
    assert commit_res.json()["success"] is True

    # 3. Verify target user now has the library entries
    track = client.get("/auth/tracking", headers=headers_imp).json()["entries"][0]
    assert track["gold_id"] == "anilist:30002"
    assert track["progress"] == 100
    assert track["score"] == 9.0

    favs = client.get("/auth/favorites", headers=headers_imp).json()["favorites"]
    assert any(f["gold_id"] == "anilist:30002" for f in favs)

    lists = client.get("/auth/lists", headers=headers_imp).json()["lists"]
    assert any(l["name"] == "Imported List" for l in lists)

    tags = client.get("/auth/tags/anilist:30002", headers=headers_imp).json()["tags"]
    assert tags == ["must-read"]

    # 4. Repeat once to prove idempotency: no duplicates created
    files_again = {"file": ("backup.json", io.BytesIO(json_bytes), "application/json")}
    prev_again = client.post("/auth/library/import/preview", files=files_again, headers=headers_imp).json()
    commit_again = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev_again["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers_imp,
    )
    assert commit_again.status_code == 200

    # Counts must stay exactly 1
    assert client.get("/auth/tracking", headers=headers_imp).json()["count"] == 1
    assert client.get("/auth/favorites", headers=headers_imp).json()["count"] == 1
    assert client.get("/auth/lists", headers=headers_imp).json()["count"] == 1
    assert len(client.get("/auth/tags/anilist:30002", headers=headers_imp).json()["tags"]) == 1


def test_import_csv_roundtrip(client: TestClient) -> None:
    _, token = _create_user(client, "csv_user", "csv_user@example.com")
    headers = _auth_header(token)

    # Prepare a valid CSV
    csv_data = (
        "gold_id,title,status,progress,score,favorite,lists,private_tags,notes\n"
        "anilist:21,One Piece,completed,1100,9.8,true,Shounen Classics|Favorites,adventure|epic,'=safe note\n"
    ).encode("utf-8")

    files = {"file": ("library.csv", io.BytesIO(csv_data), "text/csv")}
    prev_res = client.post("/auth/library/import/preview", files=files, headers=headers)
    assert prev_res.status_code == 200
    prev = prev_res.json()
    assert prev["source_format"] == "csv"
    assert prev["valid_rows"] == 1

    commit_res = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers,
    )
    assert commit_res.status_code == 200

    # Verify fields imported cleanly
    track = client.get("/auth/tracking", headers=headers).json()["entries"][0]
    assert track["gold_id"] == "anilist:21"
    assert track["status"] == "completed"
    assert track["progress"] == 1100
    assert track["score"] == 9.8
    assert track["notes"] == "=safe note"

    favs = client.get("/auth/favorites", headers=headers).json()["favorites"]
    assert any(f["gold_id"] == "anilist:21" for f in favs)

    lists = {l["name"] for l in client.get("/auth/lists", headers=headers).json()["lists"]}
    assert "Shounen Classics" in lists
    assert "Favorites" in lists

    tags = client.get("/auth/tags/anilist:21", headers=headers).json()["tags"]
    assert "adventure" in tags
    assert "epic" in tags


def test_import_malformed_and_ambiguous_sample(client: TestClient) -> None:
    _, token = _create_user(client, "err_user", "err_user@example.com")
    headers = _auth_header(token)

    # 1. Completely malformed JSON
    bad_json = b"{invalid:json:syntax"
    files = {"file": ("bad.json", io.BytesIO(bad_json), "application/json")}
    res_bad = client.post("/auth/library/import/preview", files=files, headers=headers)
    assert res_bad.status_code == 400

    # 2. Ambiguous or unknown manga titles
    unknown_csv = (
        "gold_id,title,status,progress,score,favorite,lists,private_tags,notes\n"
        "nonexistent_gid,Completely Made Up Unknown Title 12345,reading,10,8.0,false,,,\n"
    ).encode("utf-8")

    files_unk = {"file": ("unknown.csv", io.BytesIO(unknown_csv), "text/csv")}
    res_unk = client.post("/auth/library/import/preview", files=files_unk, headers=headers)
    assert res_unk.status_code == 200
    data = res_unk.json()
    assert data["valid_rows"] == 0
    assert len(data["skipped_rows"]) == 1
    assert "not found in catalog" in data["skipped_rows"][0]["reason"].lower()

    # Commit with 0 valid rows should safely commit without error and write 0 entries
    res_commit = client.post(
        "/auth/library/import/commit",
        json={"preview_token": data["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers,
    )
    assert res_commit.status_code == 200
    assert res_commit.json()["imported_count"] == 0
    assert client.get("/auth/tracking", headers=headers).json()["count"] == 0


def test_import_preview_token_security(client: TestClient) -> None:
    _, token_a = _create_user(client, "tok_a", "tok_a@example.com")
    _, token_b = _create_user(client, "tok_b", "tok_b@example.com")

    sample_json = json.dumps({
        "version": "mangaverse_library_v1",
        "tracking": [{"gold_id": "anilist:30002", "status": "planning"}],
    }).encode("utf-8")

    files = {"file": ("sample.json", io.BytesIO(sample_json), "application/json")}
    res_prev = client.post("/auth/library/import/preview", files=files, headers=_auth_header(token_a))
    token = res_prev.json()["preview_token"]

    # User B attempts to commit User A's token -> should be rejected with 400
    res_commit_b = client.post(
        "/auth/library/import/commit",
        json={"preview_token": token, "conflict_strategy": "keep_existing"},
        headers=_auth_header(token_b),
    )
    assert res_commit_b.status_code == 400


def test_xml_export_and_import_roundtrip(client: TestClient) -> None:
    _, token_exp = _create_user(client, "xml_exp_user", "xml_exp@example.com")
    headers_exp = _auth_header(token_exp)

    # Setup user data
    client.put(
        "/auth/tracking/anilist:30002",
        json={"status": "reading", "progress": 42, "score": 9.0, "notes": "Epic XML test"},
        headers=headers_exp,
    )
    client.post("/auth/favorites/anilist:30002", headers=headers_exp)
    client.put("/auth/tags/anilist:30002", json={"tags": ["action", "berserk"]}, headers=headers_exp)

    # 1. Export as XML
    exp_res = client.get("/auth/library/export?format=xml", headers=headers_exp)
    assert exp_res.status_code == 200
    assert "application/xml" in exp_res.headers["content-type"]
    xml_bytes = exp_res.content
    assert b"<mangaverse_library" in xml_bytes
    assert b"anilist:30002" in xml_bytes
    assert b"Epic XML test" in xml_bytes

    # 2. Import into a new user
    _, token_imp = _create_user(client, "xml_imp_user", "xml_imp@example.com")
    headers_imp = _auth_header(token_imp)

    files = {"file": ("library.xml", io.BytesIO(xml_bytes), "application/xml")}
    prev_res = client.post("/auth/library/import/preview", files=files, headers=headers_imp)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["source_format"] == "xml"
    assert prev_data["valid_rows"] == 1

    commit_res = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev_data["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers_imp,
    )
    assert commit_res.status_code == 200

    # 3. Verify imported tracking, favorite, tags
    tracking = client.get("/auth/tracking", headers=headers_imp).json()
    assert tracking["count"] == 1
    assert tracking["entries"][0]["gold_id"] == "anilist:30002"
    assert tracking["entries"][0]["progress"] == 42
    assert tracking["entries"][0]["notes"] == "Epic XML test"

    favs = client.get("/auth/favorites", headers=headers_imp).json()
    assert favs["count"] == 1

    tags = client.get("/auth/tags/anilist:30002", headers=headers_imp).json()["tags"]
    assert "action" in tags
    assert "berserk" in tags


def test_import_malformed_xml(client: TestClient) -> None:
    _, token = _create_user(client, "xml_err_user", "xml_err@example.com")
    headers = _auth_header(token)

    bad_xml = b"<?xml version='1.0'?><mangaverse_library><tracking><entry>"  # unclosed tags
    files = {"file": ("corrupt.xml", io.BytesIO(bad_xml), "application/xml")}
    res_bad = client.post("/auth/library/import/preview", files=files, headers=headers)
    assert res_bad.status_code == 400
    assert "invalid xml format" in res_bad.json()["detail"].lower()


def test_import_external_tracker_csv_format(client: TestClient) -> None:
    _, token = _create_user(client, "tracker_csv_user", "tracker_csv@example.com")
    headers = _auth_header(token)

    csv_content = (
        'title,chapter,folder,url_mal,url_al,url_mu\n'
        '"One Piece",1100.000,Completed,https://myanimelist.net/manga/13,https://anilist.co/manga/21,https://mangaupdates.com/series/pb8uwds\n'
        '"Berserk",64.500,Reading,https://myanimelist.net/manga/2,https://anilist.co/manga/30002,https://mangaupdates.com/series/f89nado\n'
    ).encode("utf-8")

    files = {"file": ("manga-list-tracker.csv", io.BytesIO(csv_content), "text/csv")}
    prev_res = client.post("/auth/library/import/preview", files=files, headers=headers)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["valid_rows"] == 2
    assert prev_data["skipped_rows"] == []

    commit_res = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev_data["preview_token"], "conflict_strategy": "replace_existing"},
        headers=headers,
    )
    assert commit_res.status_code == 200

    tracking_res = client.get("/auth/tracking", headers=headers).json()
    assert tracking_res["count"] == 2
    entries = {e["gold_id"]: e for e in tracking_res["entries"]}
    assert "anilist:21" in entries
    assert entries["anilist:21"]["status"] == "completed"
    assert entries["anilist:21"]["progress"] == 1100

    assert "anilist:30002" in entries
    assert entries["anilist:30002"]["status"] == "reading"
    assert entries["anilist:30002"]["progress"] == 64


def test_import_user_mal_export_xml_format(client: TestClient) -> None:
    _, token = _create_user(client, "mal_xml_user", "mal_xml@example.com")
    headers = _auth_header(token)

    # Standard MyAnimeList XML export format with CDATA, float chapters, and MAL IDs
    mal_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<myanimelist>\n'
        '  <myinfo><user_export_type>2</user_export_type></myinfo>\n'
        '  <manga>\n'
        '    <manga_mangadb_id>151150</manga_mangadb_id>\n'
        '    <manga_title><![CDATA[ A Middle-Aged Man Who Returns from Another World Goes Back to When He was 17 and becomes Unbeatable ]]></manga_title>\n'
        '    <my_read_chapters>35.000</my_read_chapters>\n'
        '    <my_status>Completed</my_status>\n'
        '    <my_score>8</my_score>\n'
        '  </manga>\n'
        '  <manga>\n'
        '    <manga_mangadb_id>167016</manga_mangadb_id>\n'
        '    <manga_title><![CDATA[ Until the Tragic Male Lead Walks Again ]]></manga_title>\n'
        '    <my_read_chapters>64.000</my_read_chapters>\n'
        '    <my_status>Reading</my_status>\n'
        '    <my_score>0</my_score>\n'
        '  </manga>\n'
        '</myanimelist>\n'
    ).encode("utf-8")

    files = {"file": ("manga-list-2026-09-13.xml", io.BytesIO(mal_xml), "application/xml")}
    prev_res = client.post("/auth/library/import/preview", files=files, headers=headers)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["total_rows"] == 2
    assert prev_data["valid_rows"] == 2
    assert prev_data["skipped_rows"] == []

    commit_res = client.post(
        "/auth/library/import/commit",
        json={"preview_token": prev_data["preview_token"], "conflict_strategy": "keep_existing"},
        headers=headers,
    )
    assert commit_res.status_code == 200

    tracking_res = client.get("/auth/tracking", headers=headers).json()
    assert tracking_res["count"] == 2
    by_status = {e["gold_id"]: e for e in tracking_res["entries"]}
    # Verify values properly mapped
    for gid, entry in by_status.items():
        if entry["progress"] == 35:
            assert entry["status"] == "completed"
            assert entry["score"] == 8.0
        elif entry["progress"] == 64:
            assert entry["status"] == "reading"




