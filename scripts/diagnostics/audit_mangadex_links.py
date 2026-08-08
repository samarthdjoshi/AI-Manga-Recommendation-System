import json
from collections import Counter
from pathlib import Path

from common.paths import MANGADEX_BRONZE_DIR

page_files = sorted(MANGADEX_BRONZE_DIR.glob("page_*.json"))

total = 0
has_links = 0
has_al = 0
has_mu = 0
has_mal = 0
has_both_al_mu = 0

for page_file in page_files:
    data = json.loads(page_file.read_text(encoding="utf-8"))
    for record in data.get("data", []):
        total += 1
        links = (record.get("attributes", {}) or {}).get("links") or {}
        if links:
            has_links += 1
        if links.get("al"):
            has_al += 1
        if links.get("mu"):
            has_mu += 1
        if links.get("mal"):
            has_mal += 1
        if links.get("al") and links.get("mu"):
            has_both_al_mu += 1

print(f"Total MangaDex records : {total}")
print(f"Has any links field    : {has_links} ({has_links/total*100:.1f}%)")
print(f"Has AniList link (al)  : {has_al} ({has_al/total*100:.1f}%)")
print(f"Has MangaUpdates (mu)  : {has_mu} ({has_mu/total*100:.1f}%)")
print(f"Has MAL link (mal)     : {has_mal} ({has_mal/total*100:.1f}%)")
print(f"Has BOTH al and mu     : {has_both_al_mu} ({has_both_al_mu/total*100:.1f}%)")
