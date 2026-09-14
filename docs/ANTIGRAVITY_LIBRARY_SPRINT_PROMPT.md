# Antigravity Master Execution Prompt — Library Management, Import, and Export

Run this sprint only after the active Advanced Search and Continue Reading
sprint is complete, verified, and recorded in `ANTIGRAVITY_PROGRESS.md`.
Do not edit the same frontend/API surfaces concurrently with another active
agent.

## Workspace and safety

Work only in `G:\AI-Manga-Recommendation-System-AG`.

- Do not touch, inspect, compare against, copy to, build from, or test the
  historical D-drive project.
- Use only `G:\AI-Manga-Recommendation-System-AG\venv312\Scripts\python.exe`
  for Python commands.
- Preserve all uncommitted work. Never reset, clean, checkout, overwrite, or
  delete existing user work.
- Never read, expose, log, or commit `.env`.
- Do not rebuild catalog data.

Read before acting:

1. `ANTIGRAVITY_PROGRESS.md`
2. `docs\ANTIGRAVITY_HANDOFF.md`
3. `docs\ANTIGRAVITY_NEXT_SPRINT_PROMPT.md`
4. `.agents\rules\autonomous-cto.md`
5. `.github\copilot-instructions.md`
6. `docs\g-drive-only-operations.md`
7. This file

## Goal

Add a polished, private library-management feature suitable for a university
capstone:

1. Custom user lists.
2. Private per-title tags.
3. Safe bulk editing for a user’s own tracked titles.
4. User-controlled JSON and CSV library export.
5. Safe, preview-first library import.

Build on existing local auth, favorites, tracking, profile, and SQLite only.
Do not add external account sync, OAuth, background sync, social features,
browser extensions, notifications, payments, or collection-marketplace
features. Import is file-based only: users explicitly upload an export file;
the app must never connect to or scrape a third-party account.

## Phase A — smallest accurate data model

Inspect the current `auth` models, routes, schemas, tracking endpoints, profile
page, and API tests before editing.

Add only the tables/relations needed for:

- A user-owned custom list with a unique, validation-bounded name.
- A user-owned custom-list entry pointing to a catalog `gold_id`.
- Private tags attached to a user’s own tracked title or saved library entry.

Requirements:

- Enforce uniqueness at the database level where appropriate.
- Every query and mutation must filter by the authenticated user id.
- Validate catalog IDs before adding them.
- Validate names/tag lengths and request-list sizes.
- Use database transactions for bulk changes: all requested valid updates apply,
  or none apply. Return a clear client-safe validation error for invalid items.
- Do not duplicate an existing favorite/tracking model or weaken existing APIs.

## Phase B — API surface

Provide a small, consistent authenticated API:

- Create, rename, list, and delete a custom list.
- Add/remove an existing catalog title to/from a custom list.
- List a user’s entries by custom list.
- Set/remove private tags for a title in the user’s library.
- Bulk update only the current user’s tracked titles: supported fields should be
  status, progress, score, private tags, and list membership where a safe,
  explicit payload can represent them.
- Export only the current authenticated user’s data.

Import requirements:

- Support a round-trip import of MangaVerse’s own versioned JSON and CSV
  exports. Add adapters for AniList and MyAnimeList manga-library export files
  only after verifying their actual formats from documentation or samples; do
  not guess a schema or claim unverified support.
- Accept only `.json` and `.csv`, with strict server-side file-size, row-count,
  encoding, and field-length limits. Parse data only; never execute it. Defend
  against malformed files and spreadsheet-formula injection in later CSV export.
- Provide a dry-run preview first: valid rows, skipped rows/reasons, proposed
  catalog matches/confidence, and conflicts—without database writes.
- Require explicit confirmation using a short-lived preview token. Revalidate
  it server-side and scope every write to the authenticated user.
- Prefer stable source IDs for matching. Otherwise use conservative
  normalized-title/year/type matching; ambiguous or no-match rows must be
  skipped for review, never automatically guessed.
