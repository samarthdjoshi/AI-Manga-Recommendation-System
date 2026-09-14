# Antigravity continuation handoff

## Workspace to open

Open this exact folder in Antigravity:

`G:\AI-Manga-Recommendation-System-AG`

Do not open, modify, build, test, or copy work into the historical D-drive
project. This G-drive folder is the single current source of truth.

## Important state

- The working tree is intentionally dirty. Preserve all existing uncommitted
  changes; do not reset, checkout, clean, or overwrite them.
- `.env` is local-only and must not be read, copied, committed, or displayed.
- Use only `G:\AI-Manga-Recommendation-System-AG\venv312\Scripts\python.exe`
  for Python commands in this project.
- The G virtual environment was repaired so project imports resolve to G, not D.
- Silver and Gold build scripts contain a guard that refuses to run if the
  shell directory and imported project root do not match.

## Read before changing code

1. `ANTIGRAVITY — AUTONOMOUS CTO MODE MASTER EXECUTION PROMPT.md`
2. `.agents\rules\autonomous-cto.md`
3. `.github\copilot-instructions.md`
4. `ANTIGRAVITY_PROGRESS.md`
5. `docs\g-drive-only-operations.md`
6. This file

## Work completed in Codex (reuse; do not redo)

- Core catalog/search/browse/detail/recommendation functionality.
- Authentication, favorites, personalized/hybrid recommendations, and six-tool
  chat with fallback/error hardening.
- CORS/JWT/chat payload/security hardening and safe description rendering.
- Metadata plumbing for type, demographic, authors, and artists.
- G-drive isolation, build safety guard, and operations documentation.
- Responsive home/browse/detail fixes and earlier browser QA.
- New persisted tracking API: status, progress, score, notes, update/remove,
  catalog validation, and ownership isolation.
- New manga-detail tracking panel, profile page, and profile statistics built
  from real saved tracking/favorite records.

## Verified evidence

- Standard Python suite before the latest profile UI work: `50 passed, 1 skipped`.
- Tracking API integration suite after tracking work:
  `tests/api/test_auth_favorites.py` → `5 passed`.
- Frontend lint passes after profile statistics.
- Frontend production build passes after profile statistics:
  `329.19 kB JS / 102.85 kB gzip`.
- `pip check` passed and `.env` is not Git-tracked.

## Current resume point

The next unfinished requirement is **an honest Manga Meter and Vibe Chart
audit**. Do not add either visualization until current Gold/API fields are
inspected and proven sufficient. Use only real rating, source, genre, tag, or
metadata values; provide clear insufficient-data states rather than invented
scores.

After that, continue in this order:

1. Integrate any supported Meter/Vibe functionality into manga detail.
2. Audit search/browse edge cases and failure states.
3. Audit AI combined tools/failure handling without paid external calls.
4. Accessibility and performance pass for newly changed UI.
5. Small maintainable E2E coverage for registration, favorite, tracking,
   profile/statistics, and chat journeys.
6. Browser QA for changed routes at required breakpoints.
7. Final security/hostile-user pass and final release gates.

## Known constraints / blockers

- Do not rebuild Silver/Gold unless real metadata refresh is necessary. If it
  becomes necessary, follow `docs\g-drive-only-operations.md` exactly.
- Real-catalog smoke testing is intentionally opt-in because it loads the full
  catalog.
- The previous Codex environment intermittently could not keep a local API
  process bound to port 8000 for browser verification. Backend import and
  isolated API integration tests worked. Retest browser tracking/profile flows
  when Antigravity's local host can run the API.
- Repository-wide Ruff has an existing backlog. Do not bulk-autofix the dirty
  inherited worktree without reviewing the scope first.

## First Antigravity prompt

Use this prompt in Antigravity after opening the G-drive folder:

> Read `docs/ANTIGRAVITY_HANDOFF.md`, `ANTIGRAVITY_PROGRESS.md`, the CTO
> instructions, and the current Git status. Continue only from the documented
> G-drive workspace. Preserve all uncommitted changes, do not touch D drive,
> do not redo verified work, and begin with the Manga Meter/Vibe Chart data
> sufficiency audit. Use targeted tests and update `ANTIGRAVITY_PROGRESS.md`
> after each substantial step.
