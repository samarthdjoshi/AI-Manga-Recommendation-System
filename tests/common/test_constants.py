from common.constants import *


def test_project_name():
    assert PROJECT_NAME


def test_project_version():
    assert PROJECT_VERSION


def test_default_timeout():
    assert DEFAULT_TIMEOUT > 0


def test_retry_count():
    assert DEFAULT_RETRIES >= 0


def test_page_size():
    assert DEFAULT_PAGE_SIZE > 0
    assert MAX_PAGE_SIZE >= DEFAULT_PAGE_SIZE


def test_extensions():
    assert JSON_EXTENSION == ".json"
    assert PARQUET_EXTENSION == ".parquet"
    assert CSV_EXTENSION == ".csv"