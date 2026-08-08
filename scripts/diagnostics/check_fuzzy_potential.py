import json
import re
from pathlib import Path

from common.paths import SILVER_DIR


def normalize(title: str) -> str:
    title = title.lower()
    title = re.sub(r"[^a-z0-9]+", " ", title)
    return title.strip()


def load_silver_records(source_name: str) -> list[dict]:
    silver_dir = SILVER_DIR / source_name
    records = []
    for page_file in sorted(silver_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def load_singleton_ids(source_name: str) -> set[str]:
    groups_path = SILVER_DIR.parent / "entity_resolution" / "entity_groups.json"
    data = json.loads(groups_path.read_text(encoding="utf-8"))
    ids = set()
    for group in data["groups"]:
        if group["source_count"] == 1:
            for member in group["members"]:
                if member["source"] == source_name:
                    ids.add(member["source_id"])
    return ids


anilist_records = load_silver_records("anilist")
mangaupdates_records = load_silver_records("mangaupdates")

anilist_singleton_ids = load_singleton_ids("anilist")
mangaupdates_singleton_ids = load_singleton_ids("mangaupdates")

anilist_title_index: dict[str, list[str]] = {}
for record in anilist_records:
    if record["source_id"] in anilist_singleton_ids:
        norm = normalize(record["title"])
        anilist_title_index.setdefault(norm, []).append(record["source_id"])

matches = 0
match_examples = []

for record in mangaupdates_records:
    if record["source_id"] not in mangaupdates_singleton_ids:
        continue
    norm = normalize(record["title"])
    if norm in anilist_title_index:
        matches += 1
        if len(match_examples) < 10:
            match_examples.append((record["title"], norm))

print(f"AniList singletons: {len(anilist_singleton_ids)}")
print(f"MangaUpdates singletons: {len(mangaupdates_singleton_ids)}")
print(f"Exact normalized-title matches found: {matches}")
print(f"\nSample matches:")
for title, norm in match_examples:
    print(f"  - {title!r} (normalized: {norm!r})")
