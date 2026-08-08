"""
Builds the Gold layer: one canonical UnifiedGoldRecord per entity group
from Phase B''s merged groups, applying source-priority rules per field,
blending ratings across sources with confidence-weighted averaging, and
canonicalizing genre tags using a data-driven mapping.

Tag canonicalization note: only mechanical spelling/case/plural variants
are merged (e.g. ''Sci-Fi''/''Sci-fi'', ''Ghost''/''Ghosts''). Tags that
could look like synonyms but encode real content distinctions - e.g.
''Yaoi''/''Boys'' Love''/''Shounen Ai'' (explicit vs. non-explicit BL
content) - are deliberately NOT merged.

Loading note: MangaDex Silver data has ~1,145 duplicate source_id rows
(confirmed byte-identical - harmless retry/append bug in the Bronze
downloader). load_silver_records dedupes by source_id explicitly now,
with a log line so it is a visible, intentional step.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from common.paths import SILVER_DIR

SOURCES = ["anilist", "mangadex", "mangaupdates"]

TITLE_DESC_PRIORITY = ["anilist", "mangadex", "mangaupdates"]
CURRENCY_PRIORITY = ["mangadex", "anilist", "mangaupdates"]
YEAR_PRIORITY = ["anilist", "mangaupdates", "mangadex"]
COVER_PRIORITY = ["mangadex", "anilist", "mangaupdates"]

RECORDS_PER_PAGE = 5000

TAG_CANONICAL_MAP: dict[str, str] = {
    "sci-fi": "Sci-Fi",
    "ghost": "Ghost",
    "ghosts": "Ghost",
    "4-koma": "4-Koma",
    "vampire": "Vampire",
    "vampires": "Vampire",
    "zombie": "Zombie",
    "zombies": "Zombie",
    "monster girls": "Monster Girls",
    "monster girl": "Monster Girls",
}


def load_silver_records(source_name: str) -> dict[str, dict]:
    silver_dir = SILVER_DIR / source_name
    records: dict[str, dict] = {}
    total_rows = 0
    duplicate_rows = 0
    for page_file in sorted(silver_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        for record in data.get("records", []):
            total_rows += 1
            sid = record["source_id"]
            if sid in records:
                duplicate_rows += 1
            records[sid] = record
    if duplicate_rows:
        print(f"  [{source_name}] deduped {duplicate_rows} duplicate source_id rows "
              f"({total_rows} raw rows -> {len(records)} unique)")
    return records


def load_phase_b_groups() -> list[dict]:
    path = SILVER_DIR.parent / "entity_resolution" / "entity_groups_phase_b.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["groups"]


def pick_priority(members_records: dict[str, dict], field: str, priority: list[str]):
    for source in priority:
        record = members_records.get(source)
        if record is not None:
            value = record.get(field)
            if value is not None and value != "":
                return value, source
    return None, None


def canonicalize_tag(tag: str) -> str:
    return TAG_CANONICAL_MAP.get(tag.lower().strip(), tag)


def merge_genres(members_records: dict[str, dict]) -> list[str]:
    seen_lower: dict[str, str] = {}
    for record in members_records.values():
        for genre in record.get("genres") or []:
            canonical = canonicalize_tag(genre)
            key = canonical.lower().strip()
            if key and key not in seen_lower:
                seen_lower[key] = canonical
    return sorted(seen_lower.values(), key=str.lower)


def rescale_rating(rating_raw, rating_scale: str | None) -> float | None:
    if rating_raw is None or rating_scale is None:
        return None
    if rating_scale == "0-100":
        return round(rating_raw / 10.0, 3)
    if rating_scale == "0-10":
        return round(float(rating_raw), 3)
    return None


def build_ratings(members_records: dict[str, dict]) -> dict:
    result = {
        "rating_anilist": None,
        "rating_anilist_confidence": None,
        "rating_mangaupdates": None,
        "rating_mangaupdates_confidence": None,
        "rating_combined": None,
        "rating_combined_sources": [],
    }

    anilist_record = members_records.get("anilist")
    if anilist_record:
        rating = rescale_rating(anilist_record.get("rating_raw"), anilist_record.get("rating_scale"))
        if rating is not None:
            extra = anilist_record.get("extra") or {}
            confidence = extra.get("favourites")
            if confidence is None:
                confidence = extra.get("popularity")
            result["rating_anilist"] = rating
            result["rating_anilist_confidence"] = confidence

    mu_record = members_records.get("mangaupdates")
    if mu_record:
        rating = rescale_rating(mu_record.get("rating_raw"), mu_record.get("rating_scale"))
        if rating is not None:
            extra = mu_record.get("extra") or {}
            confidence = extra.get("rating_votes")
            result["rating_mangaupdates"] = rating
            result["rating_mangaupdates_confidence"] = confidence

    weighted_sum = 0.0
    weight_total = 0.0
    sources_used = []

    if result["rating_anilist"] is not None:
        conf = result["rating_anilist_confidence"] or 0
        weight = math.log1p(max(conf, 0)) + 1.0
        weighted_sum += result["rating_anilist"] * weight
        weight_total += weight
        sources_used.append("anilist")

    if result["rating_mangaupdates"] is not None:
        conf = result["rating_mangaupdates_confidence"] or 0
        weight = math.log1p(max(conf, 0)) + 1.0
        weighted_sum += result["rating_mangaupdates"] * weight
        weight_total += weight
        sources_used.append("mangaupdates")

    if weight_total > 0:
        result["rating_combined"] = round(weighted_sum / weight_total, 3)
        result["rating_combined_sources"] = sources_used

    return result


def build_gold_record(group: dict, records_by_source: dict[str, dict[str, dict]]) -> dict:
    members_records: dict[str, dict] = {}
    source_ids: dict[str, str] = {}
    for member in group["members"]:
        source, source_id = member["source"], member["source_id"]
        record = records_by_source[source].get(source_id)
        if record is not None:
            members_records[source] = record
            source_ids[source] = source_id

    title, title_source = pick_priority(members_records, "title", TITLE_DESC_PRIORITY)
    original_title, _ = pick_priority(members_records, "original_title", TITLE_DESC_PRIORITY)
    description, description_source = pick_priority(members_records, "description", TITLE_DESC_PRIORITY)
    status_raw, status_source = pick_priority(members_records, "status_raw", CURRENCY_PRIORITY)
    chapters, _ = pick_priority(members_records, "chapters", CURRENCY_PRIORITY)
    volumes, _ = pick_priority(members_records, "volumes", CURRENCY_PRIORITY)
    year, _ = pick_priority(members_records, "year", YEAR_PRIORITY)
    cover_image_url, cover_source = pick_priority(members_records, "cover_image_url", COVER_PRIORITY)

    genres = merge_genres(members_records)
    ratings = build_ratings(members_records)

    source_urls = {
        source: record.get("url")
        for source, record in members_records.items()
        if record.get("url")
    }

    return {
        "gold_id": group["group_id"],
        "match_confidence": group["match_confidence"],
        "source_count": group["source_count"],
        "sources": sorted(members_records.keys()),
        "source_ids": source_ids,
        "title": title,
        "title_source": title_source,
        "original_title": original_title,
        "description": description,
        "description_source": description_source,
        "genres": genres,
        "status_raw": status_raw,
        "status_source": status_source,
        "chapters": chapters,
        "volumes": volumes,
        "year": year,
        **ratings,
        "cover_image_url": cover_image_url,
        "cover_image_source": cover_source,
        "source_urls": source_urls,
    }


def main() -> None:
    print("Loading Silver records for all sources...")
    records_by_source = {s: load_silver_records(s) for s in SOURCES}
    for s in SOURCES:
        print(f"  {s}: {len(records_by_source[s])}")

    print("Loading Phase B entity groups...")
    groups = load_phase_b_groups()
    print(f"  Total groups: {len(groups)}")

    gold_dir = SILVER_DIR.parent / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)

    print("Building Gold records...")
    gold_records = []
    confidence_counts: dict[str, int] = {}
    rating_combined_count = 0
    missing_title_count = 0

    for group in groups:
        gold_record = build_gold_record(group, records_by_source)
        gold_records.append(gold_record)

        confidence_counts[gold_record["match_confidence"]] = (
            confidence_counts.get(gold_record["match_confidence"], 0) + 1
        )
        if gold_record["rating_combined"] is not None:
            rating_combined_count += 1
        if gold_record["title"] is None:
            missing_title_count += 1

    print(f"Writing {len(gold_records)} records to {gold_dir} ...")
    for i in range(0, len(gold_records), RECORDS_PER_PAGE):
        page = gold_records[i:i + RECORDS_PER_PAGE]
        page_num = i // RECORDS_PER_PAGE
        page_path = gold_dir / f"page_{page_num:05d}.json"
        with page_path.open("w", encoding="utf-8") as f:
            json.dump({"records": page}, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("Gold Layer Build - Summary")
    print("=" * 60)
    print(f"Total Gold records: {len(gold_records)}")
    for label, count in sorted(confidence_counts.items()):
        print(f"  {label}: {count}")
    print(f"\nRecords with a rating_combined value : {rating_combined_count}")
    print(f"Records with NO resolvable title      : {missing_title_count}")
    print(f"\nWritten to: {gold_dir}")


if __name__ == "__main__":
    main()
