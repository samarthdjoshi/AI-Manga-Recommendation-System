from __future__ import annotations

from pathlib import Path

import pytest

import common.paths as paths


def test_data_build_requires_current_project_root(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(paths, "PROJECT_ROOT", Path("C:/expected-project"))
    monkeypatch.setattr(paths.Path, "cwd", classmethod(lambda _cls: Path("C:/other-project")))

    with pytest.raises(RuntimeError, match="Refusing data build"):
        paths.require_current_project_root()
