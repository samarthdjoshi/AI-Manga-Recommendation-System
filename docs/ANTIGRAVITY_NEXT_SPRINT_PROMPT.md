# Antigravity Master Execution Prompt — Next Sprint

You are continuing an existing, legal, manga-only discovery and tracking
platform. Work autonomously within the defined sprint, but do not restart,
redesign, or duplicate completed systems.

## 1. Absolute operating rules

Work only in:

`G:\AI-Manga-Recommendation-System-AG`

- Never touch, open, read from, compare against, copy to, build from, or test
  the historical D-drive project.
- Use only `G:\AI-Manga-Recommendation-System-AG\venv312\Scripts\python.exe`
  for Python commands.
- Preserve the dirty worktree. Never run `git reset`, `git clean`, destructive
  checkout commands, or bulk overwrites. Do not delete a file merely to make
  Git status look clean.
- Never read, display, copy, log, or commit `.env`.
- Do not rebuild Bronze, Silver, or Gold catalog data unless a feature is
  proven impossible without it. If a rebuild is genuinely required, follow
  `docs\g-drive-only-operations.md` exactly and keep every write on G.
- This is a legal tracker/discovery product: never host chapters, integrate
  piracy sources, scrape readers, or represent unofficial sources as official.

## 2. Read once before acting

1. `ANTIGRAVITY_PROGRESS.md`
2. `docs\ANTIGRAVITY_HANDOFF.md`
3. `docs\g-drive-only-operations.md`
4. `.agents\rules\autonomous-cto.md`
5. `.github\copilot-instructions.md`
6. This file

Inspect current Git status and relevant code only. The working tree—not a
historical prompt—is the source of truth.

## 3. Verified existing work — reuse and do not redo

The following exists in the current G checkout. Inspect it only when a new
change depends on it:

- 339,941-record local Gold catalog stored as paged JSON files under
  `data\gold` (do not assume a parquet file exists).
- Search, browse, detail, recommendations, favorites, tracking, profile, and
  real profile statistics.
- Manga Meter with rating-source transparency and honest insufficient-rating
  state.
- Vibe Chart from real genre/tag mapping with honest insufficient-data state.
- Secure auth, CORS, JWT, API validation, chat hardening, six chat tools, and
  Gemini/Ollama graceful fallback.
- Real-time AniList public discovery feeds with cache and local fallback.
- Discovery, Top 100, Manhwa, home rails, responsive navigation, themes, and
  design tokens.
- E2E user-journey coverage, discovery-service coverage, and targeted hostile
  input coverage.

Reported prior gates are useful evidence, but do not assume servers are still
running. At the final release gate, verify the current code once.

## 4. Sprint objective

Deliver a simple, powerful **advanced manga search and library-continuity
experience**. It must feel approachable for new users while exposing advanced
controls progressively. Do not add every imaginable feature, social system,
or external integration in this sprint.

Priority order:

1. Advanced search and browse correctness
2. Reading continuity based on real saved tracking records
3. Accessibility, mobile usability, and resilience for changed routes
4. Optional PWA/offline library investigation only if the core two goals are
   complete and can be implemented safely without inventing offline data

## 5. Phase A — capability and data audit

Before coding, inspect only:

- current `/browse`, `/search`, `/search/suggest`, relevant recommender-service
  methods, API schemas, and Browse/Search frontend components;
- Gold fields actually exposed by the API;
- current tracking model and profile/home components.

Create a concise internal matrix:

| Capability | Supported by current data/API | Current UI | Action |

Classify each candidate as: already complete, implement now, needs backend
work, or unavailable. Do not claim author, artist, tag, status, demographic,
source, official-link, or rating filters are supported until the current API
and data prove it.

## 6. Phase B — advanced search and browse

Implement only filters backed by actual Gold/API fields. Prefer the following
when supported, in this order:

1. Include genres/tags with AND/OR choice and exclude genres/tags.
2. Manga / manhwa / manhua type.
3. Demographic and publication status.
4. Release-year range, chapter range, rating range, and source count.
5. Author/artist only if the search index/API can accurately support it.
6. Official-reading availability only if it is reliably represented.

