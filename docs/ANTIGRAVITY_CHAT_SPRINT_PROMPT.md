# Chat Assistant Reliability and UX Sprint

Work only in `G:\AI-Manga-Recommendation-System-AG`. Preserve every existing uncommitted change. Do not read, modify, delete, build, test, or otherwise touch `D:\PROJECTS\AI-Manga-Recommendation-System`. Use only `venv312` from this G-drive workspace. Never print, commit, or put API keys in source, browser code, logs, screenshots, or documentation. Do not rebuild catalog data or run the full test suite unless this change proves it necessary.

Read `docs/ANTIGRAVITY_HANDOFF.md`, `ANTIGRAVITY_PROGRESS.md`, the CTO instructions, `docs/g-drive-only-operations.md`, and the current Git status before changing anything. This is one bounded sprint: make the existing chat assistant reliably useful and responsive. Do not begin unrelated feature work.

## Outcome

The current chat widget reports a generic failure after a user asks for a recommendation. Find and fix the real failed layer. A successful release must provide a dependable, mobile-friendly manga assistant that is grounded in the catalog and fails honestly and helpfully when its provider is unavailable.

## 1. Diagnose before changing behavior

Inspect the current request path end to end, including the chat widget, API client, `/chat` route, recommender/agent code, provider configuration handling, and server logs. Use a harmless recommendation query and the browser Network panel or equivalent request inspection to establish which category applies:

1. frontend cannot reach the API;
2. API validation, routing, CORS, or timeout failure;
3. catalog/retriever/tool failure;
4. Gemini/provider configuration, authentication, quota, model, or upstream failure;
5. an unhandled response-shape or UI rendering failure.

Do not inspect or reveal secret values. Log only safe diagnostic fields such as provider name, HTTP class, timeout class, and a request/correlation ID. Do not call the generic error screen a fix. Record the root cause and the concrete verification in `ANTIGRAVITY_PROGRESS.md`.

## 2. Fix the reliability problem

Make the request contract explicit and typed/validated at both boundaries. Preserve the existing safe, catalog-grounded tools and explicit-content preferences. Add a small server-side timeout and structured, sanitized error mapping.

Use a deterministic, testable provider chain. Do not invent a provider response:

- Try the configured primary provider only when it is actually configured and healthy.
- Preserve the existing local/categorisation/catalog path where it can answer without a remote model.
- If a documented fallback provider is configured, use it once with a bounded timeout.
- If no provider can answer, return a normal structured `assistant_unavailable` result, including a retry-safe message and useful catalog search suggestions. The UI must say that the assistant is temporarily unavailable; it must not pretend a recommendation came from an AI model.

Do not add an OpenAI dependency or require an OpenAI key in this sprint. If an optional OpenAI adapter already has an approved configuration, keep it server-only and disabled by default. Any new provider must be behind explicit environment configuration, must never be sent to the frontend, and must be covered by mocked tests.

## 3. Upgrade the chat experience without making it complicated

Keep the assistant focused on discovery and the user’s catalog. Implement or verify:

- a responsive drawer on desktop and a comfortable near-full-screen panel on small screens, with no horizontal overflow;
- keyboard accessibility: labelled controls, focus management, Escape to close, Enter to send, and sensible focus return;
- clear sending/streaming state, disabled duplicate sends, a retry-last-message action, and friendly empty/error states;
- concise suggested prompts for recommendation, mood, similar-title, and library questions;
- rich catalog results as clickable title cards with cover, title, relevance reason, and safe links rather than long plain-text dumps;
- short bounded conversation history, request cancellation on close/navigation, input length limits, and no client-side secrets;
- persistent user-controlled content preferences (for example explicit/NSFW and doujinshi), applied to every catalog result.

Avoid autonomous web browsing, arbitrary code execution, direct database write tools, or tools outside the allowlisted catalog/search functions. Keep system instructions and tool policies server-side. Do not add unrelated chatbot features merely because they are possible.

## 4. Tests and release checks

Extend targeted automated tests with fakes/mocks; do not spend credits or make real remote provider calls. Cover at least:

- normal catalog-grounded response;
- missing/unconfigured provider;
- primary-provider timeout/error and configured fallback;
- all providers unavailable, returning the explicit safe result rather than a 500 or false answer;
- malformed API response and client retry/visible error state;
- preference filtering and request validation.

Run the smallest relevant backend and frontend test/build checks. Then manually verify a desktop and narrow mobile viewport. Do not run catalog builds. Update `ANTIGRAVITY_PROGRESS.md` with the root cause, files changed, exact commands/checks run, results, and any remaining external prerequisite.

## Acceptance criteria

The original query such as “a manhwa with strong fl/fmc” returns grounded recommendations when the configured provider path is available. When it is not, the user sees a truthful, retryable, useful fallback—not “Something went wrong” with no explanation. The widget is usable with mouse, keyboard, and mobile screens; no secret is exposed; and the G-drive project remains isolated from D-drive.
