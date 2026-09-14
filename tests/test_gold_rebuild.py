from __future__ import annotations

import json
from unittest.mock import Mock

from scripts.build_gold import load_existing_official_links


def test_existing_official_links_are_retained_for_rebuild() -> None:
    page = Mock()
    page.read_text.return_value = json.dumps(
        {
            "records": [
                {"gold_id": "keep", "official_links": {"read": [{"url": "https://example.com"}]}},
                {"gold_id": "skip"},
            ]
        }
    )
    gold_dir = Mock()
    gold_dir.glob.return_value = [page]

    assert load_existing_official_links(gold_dir) == {
        "keep": {"read": [{"url": "https://example.com"}]}
    }
