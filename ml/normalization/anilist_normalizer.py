"""
Normalizes AniList Bronze records into UnifiedMangaRecord.
"""

from __future__ import annotations

from ml.normalization.schema import UnifiedMangaRecord, safe_int


def normalize_anilist_record(record: dict) -> UnifiedMangaRecord:
    title_dict = record.get("title", {}) or {}

    if title_dict.get("english"):
        title = title_dict["english"]
        title_source = "english"
    elif title_dict.get("romaji"):
        title = title_dict["romaji"]
        title_source = "romaji_fallback"
    elif title_dict.get("native"):
        title = title_dict["native"]
        title_source = "native_fallback"
    else:
        title = "Unknown Title"
        title_source = "unknown"

    original_title = title_dict.get("native") or title_dict.get("romaji")

    genre_list = list(record.get("genres") or [])
    tag_names = [t.get("name") for t in (record.get("tags") or []) if t.get("name")]

    seen: set[str] = set()
    combined_genres: list[str] = []
    for genre_name in genre_list + tag_names:
        if genre_name not in seen:
            seen.add(genre_name)
            combined_genres.append(genre_name)

    start_date = record.get("startDate") or {}
    cover = record.get("coverImage") or {}
    cover_url = cover.get("extraLarge") or cover.get("large") or cover.get("medium")

    manga_id = record.get("id")

    return UnifiedMangaRecord(
        source="anilist",
        source_id=str(manga_id),
        title=title,
        title_source=title_source,
        original_title=original_title,
        description=record.get("description"),
        genres=combined_genres,
        status_raw=record.get("status"),
        chapters=safe_int(record.get("chapters")),
        volumes=safe_int(record.get("volumes")),
        year=start_date.get("year"),
        rating_raw=record.get("averageScore"),
        rating_scale="0-100",
        cover_image_url=cover_url,
        url=f"https://anilist.co/manga/{manga_id}" if manga_id else None,
        extra={
            "format": record.get("format"),
            "country_of_origin": record.get("countryOfOrigin"),
            "popularity": record.get("popularity"),
            "favourites": record.get("favourites"),
        },
    )
