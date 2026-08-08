import json
import numpy as np

from common.paths import SILVER_DIR

gold_dir = SILVER_DIR.parent / "gold"

records = []
for page_file in sorted(gold_dir.glob("page_*.json")):
    data = json.loads(page_file.read_text(encoding="utf-8"))
    records.extend(data.get("records", []))

no_genre = sum(1 for r in records if not r.get("genres"))
no_description = sum(1 for r in records if not r.get("description"))
both_missing = sum(1 for r in records if not r.get("genres") and not r.get("description"))
total = len(records)

print(f"Total Gold records: {total}")
print(f"No genres: {no_genre} ({no_genre/total*100:.1f}%)")
print(f"No description: {no_description} ({no_description/total*100:.1f}%)")
print(f"BOTH missing (worst case - near-pure numeric collision risk): {both_missing} ({both_missing/total*100:.1f}%)")

# Among the "both missing" group, how much do they actually vary on
# the numeric block alone? If most share the same year/rating/chapter
# bucket too, collisions could be extremely common within this group.
both_missing_records = [r for r in records if not r.get("genres") and not r.get("description")]
years = [r.get("year") for r in both_missing_records if r.get("year")]
print(f"\nOf the {both_missing} fully-sparse records, {len(years)} have a year set ({len(years)/both_missing*100:.1f}% if nonzero)")
