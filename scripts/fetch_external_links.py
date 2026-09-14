"""
Enrichment script: fetch AniList `externalLinks` (official/legal reading
platforms) for every title already in the gold catalog.

This does NOT touch the existing bronze/silver/gold pipeline. It reads
gold_id + anilist_id pairs from data/gold, batches the AniList IDs, and
writes gold_id -> external_links results to a standalone JSONL file for
a later merge step.

Resumable: already-processed gold_ids are skipped on rerun by checking
the output file first.

Usage (from project root):
    python scripts/fetch_external_links.py
"""
from __future__ import annotations

import json
from pathlib import Path

from ml.clients.anilist_client import AniListClient

GOLD_DIR = Path("data/gold")
OUTPUT_PATH = Path("data/entity_resolution/anilist_external_links.jsonl")
BATCH_SIZE = 50


def load_gold_anilist_ids() -> dict[int, str]:
    """Return {anilist_id: gold_id} for every gold record with an AniList source."""
    mapping: dict[int, str] = {}
    for path in sorted(GOLD_DIR.glob("page_*.json")):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for record in data["records"]:
            anilist_id = record.get("source_ids", {}).get("anilist")
            if anilist_id:
                mapping[int(anilist_id)] = record["gold_id"]
    return mapping


def load_already_done() -> set[str]:
    """Return gold_ids already written to the output file, for resume support."""
    if not OUTPUT_PATH.exists():
        return set()
    done = set()
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            done.add(json.loads(line)["gold_id"])
    return done


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Loading gold_id -> anilist_id mapping...")
    id_to_gold = load_gold_anilist_ids()
    print(f"Found {len(id_to_gold)} gold records with an AniList ID.")

    already_done = load_already_done()
    if already_done:
        print(f"Resuming: {len(already_done)} gold_ids already fetched, skipping those.")

    pending_ids = [
        aid for aid, gid in id_to_gold.items() if gid not in already_done
    ]
    print(f"{len(pending_ids)} AniList IDs left to fetch.")

    client = AniListClient()
    total_batches = (len(pending_ids) + BATCH_SIZE - 1) // BATCH_SIZE

    with open(OUTPUT_PATH, "a", encoding="utf-8") as out_f:
        for batch_num in range(total_batches):
            batch_ids = pending_ids[
                batch_num * BATCH_SIZE : (batch_num + 1) * BATCH_SIZE
            ]
            print(f"Batch {batch_num + 1}/{total_batches} ({len(batch_ids)} IDs)...")

            try:
                response = client.get_external_links_batch(batch_ids)
            except Exception as e:
                print(f"  ERROR on batch {batch_num + 1}: {e}")
                print("  Skipping this batch — rerun the script later to retry it.")
                continue

            media_list = response.get("data", {}).get("Page", {}).get("media", [])
            for media in media_list:
                anilist_id = media["id"]
                gold_id = id_to_gold.get(anilist_id)
                if not gold_id:
                    continue
                links = media.get("externalLinks") or []
                out_f.write(
                    json.dumps({"gold_id": gold_id, "anilist_id": anilist_id, "external_links": links})
                    + "\n"
                )
            out_f.flush()

    print("Done. Results written to", OUTPUT_PATH)


if __name__ == "__main__":
    main()
