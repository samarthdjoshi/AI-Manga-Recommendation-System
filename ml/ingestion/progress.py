"""
Progress tracking and terminal reporting for long-running downloads.
"""

from __future__ import annotations

import time


class ProgressTracker:
    """Tracks and displays progress for a paginated download job."""

    def __init__(self, source_name: str, total_pages: int | None = None) -> None:
        self.source_name = source_name
        self.total_pages = total_pages
        self.start_time = time.monotonic()
        self.records_downloaded = 0
        self.current_page = 0

    def update(self, page: int, records_in_page: int) -> None:
        """Update tracker state after a page finishes downloading."""

        self.current_page = page
        self.records_downloaded += records_in_page

    def _elapsed(self) -> float:
        return time.monotonic() - self.start_time

    def _format_time(self, seconds: float) -> str:
        seconds = max(0, int(seconds))
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def _eta_seconds(self) -> float | None:
        if not self.total_pages or self.current_page == 0:
            return None

        elapsed = self._elapsed()
        rate = elapsed / self.current_page
        remaining_pages = max(0, self.total_pages - self.current_page)
        return rate * remaining_pages

    def _speed(self) -> float:
        elapsed = self._elapsed()
        if elapsed == 0:
            return 0.0
        return self.records_downloaded / elapsed

    def render(self) -> str:
        """Return a formatted progress block for terminal display."""

        lines = ["=" * 50, "", f"{self.source_name} Downloader", ""]

        if self.total_pages:
            progress_pct = (self.current_page / self.total_pages) * 100
            lines.append(f"Current Page : {self.current_page} / {self.total_pages}")
            lines.append(f"Progress     : {progress_pct:.1f}%")
        else:
            lines.append(f"Current Page : {self.current_page}")

        lines.append(f"Records      : {self.records_downloaded}")
        lines.append(f"Elapsed      : {self._format_time(self._elapsed())}")
        lines.append(f"Speed        : {self._speed():.1f} records/sec")

        eta = self._eta_seconds()
        if eta is not None:
            lines.append(f"ETA          : {self._format_time(eta)}")

        lines.append("")
        lines.append("=" * 50)

        return "\n".join(lines)

    def print_progress(self) -> None:
        print(self.render())
