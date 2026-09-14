"""
Merge script: fold fetched AniList externalLinks into the gold catalog.

Reads data/entity_resolution/anilist_external_links.jsonl (produced by
fetch_external_links.py) and adds an `official_links` field to each
matching record in data/gold/page_*.json.

official_links shape per record:
{
  "read": [ {"url": ..., "site": ..., "language": ...}, ... ],  # STREAMING only
  "info": [ {"url": ..., "site": ..., "language": ...}, ... ]   # INFO only
}
SOCIAL_MEDIA and any other link types are dropped - not useful for
either purpose.

Records with no external links at all still get official_links with
empty "read"/"info" lists, so the field is always present and the
frontend doesn't need to special-case its absence.

Safe to rerun: fully recomputes official_links from the jsonl each
time, so reruns are idempotent rather than double-appending.

IMPORTANT: back up data/gold before running this, since this
overwrites gold files in place.

Usage (from project root):
    python scripts/merge_external_links.py
"""
from __future__ import annotations

import json
from pathlib import Path

GOLD_DIR = Path("data/gold")
LINKS_PATH = Path("data/entity_resolution/anilist_external_links.jsonl")


def load_links_by_gold_id() -> dict[str, dict]:
    """Return {gold_id: {"read": [...], "info": [...]}} built from the jsonl."""
    result: dict[str, dict] = {}
    with open(LINKS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            read_links = []
            info_links = []
            for link in row["external_links"]:
                entry = {
                    "url": link.get("url"),
                    "site": link.get("site"),
                    "language": link.get("language"),
                }
                if link.get("type") == "STREAMING":
                    read_links.append(entry)
                elif link.get("type") == "INFO":
                    info_links.append(entry)
                # any other type (e.g. SOCIAL_MEDIA) is dropped
            result[row["gold_id"]] = {"read": read_links, "info": info_links}
    return result


def main() -> None:
    print("Loading external links...")
    links_by_gold_id = load_links_by_gold_id()
    print(f"Loaded links for {len(links_by_gold_id)} gold_ids.")

    empty_links = {"read": [], "info": []}
    total_records = 0
    records_with_read_links = 0

    gold_files = sorted(GOLD_DIR.glob("page_*.json"))
    print(f"Updating {len(gold_files)} gold files...")

    for path in gold_files:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for record in data["records"]:
            total_records += 1
            gold_id = record["gold_id"]
            official_links = links_by_gold_id.get(gold_id, empty_links)
            record["official_links"] = official_links
            if official_links["read"]:
                records_with_read_links += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

        print(f"  {path.name} updated ({len(data['records'])} records)")

    print()
    print(f"Total gold records: {total_records}")
    print(f"Records with at least one 'read' link: {records_with_read_links}")
    print("Done.")


if __name__ == "__main__":
    main()
