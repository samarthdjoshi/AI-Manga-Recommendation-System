import json
from pathlib import Path
from common.paths import SILVER_DIR

gold_dir = SILVER_DIR.parent / "gold"
sample = []
for page_file in sorted(gold_dir.glob("page_*.json"))[:3]:
    data = json.loads(page_file.read_text(encoding="utf-8"))
    sample.extend(data.get("records", [])[:5])

for r in sample[:5]:
    print(r.get("gold_id"), "->", r.get("title"))
    print("  top-level keys:", sorted(r.keys()))
    print("  extra:", r.get("extra"))
    print()