- Default conflicts to `keep existing`; optionally allow `fill missing fields`
  or `replace imported fields`. Never erase user data without that explicit
  choice. Confirmed imports must be transactional and idempotent: no duplicate
  list membership or tags when the same file is imported again.
- Import only user-owned library fields: tracking, favorite state, private
  tags, and custom-list membership. Never import credentials, tokens, or
  another user’s data.

Export requirements:

- Support JSON and CSV download responses.
- Include user-owned favorites, tracking fields, custom lists, list membership,
  and private tags.
- Include stable catalog IDs and title data only when it can be resolved from
  the local catalog.
- Include a schema/version marker and generation time in JSON.
- Return user-safe errors; never include database paths, passwords, tokens,
  other users’ records, or internal exceptions.
- Set correct content type and `Content-Disposition: attachment` filename.

## Phase C — frontend

Reuse current semantic theme tokens and components. Keep the normal experience
simple:

- Add a “My Library” route or evolve Profile only if that avoids duplicate UI.
- Show custom lists, tracking-status groups, favorites, and private tags in a
  clear hierarchy.
- Add a compact “Manage” mode with explicit multi-select and bulk actions;
  never make ordinary browsing look like a spreadsheet.
- Allow create/rename/delete list with accessible confirmation before delete.
- Allow add/remove title to/from lists from a manga detail page or library item.
- Make tags private by default and label them clearly.
- Add an “Export my library” action with JSON and CSV choices, explaining that
  it downloads only the signed-in user’s saved data.
- Add an “Import library” flow beside export. It must state that imports are
  private, file-based, and do not connect to third-party accounts. Use: choose
  format → upload → review preview/conflicts → choose policy → confirm → show
  a concise imported/skipped summary with reasons.
- Make `keep existing` the default; explain replacement plainly. Do not expose
  raw uploads, secrets, or an irreversible destructive action in the UI.
- Include loading, empty, error, retry, disabled/busy, success feedback, and
  unauthenticated states.
- Use an accessible mobile layout, keyboard focus, labels, semantic controls,
  and no horizontal overflow.

## Phase D — tests and verification

Add focused backend integration tests for:

- authentication required;
- custom list CRUD and duplicate-name handling;
- catalog ID validation;
- cross-user isolation / IDOR prevention;
- bulk update validation and atomicity;
- private tags;
- JSON/CSV export content and absence of another user’s records.
- own JSON/CSV round-trip import, malformed/oversize rejection, and preview
  creating no writes;
- confirmation requirement, idempotency, transaction rollback, conservative
  matching, skipped-row reasons, and conflict policies;
- cross-user isolation / IDOR prevention for preview and confirmation tokens.

Add frontend checks where infrastructure exists. Otherwise, perform targeted
browser QA for the changed library, profile, and manga-detail flows.

Test these journeys:

1. Register/login → track a title → add private tags → create a list → add the
   title → refresh → verify persistence.
2. Select multiple owned tracking entries → bulk update status → verify every
   selected title changed and unselected titles did not.
3. Export JSON and CSV → verify own fields are present and another user’s
   records are absent.
4. Import that export → preview → confirm with `keep existing` → verify a
   correct non-duplicated round trip; repeat once to prove idempotency.
5. Import an ambiguous/malformed sample → verify no bad automatic match and no
   partial write.
6. Attempt another user’s list/entry/export/import-preview access → verify
   failure/no data.

Run targeted tests after changes. Run the full Python suite, frontend lint,
frontend production build, `pip check`, Git/.env audit, and relevant browser
QA once at this sprint’s final gate.

## Completion discipline

Update `ANTIGRAVITY_PROGRESS.md` after each substantial feature with actual
evidence. Do not claim AniList parity or deployment readiness merely because
this sprint passes. Clearly record that live third-party account sync/OAuth is
deferred and needs separate authorization, provider terms review, conflict
resolution, and privacy design.
