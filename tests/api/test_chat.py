"""Deterministic tests for chat tools, fallback behavior, and auth boundaries."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import api.main as api_main
from auth.database import Base
from auth.security import create_access_token
from ml.recommender import agent


class Retriever:
    def semantic_search(self, _description: str, top_k: int) -> list[tuple[str, float]]:
        assert top_k <= 45
        return [("anilist:30002", 0.9), ("anilist:100", 0.8)]


@pytest.fixture()
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_all_catalog_tools_filter_content_and_anonymous_data(contract_catalog, db: Session) -> None:
    tools, collected, _helpers = agent._build_tools(
        contract_catalog, Retriever(), hide_explicit=True, hide_doujinshi=True,
        current_user_id=None, db=db,
    )
    tool = {function.__name__: function for function in tools}

    assert tool["search_manga"]("piece")[0]["title"] == "One Piece"
    assert tool["semantic_search_manga"]("dark fantasy")[0]["title"] == "Berserk"
    assert tool["get_manga_details"]("Berserk")["gold_id"] == "anilist:30002"
    assert tool["get_similar_manga"]("Berserk")
    assert tool["get_user_favorites"]() == {"logged_in": False}
    assert tool["get_personalized_recommendations"]() == {"logged_in": False}
    assert "anilist:100" not in collected


def test_missing_gemini_configuration_reaches_graceful_fallback_error(contract_catalog, db: Session, monkeypatch) -> None:
    monkeypatch.setattr(agent, "_get_client", lambda: (_ for _ in ()).throw(RuntimeError("no key")))
    monkeypatch.setattr(agent, "_ollama_is_reachable", lambda: False)

    with pytest.raises(agent.ChatUnavailableError):
        agent.run_agent_chat(
            message="find Berserk", history=[], svc=contract_catalog, retriever=Retriever(),
            hide_explicit=True, hide_doujinshi=True, page_context_gold_id=None,
            current_user_id=None, db=db,
        )


def test_chat_uses_authorization_header_not_client_supplied_body_token(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_agent(**kwargs):
        captured.update(kwargs)
        return "Safe reply", []

    monkeypatch.setattr(api_main, "get_chat_retriever", lambda: SimpleNamespace())
    monkeypatch.setattr(api_main, "run_agent_chat", fake_agent)
    valid_token = create_access_token(user_id=777, username="header-user")

    with TestClient(api_main.app) as client:
        response = client.post(
            "/chat",
            json={"message": "hello", "auth_token": "pretend-to-be-someone-else"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )

    assert response.status_code == 200
    assert captured["current_user_id"] == 777
    body = response.json()
    assert body["reply"] == "Safe reply"
    assert body["sources"] == []
    assert body["status"] == "ok"


def test_chat_rejects_invalid_or_oversized_input() -> None:
    with TestClient(api_main.app) as client:
        assert client.post("/chat", json={"message": ""}).status_code == 422
        assert client.post("/chat", json={"message": "x" * 4_001}).status_code == 422


def test_combined_tools_multi_step_workflow_accumulates_sources(contract_catalog, db: Session) -> None:
    tools, collected, _helpers = agent._build_tools(
        contract_catalog, Retriever(), hide_explicit=True, hide_doujinshi=True,
        current_user_id=None, db=db,
    )
    tool = {function.__name__: function for function in tools}

    # Step 1: user asks for a title
    search_res = tool["search_manga"]("one piece")
    assert search_res
    assert search_res[0]["title"] == "One Piece"
    assert "anilist:21" in collected

    # Step 2: agent fetches full details
    details = tool["get_manga_details"]("One Piece")
    assert details["gold_id"] == "anilist:21"

    # Step 3: agent requests similar titles
    similar = tool["get_similar_manga"]("One Piece")
    assert similar
    # Collected sources should now have multiple unique titles without duplicating "anilist:21"
    assert len(collected) >= 2
    assert "anilist:21" in collected
    assert "anilist:30002" in collected


def test_authenticated_tools_with_user_favorites(contract_catalog, db: Session) -> None:
    from auth.database import Favorite
    user_id = 42
    # Seed a favorite in db
    db.add(Favorite(user_id=user_id, gold_id="anilist:30002"))
    db.commit()

    # Mock recommend_hybrid on the test catalog for personalized recommendations
    contract_catalog.recommend_hybrid = lambda favorite_gold_ids, all_users_favorites, top_k, alpha=0.6: [
        contract_catalog.get_by_id("anilist:21")
    ]

    tools, _collected, _helpers = agent._build_tools(
        contract_catalog, Retriever(), hide_explicit=True, hide_doujinshi=True,
        current_user_id=user_id, db=db,
    )
    tool = {function.__name__: function for function in tools}

    fav_res = tool["get_user_favorites"]()
    assert fav_res["logged_in"] is True
    assert len(fav_res["favorites"]) == 1
    assert fav_res["favorites"][0]["gold_id"] == "anilist:30002"

    rec_res = tool["get_personalized_recommendations"]()
    assert rec_res["logged_in"] is True
    assert len(rec_res["recommendations"]) == 1
    assert rec_res["recommendations"][0]["gold_id"] == "anilist:21"


def test_tools_gracefully_handle_none_genres_record(db: Session) -> None:
    none_genre_record = {
        "gold_id": "test:none_genres",
        "title": "No Genre Manga",
        "genres": None,
        "rating_combined": 8.0,
        "chapters": 10,
        "description": "A manga with null genres.",
    }
    catalog = SimpleNamespace(
        search=lambda q, limit=10: [none_genre_record],
        records_by_gold_id={"test:none_genres": none_genre_record},
    )

    tools, _collected, helpers = agent._build_tools(
        catalog, Retriever(), hide_explicit=True, hide_doujinshi=True,
        current_user_id=None, db=db,
    )
    tool = {function.__name__: function for function in tools}

    # Verify search and simplify don't crash
    res = tool["search_manga"]("No Genre")
    assert res
    assert res[0]["gold_id"] == "test:none_genres"
    assert res[0]["genres"] == []

    # Verify context block helper handles it without crashing
    context_block = agent._ollama_context_block([helpers["_simplify"](none_genre_record)])
    assert "No Genre Manga" in context_block
    assert "unknown genres" in context_block


def test_primary_provider_network_failure_falls_back_to_ollama(contract_catalog, db: Session, monkeypatch) -> None:
    import httpx

    class FailingChat:
        def send_message(self, _msg):
            raise httpx.ConnectError("getaddrinfo failed")

    class FailingChats:
        def create(self, **kwargs):
            return FailingChat()

    class FailingClient:
        chats = FailingChats()

    class FakeOllamaResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"message": {"content": "Ollama fallback recommendation for One Piece"}}

    monkeypatch.setattr(agent, "_get_client", lambda: FailingClient())
    monkeypatch.setattr(agent, "_ollama_is_reachable", lambda: True)
    monkeypatch.setattr(agent.requests, "post", lambda *args, **kwargs: FakeOllamaResponse())

    res = agent.run_agent_chat(
        message="recommend something like One Piece",
        history=[],
        svc=contract_catalog,
        retriever=Retriever(),
        hide_explicit=True,
        hide_doujinshi=True,
        page_context_gold_id=None,
        current_user_id=None,
        db=db,
    )
    reply, sources = res
    assert "Ollama fallback recommendation" in reply
    assert getattr(res, "provider", None) == "ollama"


def test_all_providers_unavailable_returns_safe_structured_fallback_with_catalog_results(
    contract_catalog, monkeypatch
) -> None:
    def fake_failing_chat(**kwargs):
        raise agent.ChatUnavailableError("Gemini and Ollama both unavailable")

    monkeypatch.setattr(api_main, "get_service", lambda: contract_catalog)
    monkeypatch.setattr(api_main, "get_chat_retriever", lambda: Retriever())
    monkeypatch.setattr(api_main, "run_agent_chat", fake_failing_chat)

    with TestClient(api_main.app) as client:
        response = client.post(
            "/chat",
            json={"message": "One Piece", "hide_explicit": True, "hide_doujinshi": True},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "assistant_unavailable"
    assert body["provider"] is None
    assert "temporarily offline" in body["reply"]
    assert len(body["sources"]) > 0
    assert any(s["title"] == "One Piece" for s in body["sources"])
    assert len(body["suggestions"]) > 0


def test_all_providers_unavailable_respects_content_filters(monkeypatch) -> None:
    explicit_rec = {
        "gold_id": "test:explicit_1",
        "title": "Explicit Title",
        "genres": ["Hentai", "Ecchi"],
        "rating_combined": 9.0,
    }
    clean_rec = {
        "gold_id": "test:clean_1",
        "title": "Clean Adventure",
        "genres": ["Action", "Adventure"],
        "rating_combined": 8.5,
    }
    fake_svc = SimpleNamespace(
        records_by_gold_id={"test:explicit_1": explicit_rec, "test:clean_1": clean_rec},
        search=lambda q, limit=10: [explicit_rec, clean_rec],
    )

    def fake_failing_chat(**kwargs):
        raise agent.ChatUnavailableError("offline")

    monkeypatch.setattr(api_main, "get_service", lambda: fake_svc)
    monkeypatch.setattr(api_main, "get_chat_retriever", lambda: None)
    monkeypatch.setattr(api_main, "run_agent_chat", fake_failing_chat)

    with TestClient(api_main.app) as client:
        response = client.post(
            "/chat",
            json={"message": "manga", "hide_explicit": True, "hide_doujinshi": True},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "assistant_unavailable"
    # Verify explicit title was filtered out
    source_ids = [s["gold_id"] for s in body["sources"]]
    assert "test:explicit_1" not in source_ids
    assert "test:clean_1" in source_ids

