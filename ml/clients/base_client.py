"""
Reusable HTTP client for all external API integrations.

Responsibilities:
- HTTP session management
- GET and POST requests
- Retry transient failures
- Logging
- Timeout handling
- HTTP error handling

This class must remain API-agnostic.
"""

from __future__ import annotations

from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from common.config import settings
from common.logger import get_logger

logger = get_logger(__name__)


class BaseAPIClient:
    """Reusable base HTTP client."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout: int | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:

        self.base_url = base_url.rstrip("/")

        self.client = httpx.Client(
            timeout=timeout or settings.API_TIMEOUT,
            headers=headers,
            follow_redirects=True,
        )

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self.client.close()

    def __enter__(self) -> "BaseAPIClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(settings.API_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def get(
        self,
        endpoint: str = "",
        *,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:

        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        logger.info("GET %s", url)

        response = self.client.get(
            url,
            params=params,
        )

        response.raise_for_status()

        logger.info(
            "%s -> %s",
            url,
            response.status_code,
        )

        return response

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(settings.API_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def post(
        self,
        endpoint: str = "",
        *,
        json: dict[str, Any] | None = None,
    ) -> httpx.Response:

        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        logger.info("POST %s", url)

        response = self.client.post(
            url,
            json=json,
        )

        response.raise_for_status()

        logger.info(
            "%s -> %s",
            url,
            response.status_code,
        )

        return response