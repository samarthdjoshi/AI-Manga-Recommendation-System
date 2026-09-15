import pytest
from fastapi.testclient import TestClient
from api.main import app


def test_ssrf_protection_rejects_loopback_ip():
    with TestClient(app) as client:
        response = client.get("/health?url=http://127.0.0.1")
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")


def test_ssrf_protection_rejects_localhost():
    with TestClient(app) as client:
        response = client.get("/health?url=http://localhost:8000")
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")


def test_ssrf_protection_rejects_cloud_metadata_ip():
    with TestClient(app) as client:
        response = client.get("/health?url=http://169.254.169.254/latest/meta-data/")
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")


def test_ssrf_protection_rejects_file_scheme():
    with TestClient(app) as client:
        response = client.get("/health?url=file:///etc/passwd")
        assert response.status_code == 400
        assert "SSRF Protection" in response.json().get("detail", "")


def test_security_headers_present_on_response():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        headers = response.headers
        assert headers.get("x-content-type-options") == "nosniff"
        assert headers.get("x-frame-options") == "DENY"
        assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert "geolocation=()" in headers.get("permissions-policy", "")
        assert headers.get("x-xss-protection") == "1; mode=block"
        # Server header should be suppressed
        assert "server" not in headers


def test_cors_approved_origin():
    with TestClient(app) as client:
        response = client.get(
            "/health",
            headers={"Origin": "https://ai-manga-recommendation-system.vercel.app"}
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://ai-manga-recommendation-system.vercel.app"


def test_cors_disallowed_origin():
    with TestClient(app) as client:
        response = client.get(
            "/health",
            headers={"Origin": "https://malicious-attacker.com"}
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") != "https://malicious-attacker.com"
        assert response.headers.get("access-control-allow-origin") != "*"
