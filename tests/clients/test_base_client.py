import httpx

from ml.clients.base_client import BaseAPIClient


def test_client_creation() -> None:
    client = BaseAPIClient(base_url="https://example.com")

    assert isinstance(client.client, httpx.Client)

    client.close()


def test_base_url() -> None:
    client = BaseAPIClient(base_url="https://example.com")

    assert client.base_url == "https://example.com"

    client.close()


def test_context_manager() -> None:
    with BaseAPIClient(base_url="https://example.com") as client:
        assert isinstance(client.client, httpx.Client)