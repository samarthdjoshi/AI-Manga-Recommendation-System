"""
Normalizes MangaDex Bronze records into UnifiedMangaRecord.
"""

from __future__ import annotations

from ml.normalization.mangadex_titles import resolve_title_with_source
from ml.normalization.schema import UnifiedMangaRecord, safe_int


def _resolve_description(attributes: dict) -> str | None:
    description_dict = attributes.get("description", {}) or {}
    if "en" in description_dict:
        return description_dict["en"]
    if description_dict:
        return next(iter(description_dict.values()))
    return None


def _resolve_original_title(attributes: dict) -> str | None:
    title_dict = attributes.get("title", {}) or {}
    original_language = attributes.get("originalLanguage")

    if original_language and original_language in title_dict:
        return title_dict[original_language]
    if title_dict:
        return next(iter(title_dict.values()))
    return None


def _resolve_genres(attributes: dict) -> list[str]:
    tags = attributes.get("tags", []) or []
    names: list[str] = []
    for tag in tags:
        tag_attributes = tag.get("attributes", {}) if isinstance(tag, dict) else {}
        name_dict = tag_attributes.get("name", {}) or {}
        name = name_dict.get("en")
        if name:
            names.append(name)
    return names


def _resolve_cover_url(record: dict) -> str | None:
    manga_id = record.get("id")
    for relationship in record.get("relationships", []) or []:
        if relationship.get("type") == "cover_art":
            rel_attributes = relationship.get("attributes")
            if isinstance(rel_attributes, dict):
                filename = rel_attributes.get("fileName")
                if filename and manga_id:
                    return f"https://uploads.mangadex.org/covers/{manga_id}/{filename}"
    return None


def normalize_mangadex_record(record: dict) -> UnifiedMangaRecord:
    attributes = record.get("attributes", {}) or {}
    manga_id = record.get("id")

    title, title_source = resolve_title_with_source(attributes)

    return UnifiedMangaRecord(
        source="mangadex",
        source_id=str(manga_id),
        title=title,
        title_source=title_source,
        original_title=_resolve_original_title(attributes),
        description=_resolve_description(attributes),
        genres=_resolve_genres(attributes),
        status_raw=attributes.get("status"),
        chapters=safe_int(attributes.get("lastChapter")),
        volumes=safe_int(attributes.get("lastVolume")),
        year=attributes.get("year"),
        rating_raw=None,
        rating_scale=None,
        cover_image_url=_resolve_cover_url(record),
        url=f"https://mangadex.org/title/{manga_id}" if manga_id else None,
        extra={
            "content_rating": attributes.get("contentRating"),
            "publication_demographic": attributes.get("publicationDemographic"),
            "original_language": attributes.get("originalLanguage"),
            "links": attributes.get("links") or {},
        },
    )