Requirements:

- Keep basic title search prominent.
- Put advanced filters in a collapsible desktop panel and an accessible mobile
  drawer; do not overwhelm the default view.
- Persist supported filters and pagination in the URL.
- Show active filter chips, a one-click reset, result count, and clear empty
  states.
- Validate all request bounds server-side. Reject malformed, oversized, or
  unsupported parameters with clean 422/400 contracts; never silently pretend
  a filter worked.
- Preserve Unicode, punctuation, whitespace, rapid typing, cancellation/race
  safety, API failure behavior, and explicit-content filtering.
- Do not add filters that scan the full 339k catalog inefficiently on every
  keystroke. Measure first; add lightweight indexes/precomputed structures only
  when current code demonstrates a bottleneck.

Testing:

- Add focused API tests for each new filter, include/exclude interaction,
  invalid bounds, pagination, no-results behavior, and backwards compatibility.
- Add frontend behavior tests if test infrastructure exists; otherwise browser
  QA on changed routes is required.

## 7. Phase C — reading continuity

Build on the existing private tracking system only. Add the smallest useful
set of features supported by real stored data:

- A compact progress indicator on tracked manga cards when chapter total and
  user progress are both known.
- An authenticated “Continue Reading” shelf on the home page, ordered by real
  tracking `updated_at` and limited to Reading/Re-reading entries.
- A clear update-progress action that preserves the current status, score, and
  notes.
- Honest states for unknown chapter totals; never display a made-up percentage.

Do not add notifications, calendar reminders, automatic reader sync, browser
extensions, or external tracking OAuth in this sprint. Those require explicit
credentials, platform terms review, a data-mapping plan, and user consent.

Testing:

- Verify empty, one-item, many-item, unknown-total, unauthenticated, and
  cross-user cases.
- Verify tracking updates survive refresh and do not modify other users’ data.

## 8. Phase D — UX, accessibility, and resilience

Audit only changed UI:

- keyboard navigation and visible focus;
- labels, semantic controls, accessible drawer/modal behavior;
- touch targets and 320/375/390/414/768/1024 widths for changed routes;
- no accidental horizontal scrolling;
- loading, no-result, offline/API-error, and retry states;
- no raw errors, undefined text, or broken-image regressions.

Respect `prefers-reduced-motion` for newly added motion. Reuse the existing
theme-token system; do not make a custom-theme studio this sprint.

## 9. Explicitly out of scope for this sprint

Do not implement unless the user starts a separately authorized sprint:

- reviews, comments, forums, clubs, activity feeds, or chapter discussions;
- sentiment analysis;
- custom user-defined theme editor;
- full PWA offline persistence beyond a documented feasibility assessment;
- browser extensions, automatic reading-site detection, scraping, or reader
  integrations;
- AniList/MAL account sync or import/export, until OAuth/terms/privacy/data
  mapping are designed and approved;
- physical collection scanner, budget tracker, 3D bookshelf, gamification, or
  social features.

## 10. Evidence-first execution and credit control

For each bounded change:

1. Inspect the smallest relevant surface.
2. Implement the smallest complete change.
3. Run targeted tests.
4. Run related regression checks only when shared code changed.
5. Update `ANTIGRAVITY_PROGRESS.md` concisely with completed work, evidence,
   known limitations, and the exact next action.

Do not use broad reconnaissance subagents. Use at most two subagents only when
their tasks are concrete and independent. Do not repeatedly run the full test
suite, rebuild frontend, run catalog smoke tests, or redo browser QA for
unchanged pages.

## 11. Completion gates

At the end of this sprint, after all changed features are complete:

1. Run the full Python suite once with the required G interpreter.
2. Run frontend lint and production build once.
3. Run `pip check`.
4. Run browser QA only for changed routes/components and affected widths.
5. Inspect Git status and verify `.env` is not tracked.
6. Update `ANTIGRAVITY_PROGRESS.md` with actual results—not assumed ones.

Do not claim full AniList parity, production completion, or deployment readiness
based on this sprint alone. Report exactly what is implemented, reused,
deferred, unsupported by current data, or blocked by external requirements.
