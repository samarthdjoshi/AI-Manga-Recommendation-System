import logging

from common.logger import get_logger


def test_get_logger_returns_logger() -> None:
    logger = get_logger("test")

    assert isinstance(logger, logging.Logger)


def test_logger_name() -> None:
    logger = get_logger("example")

    assert logger.name == "example"


def test_logger_has_handlers() -> None:
    logger = get_logger("handlers")

    assert len(logger.handlers) >= 2


def test_logger_level() -> None:
    logger = get_logger("level")

    assert logger.level == logging.INFO


def test_logger_singleton_handlers() -> None:
    logger1 = get_logger("singleton")
    logger2 = get_logger("singleton")

    assert logger1 is logger2
    assert len(logger1.handlers) == len(logger2.handlers)