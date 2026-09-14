"""
Base class defining the contract for manga discovery providers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from services.manga_discovery.schemas import MangaDiscoveryItem


class BaseDiscoveryProvider(ABC):
    """Abstract contract for discovery data providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        ...

    @abstractmethod
    def get_trending(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        """Fetch current trending manga."""
        ...

    @abstractmethod
    def get_popular(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        """Fetch all-time popular manga."""
        ...

    @abstractmethod
    def get_top_100(self, limit: int = 100, page: int = 1) -> list[MangaDiscoveryItem]:
        """Fetch top ranked manga (#1 to #100)."""
        ...

    @abstractmethod
    def get_popular_manhwa(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        """Fetch top Korean manhwa / webtoons."""
        ...
