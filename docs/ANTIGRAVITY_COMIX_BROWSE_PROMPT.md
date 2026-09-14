# Browse Page: Comix-Inspired Advanced Search Sprint

Work only in `G:\AI-Manga-Recommendation-System-AG`. Preserve all uncommitted work. Do not touch `D:\PROJECTS\AI-Manga-Recommendation-System` in any way. Use only the G-drive virtual environment. Do not read, print, or commit `.env` or any secret. This is a single bounded frontend-and-contract sprint, to start only after the active Chat Assistant Reliability sprint has reached a safe stopping point. Do not merge it with unrelated feature work.

Read `docs/ANTIGRAVITY_HANDOFF.md`, `ANTIGRAVITY_PROGRESS.md`, the CTO instructions, `docs/g-drive-only-operations.md`, and the current Git status before editing. Inspect the current Browse route, its search/filter API contract, existing advanced-search work, theme system, and automated tests. Preserve working filters and do not silently replace supported filters with a visual-only control.

## Product goal

Redesign the MangaVerse Browse page to take inspiration from the *information architecture* of the supplied Comix reference: a calm, dense-but-readable advanced-filter area above the results, a clear primary search field, a visible item count, view controls, and scan-friendly results. Do **not** copy Comix branding, logo, text, assets, exact colours, layout code, or styling. Keep MangaVerse’s identity, theme system, accessibility, and card-based discovery experience.

The result must feel simpler than the current page: everyday users can search and browse immediately; power users can progressively reveal precise filters.

## Required interaction design

1. **Top search and progressive disclosure**
   - Keep one obvious search field with a clear button and submit/search-on-pause behaviour that does not issue duplicate requests.
   - Put a compact, labelled `Advanced filters` button beside or below it. It must show the number of active filters and visually indicate when filters are active.
   - On desktop, expand advanced filters in a stable panel directly below search. On mobile, use an accessible bottom sheet or drawer. It must be keyboard-operable, focus-managed, and close with Escape.
   - Retain sensible, immediately visible essentials where space allows: sort, genre, year range, format/type, and content-safety preference. Put the rest in the expanded panel.

2. **Useful filter set, backed by real data only**
   - Keep current working filters, then expose only filters the backend/catalog can actually apply. Use precise labels and defaults such as `Any`.
   - Aim for: sort (relevance, top-rated, popular, newest/oldest where supported); genres (multi-select); format/type (manga, manhwa, manhua, novel/one-shot only if data supports it); release year range; publication/release status; demographic; minimum chapters; authors; artists; rating/content suitability; and include/exclude tags only if the existing API supports them.
   - Before adding a control, trace its data source and API parameter. If unavailable, do not fake it: either omit it or implement the full, tested backend support within this same bounded change.
   - Preserve the global/saved explicit-content and doujinshi preferences and make their impact plain. Never expose content a user has opted to hide.

3. **Control quality**
   - Use the supplied Comix screenshots as interaction inspiration for the dropdowns, while retaining MangaVerse branding and theme tokens. Do not use native browser selects for these advanced controls.
   - **Single-choice dropdowns** (such as Sort): a compact trigger with label and chevron; on open, a floating, scrollable menu of radio-style options. The current option has an unambiguous selected indicator. Selecting an option closes the menu and makes one deliberate query update.
   - **Small multi-choice dropdowns** (such as Type/format, demographic, and release status): a compact trigger that shows `Any` when empty and a concise selected summary/count otherwise; on open, use clearly labelled checkbox options. Selecting a checkbox keeps the menu open so users can make several choices, then they can click outside, press Escape, or use an optional `Apply` button to commit.
   - **Genres and tags**: use a larger anchored popover (or mobile sheet) with a searchable input, a visible `Match all` / `Match any` choice only when the backend supports that meaning, and a scrollable, grouped checkbox list. Show selected items as removable chips in the trigger or directly below it. Do not expose tags that are unavailable in the catalog or violate the user’s content preference.
   - **Authors and artists**: use a compact searchable combobox/popover. It must fetch/filter only after a short debounce, show clear loading/no-results states, accept keyboard selection, and render chosen people as removable chips. Never load a huge author list into the browser at once.
   - All popovers must be layered above result cards without clipping, have a sensible maximum height with internal scrolling, close on Escape/outside click without losing already chosen values, and retain correct ARIA roles, labels, focus behaviour, and visible focus states. On narrow screens they must become a full-width sheet/drawer rather than overflowing or being cut off.
   - Avoid a request per checkbox click or keystroke. Stage changes within a popover and apply them deliberately, or debounce/cancel requests safely with an obvious active-results state.
   - Validate year and chapter input ranges with helpful inline feedback. Do not submit impossible ranges.
   - Provide `Clear all`/`Reset filters` only when it has work to do, with no confirmation for this reversible action.
   - Add a deterministic `Surprise me` action only if it can return a result respecting every active filter and content preference. Otherwise leave it out.
   - Keep active-filter chips near the result count so a user can remove one filter without reopening the panel.

4. **Results and responsive layout**
   - Show an accurate result count and an explicit loading, empty, and error state.
   - Preserve the existing high-quality card grid. Add a user-selectable compact list view only if it can be completed cleanly; otherwise retain the grid without a non-functioning toggle.
   - On a wide screen, avoid an oversized empty filter region and retain strong visual hierarchy. At 320px through desktop widths, controls must neither overflow nor become too small to tap.
   - Keep pagination/infinite loading behaviour predictable, reset it when filters change, and preserve/share the filter state in the URL only if the current routing patterns support it cleanly.

## Engineering and quality constraints

- Reuse current UI primitives and theme tokens; do not introduce copied third-party page code or assets.
- Prevent stale/out-of-order search responses from overwriting newer results; debounce text search appropriately and cancel obsolete requests when supported.
- Do not rebuild Silver/Gold catalog data or run unrelated full suites.
- Add targeted tests for filter-to-query mapping, multi-select/clear-all, range validation, content-safety preservation, loading/empty/error states, and one narrow mobile viewport check. Mock remote/network data; do not make paid provider calls.
- Run the smallest relevant frontend build/tests and backend/API tests. Manually verify desktop, tablet, and narrow mobile layouts plus keyboard navigation.
- Update `ANTIGRAVITY_PROGRESS.md` before stopping with files changed, implemented versus intentionally omitted filters, exact checks run/results, and remaining limitations.

## Acceptance criteria

The Browse page is recognisably MangaVerse, not a clone. A new visitor can search in seconds; an advanced user can combine valid filters without confusion; every displayed control works end-to-end; content preferences remain enforced; no controls overflow on mobile; and results cannot become stale or misleading.
