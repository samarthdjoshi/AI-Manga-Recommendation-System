import json
from pathlib import Path
from common.paths import SILVER_DIR

d = SILVER_DIR / "mangadex"
files = sorted(d.glob("page_*.json"))

target_ids = {
    "d7076ac3-de07-4d93-bace-0db78e9d4a1a",
    "61b65baf-8ba1-4a7f-bff8-abaaaede7104",
    "02860cdf-1020-40f1-a23f-2025d80f6290",
}

found = {}
for f in files:
    data = json.loads(f.read_text(encoding="utf-8"))
    for r in data.get("records", []):
        if r["source_id"] in target_ids:
            found.setdefault(r["source_id"], []).append((f.name, r))

print(f"IDs found: {list(found.keys())}")
print()

for sid, occurrences in found.items():
    print(f"--- {sid} ---")
    print(f"  occurrences found: {len(occurrences)}")
    for fname, rec in occurrences:
        print(f"  file={fname} title={rec.get('title')!r}")
    if len(occurrences) == 2:
        a = json.dumps(occurrences[0][1], sort_keys=True)
        b = json.dumps(occurrences[1][1], sort_keys=True)
        print(f"  BYTE-IDENTICAL: {a == b}")
    print()
