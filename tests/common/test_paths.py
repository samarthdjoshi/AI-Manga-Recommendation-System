from pathlib import Path

from common.paths import (
    PROJECT_ROOT,
    DATA_DIR,
    BRONZE_DIR,
    SILVER_DIR,
    GOLD_DIR,
    LOGS_DIR,
    ANILIST_BRONZE_DIR,
    MANGADEX_BRONZE_DIR,
    JIKAN_BRONZE_DIR,
    MANGAUPDATES_BRONZE_DIR,
)


def test_project_root_exists() -> None:
    assert PROJECT_ROOT.exists()
    assert PROJECT_ROOT.is_dir()


def test_data_directories_exist() -> None:
    assert DATA_DIR.exists()
    assert BRONZE_DIR.exists()
    assert SILVER_DIR.exists()
    assert GOLD_DIR.exists()


def test_logs_directory_exists() -> None:
    assert LOGS_DIR.exists()


def test_bronze_source_directories_exist() -> None:
    assert ANILIST_BRONZE_DIR.exists()
    assert MANGADEX_BRONZE_DIR.exists()
    assert JIKAN_BRONZE_DIR.exists()
    assert MANGAUPDATES_BRONZE_DIR.exists()


def test_paths_are_path_objects() -> None:
    paths = (
        PROJECT_ROOT,
        DATA_DIR,
        BRONZE_DIR,
        SILVER_DIR,
        GOLD_DIR,
        LOGS_DIR,
        ANILIST_BRONZE_DIR,
        MANGADEX_BRONZE_DIR,
        JIKAN_BRONZE_DIR,
        MANGAUPDATES_BRONZE_DIR,
    )

    for path in paths:
        assert isinstance(path, Path)