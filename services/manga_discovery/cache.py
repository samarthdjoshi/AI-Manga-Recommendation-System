"""
Thread-safe in-memory cache for live discovery feeds with TTL and stale-while-revalidate support.
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Any


class CacheEntry:
    __slots__ = ("created_at", "expires_at", "value")

    def __init__(self, value: Any, ttl_seconds: int) -> None:
        self.value = value
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl_seconds

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class DiscoveryCache:
    """Thread-safe TTL cache with graceful stale fallback."""

    def __init__(self) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get(self, key: str) -> tuple[Any | None, bool]:
        """
        Return (value, is_stale).
        If key does not exist, return (None, True).
        If key exists and is valid, return (value, False).
        If key exists but has expired, return (value, True) (stale-while-revalidate candidate).
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None, True
            return entry.value, entry.is_expired

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        """Store a value with a specific TTL in seconds."""
        with self._lock:
            self._store[key] = CacheEntry(value, ttl_seconds)

    def clear(self) -> None:
        """Clear all entries."""
        with self._lock:
            self._store.clear()

    def remove(self, key: str) -> None:
        """Remove a specific key."""
        with self._lock:
            self._store.pop(key, None)
