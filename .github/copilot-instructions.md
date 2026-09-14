# Copilot Instructions for This Repository

This repository is an inherited AI Manga Recommendation System. Treat it as the authoritative source of implementation state and continue the existing project rather than restarting it.

## Authoritative existing guidance

Always inspect and follow the authoritative project documents when present:

- `ANTIGRAVITY — AUTONOMOUS CTO MODE MASTER EXECUTION PROMPT.md`
- `.agents/rules/autonomous-cto.md`
- `ANTIGRAVITY_PROGRESS.md`

## Execution rules

- Preserve existing working functionality unless a root-cause bug demands a focused fix.
- Do not rewrite the application from scratch.
- Do not fabricate manga metadata, ratings, authors, artists, demographics, statuses, genres, tags, recommendations, statistics, test results, database records, or API results.
- Do not stop after the first feature. Continue through the project’s Definition of Done.
- Prefer targeted inspection and narrow tests for the subsystem being changed.
- Avoid rereading the entire repository repeatedly. Inspect only files relevant to the current task.
- Maintain and update `ANTIGRAVITY_PROGRESS.md` as persistent project memory.
- Use the repository’s current implementation as the ground truth for what is already built.

## Verification and testing

- Verify with real evidence before claiming a fix or completion.
- Use a workspace-aware Python interpreter when running repository tests.
- Prefer targeted regression tests during implementation, then run the relevant broader regression suite at phase/release gates.
- Do not weaken tests. Preserve test integrity and avoid deleting failing tests.

## AI and implementation efficiency

- Prefer small, root-cause changes over broad rewrites.
- Batch related changes when safe.
- Keep progress reports short and concrete.
- When a task succeeds, move immediately to the next highest-priority unfinished work.
- Do not repeatedly reread the entire repository. Inspect only files relevant to the current task.
- Do not regenerate explanations of architecture that are already established in the repository.
- Do not repeatedly ask for confirmation; proceed from the repository’s implementation evidence.
- Use targeted tests during development and avoid running the full suite after every trivial change.
- Run the complete regression suite at meaningful phase or release gates.
- Do not waste model tokens explaining obvious actions; prefer executing the work over describing it.
- Keep progress reports concise.
- Do not stop after one successful task; continue until the project’s Definition of Done is satisfied.

## Project operating stance

The goal is to finish the application to a production-ready state where deployment/upload is the only remaining task.
