"""
Reusable HTTP client for all external API integrations.

Responsibilities:
- HTTP session management
- GET and POST requests
- Automatic request throttling (avoid triggering rate limits)
- Smart retry on transient failures only (429, 5xx, timeouts, connection errors)
- Respects Retry-After header on 429 responses
- Logging
- Timeout handling

This class must remain API-agnostic.
"""

from __future__ import annotations

import time
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

# Status codes worth retrying â€” everything else (400, 401, 403, 404, etc.)
# is a permanent failure and should fail immediately instead of burning retries.
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# Small pause between every successful request, to avoid tripping
# rate limits in the first place rather than only reacting to them.
REQUEST_DELAY_SECONDS = 1.5

# Upper bound on how long we'll ever sleep because of a Retry-After header.
# Protects against an API sending back an absurd or malicious value.
MAX_BACKOFF_SECONDS = 60


class RetryableHTTPError(Exception):
    """Raised for HTTP errors that are safe to retry (429, 5xx, etc.)."""


class BaseAPIClient:
    """Reusable base HTTP client with throttling and smart retry behavior."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout: int | None = None,
        headers: dict[str, str] | None = None,
        request_delay_seconds: float = REQUEST_DELAY_SECONDS,
    ) -> None:

        self.base_url = base_url.rstrip("/")
        self.request_delay_seconds = request_delay_seconds

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

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    def _handle_rate_limit(self, response: httpx.Response) -> None:
        """
        If the response is a 429, sleep for the duration the server asks
        for (via Retry-After) before letting the retry decorator try again.
        """

        if response.status_code != 429:
            return

        retry_after_header = response.headers.get("Retry-After")

        wait_seconds: float

        if retry_after_header is not None:
            try:
                wait_seconds = float(retry_after_header)
            except ValueError:
                # Some APIs send an HTTP date instead of seconds; if we
                # can't parse it, fall back to the max backoff.
                wait_seconds = MAX_BACKOFF_SECONDS
        else:
            wait_seconds = MAX_BACKOFF_SECONDS

        wait_seconds = min(wait_seconds, MAX_BACKOFF_SECONDS)

        logger.info(
            "429 Too Many Requests. Waiting %.1f seconds before retrying...",
            wait_seconds,
        )

        time.sleep(wait_seconds)

    def _raise_for_status(self, response: httpx.Response) -> None:
        """
        Raise an error appropriate to the response status.

        - Retryable statuses (429, 5xx) raise RetryableHTTPError, which
          the @retry decorator is configured to catch.
        - Everything else raises the normal httpx.HTTPStatusError and
          is NOT retried, since it represents a permanent failure
          (bad request, auth failure, not found, etc.).
        """

        if response.status_code in RETRYABLE_STATUS_CODES:
            self._handle_rate_limit(response)
            raise RetryableHTTPError(
                f"Retryable error {response.status_code} for {response.url}"
            )

        response.raise_for_status()

    def _sleep_between_requests(self) -> None:
        """Pause briefly after a successful request to avoid rate limits."""

        time.sleep(self.request_delay_seconds)

    @retry(
        retry=retry_if_exception_type(
            (RetryableHTTPError, httpx.TransportError, httpx.TimeoutException)
        ),
        stop=stop_after_attempt(settings.API_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _request(
        self,
        method: str,
        endpoint: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> httpx.Response:
        """Shared implementation for GET and POST requests."""

        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        logger.info("%s %s", method, url)

        response = self.client.request(
            method,
            url,
            params=params,
            json=json,
        )

        self._raise_for_status(response)

        logger.info("%s -> %s", url, response.status_code)

        self._sleep_between_requests()

        return response

    # -------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------

    def get(
        self,
        endpoint: str = "",
        *,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:
        return self._request("GET", endpoint, params=params)

    def post(
        self,
        endpoint: str = "",
        *,
        json: dict[str, Any] | None = None,
    ) -> httpx.Response:
        return self._request("POST", endpoint, json=json)
