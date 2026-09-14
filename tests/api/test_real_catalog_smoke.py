"""Opt-in smoke test for the real Gold catalog and FAISS index."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

import api.main as api_main


pytestmark = pytest.mark.real_catalog


@pytest.mark.skipif(
    os.getenv("RUN_REAL_CATALOG_TESTS") != "1",
    reason="Set RUN_REAL_CATALOG_TESTS=1 to load the full production-like catalog.",
)
def test_real_catalog_health_and_search(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run in one isolated process; the catalog/index intentionally uses high memory."""
    monkeypatch.setattr(api_main, "service", None)
    with TestClient(api_main.app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["total_gold_records"] > 0

        search = client.get("/search", params={"q": "one piece", "limit": 5})
        assert search.status_code == 200
        assert isinstance(search.json()["results"], list)
