"""
Title resolution for MangaDex manga records.

MangaDex top-level title field is NOT reliably an English title -
it can be a romanization in the manga's original language (confirmed
via real data: Tower of God appears with title = ko-ro: Sinui Tap,
while the actual English title only exists inside altTitles).

Resolution order:
    1. attributes.title.en                     (explicit English title)
    2. First en entry found in altTitles        (English alt title)
    3. attributes.title[originalLanguage]        (title in the work's
       own original language, e.g. ja/ko/zh - readable in that
       language even if not English)
    4. Whatever the first value in attributes.title happens to be
       (last resort - guarantees we never return an empty string)
"""

from __future__ import annotations


def resolve_title(attributes: dict) -> str:
    title_dict = attributes.get("title", {}) or {}

    if "en" in title_dict:
        return title_dict["en"]

    alt_titles = attributes.get("altTitles", []) or []
    for alt in alt_titles:
        if "en" in alt:
            return alt["en"]

    original_language = attributes.get("originalLanguage")
    if original_language and original_language in title_dict:
        return title_dict[original_language]

    if title_dict:
        return next(iter(title_dict.values()))

    return "Unknown Title"


def resolve_title_with_source(attributes: dict) -> tuple[str, str]:
    title_dict = attributes.get("title", {}) or {}

    if "en" in title_dict:
        return title_dict["en"], "title.en"

    alt_titles = attributes.get("altTitles", []) or []
    for alt in alt_titles:
        if "en" in alt:
            return alt["en"], "altTitles.en"

    original_language = attributes.get("originalLanguage")
    if original_language and original_language in title_dict:
        return title_dict[original_language], "original_language"

    if title_dict:
        return next(iter(title_dict.values())), "fallback_any"

    return "Unknown Title", "unknown"
