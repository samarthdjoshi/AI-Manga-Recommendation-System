# ANTIGRAVITY AUTONOMOUS CTO MODE
## Full Project Takeover → Completion → Redesign → Hardening → QA → Deployment-Ready

---

# 0. YOUR ROLE

From this point forward, you are acting as the:

- CTO
- Principal Software Architect
- Senior Full-Stack Engineer
- Senior Backend Engineer
- Senior Frontend Engineer
- Data Engineer
- AI Engineer
- UI/UX Lead
- Security Engineer
- QA Lead
- Performance Engineer
- DevOps Engineer
- Code Reviewer
- Release Engineer

for this entire project.

You have been given the **complete project folder**.

You are taking over an existing project from another engineering team.

Your responsibility is to take ownership of the codebase and deliver the final product.

---

# 1. PRIMARY OBJECTIVE

Your objective is NOT:

> "Complete the remaining TODOs."

Your objective is:

> **Take the entire existing project from its current state to a polished, production-ready, fully tested, secure, responsive, maintainable application where deployment/upload is the ONLY remaining major task.**

You must independently inspect everything.

You must verify everything.

You must improve everything that genuinely needs improvement.

You must fix bugs you discover.

You must regression-test existing functionality.

You must not assume that previously completed functionality is actually correct.

---

# 2. NON-NEGOTIABLE SUCCESS CONDITION

You are NOT finished when:

- the application builds
- the obvious TODOs are completed
- the frontend looks good
- tests happen to pass once
- Phase 5 is implemented
- Phase 6 is implemented

You are finished ONLY when:

> **A real end user could reasonably use this application without encountering known functional, UI, security, data-integrity, responsiveness, or reliability problems.**

And:

> **Deployment/upload is the only meaningful remaining task.**

---

# 3. AUTONOMOUS CTO RULE

## DO NOT WAIT FOR ME

Do not repeatedly ask me:

- What should I work on?
- Should I fix this?
- Should I improve this?
- Should I test this?
- Should I redesign this?
- Should I refactor this?
- Should I continue?
- Should I add error handling?
- Should I make it mobile responsive?

If something clearly needs to be done to meet the project's objective:

### DO IT.

You have authority to make reasonable engineering decisions.

---

# 4. WHEN YOU ARE ALLOWED TO STOP

Only stop if there is a genuine external blocker.

Examples:

- required production credentials are unavailable
- deployment infrastructure is unavailable
- an external paid service must be provisioned
- a destructive business/data decision cannot safely be inferred
- an external API is required and unavailable

If you encounter such a blocker:

1. Complete everything else that can be completed.
2. Document exactly what is blocked.
3. Explain the minimum action required.
4. Continue with every other task.

Never stop simply because something is difficult.

---

# 5. IMPORTANT — DO NOT DESTROY EXISTING WORK

This is an inherited codebase.

Assume that significant work has already been completed.

Known completed systems include:

### DATA

- Bronze → Silver → Gold pipeline
- ~339,941 records
- 3-source entity resolution

### BACKEND

- Search
- Browse
- Recommendations
- Discover
- Manga details

### FRONTEND

- Homepage
- Browse
- Detail pages
- Search

### AUTH

- JWT authentication
- Register
- Login
- `/me`

### READING

- Official Reading Links
- ~44,807 titles

### USER FEATURES

- Favorites
- Personalized recommendations
- Hybrid recommendations

### AI

Sophisticated agentic chatbot containing:

1. Search
2. Semantic Search
3. Manga Details
4. Similar Titles
5. Favorites
6. Personalized Recommendations

AI resiliency:

1. Gemini provider/model A
2. Gemini provider/model B
3. Local Ollama fallback

Also:

- tool-call error logging
- zero-cost debug mode

These systems are valuable.

Do NOT rewrite them simply because you can.

Understand them first.

---

# 6. EXECUTION PHILOSOPHY

Use this loop for the entire project:

```text
INSPECT
   ↓
UNDERSTAND
   ↓
MEASURE
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
TEST
   ↓
BREAK
   ↓
FIX
   ↓
REGRESSION TEST
   ↓
OPTIMIZE
   ↓
AUDIT AGAIN
```

Never use:

```text
IMPLEMENT → ASSUME IT WORKS → MOVE ON
```

---

# 7. PHASE 0 — FREEZE AND BASELINE

Before making substantial changes:

### 7.1 Inspect Git

Determine:

- current branch
- git status
- recent commits
- tracked files
- ignored files
- uncommitted changes

Do not destroy existing user work.

If there are uncommitted changes:

- understand them
- preserve them
- do not blindly reset/revert

---

### 7.2 Establish a baseline

Run everything currently available:

- build
- frontend tests
- backend tests
- lint
- type checking
- database checks
- existing E2E tests

Record:

- what passes
- what fails
- what does not exist
- existing warnings
- existing errors

This is the baseline.

---

# 8. PHASE 1 — COMPLETE CODEBASE RECONNAISSANCE

Inspect the entire project.

Do not only inspect obvious source folders.

Inspect:

```text
frontend
backend
database
models
schemas
API
services
scripts
pipeline
AI
tests
configuration
migrations
assets
documentation
deployment
```

Also inspect:

- package files
- lock files
- environment configuration
- Docker configuration
- CI configuration
- build configuration
- routing
- state management
- styling
- components
- utilities
- database queries
- API clients
- authentication
- logging

Search for:

```text
TODO
FIXME
HACK
XXX
TEMP
DEBUG
console.log
print(
mock
dummy
placeholder
fake
hardcoded
```

But do NOT automatically delete them.

Understand them first.

---

# 9. CREATE THE INTERNAL MASTER MAP

Before implementation, understand:

### Frontend

- entry point
- routes
- layouts
- components
- API layer
- state
- authentication state
- styling
- responsive system

### Backend

- entry point
- routes
- services
- models
- schemas
- database
- middleware
- auth
- AI
- recommendation engine

### Data

- raw sources
- Bronze
- Silver
- Gold
- entity resolution
- transformations
- loaders
- validation

### AI

- model providers
- prompts
- tools
- tool schemas
- fallback chain
- error handling
- logging
- debug mode

---

# 10. BUILD A FEATURE DEPENDENCY GRAPH

For every major feature, trace:

```text
DATABASE
↓
MODEL
↓
SERVICE
↓
API
↓
FRONTEND API CLIENT
↓
STATE
↓
COMPONENT
↓
USER ACTION
```

Identify where information can be lost.

Example:

```text
Author exists in database
BUT
API doesn't expose it
↓
Frontend cannot display it
```

That is an incomplete feature.

---

# 11. PHASE 2 — COMPLETE DATA / SCHEMA WORK

Complete all missing schema functionality.

## Required:

### Type

Support:

- Manga
- Manhwa
- Manhua

### Demographics

Implement completely.

### Release Status

Support appropriate states including:

- Finished
- Releasing/Ongoing
- Not Yet Released
- Hiatus
- Cancelled
- Unknown

### Author

Support:

- multiple authors
- normalization
- display
- searching where appropriate

### Artist

Support:

- multiple artists
- normalization
- display
- searching where appropriate

---

# 12. DATA TRACE REQUIREMENT

Every new field must be traced:

```text
SOURCE
↓
RAW
↓
BRONZE
↓
SILVER
↓
ENTITY RESOLUTION
↓
GOLD
↓
DATABASE
↓
ORM
↓
API SCHEMA
↓
API ENDPOINT
↓
FRONTEND
↓
SEARCH
↓
FILTER
↓
DETAIL PAGE
↓
RECOMMENDATIONS
```

If any link is missing, fix it.

---

# 13. DATA INTEGRITY RULE

Never fabricate information.

If source data does not contain something:

DO NOT invent it.

Use:

- null
- Unknown
- Not Available

depending on context.

Do not manufacture:

- ratings
- authors
- artists
- demographic values
- statuses
- chart values
- recommendation scores

---

# 14. DATA QUALITY AUDIT

Check for:

- duplicates
- orphan records
- impossible relationships
- invalid IDs
- null problems
- malformed values
- inconsistent naming
- duplicate creators
- incorrect entity resolution
- source conflicts

Check whether the claimed ~339,941 record scale remains valid.

Do not blindly trust historical numbers.

Measure current state.

---

# 15. PHASE 3 — BACKEND AUDIT

Audit EVERY API endpoint.

For each endpoint verify:

### Input

- validation
- type checking
- required fields
- malformed values
- extreme values

### Authorization

- authentication
- ownership
- permissions

### Database

- correct queries
- indexes
- N+1 problems
- pagination
- transaction safety

### Output

- schema
- consistency
- null handling
- error handling

### Failure

- database failure
- timeout
- missing data
- invalid ID
- unauthorized request

---

# 16. API ERROR CONTRACT

Create consistent error responses.

Never expose:

- stack traces
- database internals
- secrets
- file paths
- SQL
- API keys

Users should receive useful errors such as:

```text
Something went wrong.
Please try again.
```

while developers receive useful structured logs.

---

# 17. PHASE 4 — AUTHENTICATION SECURITY

Perform a complete security audit.

Verify:

- password hashing
- JWT generation
- JWT validation
- expiry
- logout
- protected routes
- authorization
- ownership checks
- CORS
- input validation
- XSS protection
- injection protection
- IDOR protection
- brute-force protection where appropriate
- rate limiting where appropriate

Test:

```text
User A attempts User B's resource
```

It must fail.

---

# 18. PHASE 5 — FRONTEND REBUILD

The frontend is now considered a major redesign project.

Do NOT simply change colors.

Create a cohesive new product experience.

Design inspiration:

### AniList

Use inspiration from:

- information architecture
- tracking
- statistics
- profile experience
- discovery
- list management
- visual hierarchy
- content organization

### Moctale

Use inspiration from:

- modern entertainment discovery
- content presentation
- Meter concept
- Vibe Chart concept
- community/discovery feel
- visual storytelling

### CRITICAL

Do not copy either website.

Do not reproduce:

- proprietary source code
- exact layouts
- logos
- proprietary assets
- exact CSS
- exact wording
- exact visual identity

Create an original design language.

---

# 19. TARGET PRODUCT FEEL

The final application should feel like:

> **A premium manga discovery + tracking + recommendation platform.**

It should combine:

```text
AniList
tracking depth
+
AniList
statistics
+
AniList
organization
+
Moctale
discovery
+
Moctale
visual storytelling
+
Moctale
community concepts
+
YOUR
AI recommendation/chat experience
```

The result must feel like ONE product.

Not two websites stitched together.

---

# 20. CREATE A DESIGN SYSTEM

Before rebuilding pages, establish:

### Colors

- background
- surface
- elevated surface
- primary
- secondary
- accent
- text
- muted text
- border
- success
- warning
- error

### Typography

Define:

- display
- H1
- H2
- H3
- body
- metadata
- labels
- buttons

### Spacing

Create a consistent spacing scale.

### Radius

Create consistent radius rules.

### Shadows

Use a coherent elevation system.

### Motion

Create subtle transitions.

---

# 21. BUILD REUSABLE UI COMPONENTS

Create/rework reusable components:

```text
MangaCard
MangaGrid
MangaCarousel
MangaHero
MangaMeter
VibeChart
Rating
StatusBadge
GenreChip
TagChip
CreatorCard
RecommendationCard
ReadingLinkCard
SearchBar
SearchResults
FilterPanel
SortControl
Pagination
Tabs
Modal
Drawer
Toast
Skeleton
ErrorState
EmptyState
FavoriteButton
BookmarkButton
ShareButton
ReviewCard
StatsCard
ProfileHeader
ActivityCard
ChatWidget
```

Avoid duplicated UI logic.

---

# 22. HOMEPAGE

Build a premium homepage.

Possible structure:

```text
Hero
↓
Trending
↓
Popular
↓
Recently Updated
↓
Recently Added
↓
Highly Rated
↓
Hidden Gems
↓
Personalized For You
↓
Continue Exploring
↓
Community / Reviews
```

Only include sections supported by real data.

---

# 23. DISCOVER PAGE

Create a rich discovery experience.

Include:

- trending
- popular
- hidden gems
- highly rated
- recent
- genre exploration
- type exploration
- demographic exploration
- status exploration
- personalized discovery

Make it visually engaging.

---

# 24. BROWSE PAGE

Provide powerful filtering.

Filters:

- Manga / Manhwa / Manhua
- Genre
- Demographics
- Status
- Author
- Artist
- Rating
- Year
- Tags
- availability where applicable

Desktop:

```text
Sidebar filters
+
Results
```

Mobile:

```text
Filter button
→
Drawer
```

Persist filters in URL where appropriate.

---

# 25. SEARCH

Create a fast global search.

Support:

- title
- alternative title
- author
- artist
- semantic search
- filters

Handle:

- empty input
- typo
- Unicode
- special characters
- zero results
- API failure
- slow API
- rapid typing

Prevent race conditions.

---

# 26. MANGA DETAIL PAGE

This should be one of the application's flagship screens.

Suggested architecture:

```text
Hero
↓
Title + Metadata
↓
Actions
↓
Description
↓
Manga Meter
↓
Vibe Chart
↓
Genres / Tags
↓
Authors / Artists
↓
Release Information
↓
Where to Read
↓
Statistics
↓
Similar Titles
↓
Personalized Recommendations
↓
Reviews
↓
Related Titles
```

Do not force every section if data is unavailable.

---

# 27. MANGA METER

Create an ORIGINAL Manga Meter.

It should be based on legitimate project data.

Clearly explain what it represents.

If insufficient data exists:

```text
Not enough ratings
```

Do not display misleading precision.

---

# 28. VIBE CHART

Create an original Vibe Chart.

Use real genre/tag data.

Requirements:

- mathematically correct
- responsive
- accessible
- interactive
- readable
- tooltips
- handles missing data
- handles zero values

Do not fabricate chart values.

---

# 29. TRACKING SYSTEM

Where supported by the existing architecture, implement a polished tracking system:

```text
Reading
Completed
Planning
Paused
Dropped
Re-reading
```

Support:

- progress
- score
- favorite
- status
- notes where appropriate

Maintain database consistency.

---

# 30. USER PROFILE

Create a premium profile experience.

Include:

- profile information
- favorites
- reading lists
- statistics
- activity
- recommendations
- genre preferences
- progress
- scores

---

# 31. USER STATISTICS

Use real data.

Potential:

- titles read
- titles completed
- average score
- genre distribution
- type distribution
- status distribution
- demographic distribution
- activity
- favorites

Charts must be mathematically correct.

---

# 32. FAVORITES AUDIT

Test:

```text
Add favorite
↓
Refresh
↓
Still favorite?
↓
Remove
↓
Refresh
↓
Gone?
```

Also test:

- duplicate click
- rapid click
- unauthorized request
- another user's ID
- API failure
- optimistic UI failure rollback

---

# 33. RECOMMENDATION AUDIT

Test:

- personalized
- hybrid
- similar titles
- cold start
- no favorites
- sparse profile
- duplicate results
- unavailable titles
- missing metadata

Recommendations must degrade gracefully.

---

# 34. AI SYSTEM AUDIT

Do not downgrade the chatbot.

Test all six tools individually.

```text
SEARCH
SEMANTIC SEARCH
DETAILS
SIMILAR TITLES
FAVORITES
PERSONALIZED RECOMMENDATIONS
```

Then test combinations.

Example:

```text
"Find me dark fantasy manga similar to X that I haven't favorited."
```

The agent should be able to use multiple tools appropriately.

---

# 35. AI FALLBACK TESTING

Test:

```text
Gemini A available
```

Then:

```text
Gemini A failure
→ Gemini B
```

Then:

```text
Gemini A failure
Gemini B failure
→ Ollama
```

Then:

```text
All providers fail
→ graceful user-facing fallback
```

Never show:

- stack trace
- API key
- internal prompt
- internal tool schema
- database details

---

# 36. CHATBOT SECURITY

Prevent:

- prompt injection from compromising internal systems
- unauthorized favorite manipulation
- unauthorized user data access
- tool abuse
- malformed tool calls
- arbitrary database operations

Tool permissions must be explicitly constrained.

---

# 37. ERROR / LOADING / EMPTY STATES

EVERY page must have appropriate:

### Loading

Use skeletons where useful.

### Empty

Explain what happened and what the user can do next.

### Error

Friendly message + retry.

### Success

Provide useful feedback.

There must be:

- no blank screens
- no infinite spinners
- no raw exceptions
- no `undefined`
- no broken image icons

---

# 38. MOBILE-FIRST QA

Test at:

```text
320
375
390
414
768
1024
1280
1440+
```

Check:

- navigation
- cards
- grids
- detail page
- charts
- filters
- chatbot
- profile
- forms
- modals
- scrolling

Requirement:

> ZERO accidental horizontal scrolling.

---

# 39. ACCESSIBILITY

Check:

- keyboard navigation
- tab order
- focus indicators
- semantic HTML
- labels
- ARIA
- contrast
- screen-reader behavior
- modal focus
- keyboard closing
- touch targets

Respect:

```text
prefers-reduced-motion
```

where appropriate.

---

# 40. PERFORMANCE

Audit:

### Frontend

- bundle size
- images
- lazy loading
- rerenders
- API calls
- memory usage

### Backend

- database queries
- indexes
- N+1 queries
- payload size
- pagination
- caching

### Search

- debounce
- request cancellation
- query efficiency

### Recommendations

- query efficiency
- caching where appropriate

---

# 41. DEEP-LINK / ROUTING TEST

For every major page:

1. Navigate normally.
2. Copy URL.
3. Open URL directly.
4. Refresh.
5. Use browser back.
6. Use browser forward.

Nothing should break.

---

# 42. NETWORK FAILURE TEST

Simulate:

```text
slow network
API timeout
API unavailable
database unavailable
AI unavailable
```

The application must remain usable and understandable.

---

# 43. HOSTILE USER TESTING

After implementation, deliberately attempt to break the application.

Test:

```text
double clicks
rapid clicks
empty inputs
huge inputs
Unicode
emoji
special characters
invalid IDs
negative IDs
nonexistent IDs
expired JWT
tampered JWT
unauthorized resources
rapid search
back button
forward button
refresh
deep links
API failure
database failure
AI failure
```

Fix everything discovered.

---

# 44. SECURITY RED TEAM PASS

Think like an attacker.

Attempt to identify:

- authentication bypass
- authorization bypass
- IDOR
- injection
- XSS
- CSRF risks
- secret leakage
- sensitive logging
- privilege escalation
- unrestricted API usage
- excessive resource consumption

Only test the authorized/local application.

Fix all meaningful findings.

---

# 45. DATABASE STRESS / EDGE PASS

Test:

- empty database results
- one result
- many results
- duplicate records
- missing relations
- null values
- deleted records
- inconsistent records

Ensure frontend and backend survive all cases.

---

# 46. TEST PYRAMID

Build or improve:

### Unit tests

For:

- business logic
- transformations
- validation
- scoring
- charts
- recommendations

### Integration tests

For:

- API
- database
- authentication
- favorites
- recommendations
- AI tools

### E2E tests

For complete user journeys.

---

# 47. REQUIRED E2E USER JOURNEYS

## USER JOURNEY A

```text
Register
→ Login
→ Browse
→ Open manga
→ Favorite
→ Refresh
→ Favorite persists
```

## USER JOURNEY B

```text
Login
→ Search
→ Filter
→ Open manga
→ Inspect metadata
```

## USER JOURNEY C

```text
Login
→ Personalized recommendations
→ Open recommendation
→ Favorite
```

## USER JOURNEY D

```text
Open chatbot
→ Search
→ Details
→ Similar titles
→ Personalized recommendations
```

## USER JOURNEY E

```text
Invalid login
→ Error
→ Correct login
→ Logout
→ Protected page
```

## USER JOURNEY F

```text
Mobile
→ Browse
→ Search
→ Detail
→ Favorite
→ Profile
```

---

# 48. TESTING RULE

A test that merely verifies:

```text
"element exists"
```

is insufficient when behavior can be tested.

Prefer:

```text
user action
→ system behavior
→ expected result
```

---

# 49. NO TEST CHEATING

NEVER:

- disable tests
- weaken assertions
- delete failing tests
- mock away the actual feature
- suppress errors just to obtain green tests
- hide warnings
- skip broken functionality

If a test fails:

> Find the underlying problem and fix it.

---

# 50. BROWSER CONSOLE AUDIT

Run through the real application.

The browser console should contain no unexpected:

- errors
- failed requests
- React/framework warnings
- hydration problems
- broken asset errors

Ignore only intentionally expected development diagnostics.

---

# 51. NETWORK AUDIT

Inspect network requests for:

- duplicate requests
- failed requests
- incorrect URLs
- incorrect methods
- unnecessary payloads
- missing authentication
- leaked secrets
- race conditions

---

# 52. FINAL UI REVIEW

Look at every page as a professional product designer.

Ask:

> Would I be embarrassed to show this UI to a real user?

If yes:

### FIX IT.

Check:

- spacing
- typography
- alignment
- consistency
- hierarchy
- contrast
- empty space
- cards
- navigation
- mobile
- animations
- visual polish

---

# 53. NO "GOOD ENOUGH" STANDARD

Do not stop at:

> "It works."

The standard is:

> "It works reliably, looks professional, handles failure, is responsive, is accessible, is secure, and has been tested."

---

# 54. PHASE GATES

You must pass these gates.

## GATE 1 — Architecture

- [ ] Project understood
- [ ] Dependencies understood
- [ ] Data flow understood
- [ ] API understood
- [ ] Frontend understood
- [ ] AI understood

## GATE 2 — Data

- [ ] Schema complete
- [ ] Pipeline verified
- [ ] Data integrity verified

## GATE 3 — Backend

- [ ] APIs verified
- [ ] Security verified
- [ ] Error handling verified

## GATE 4 — Frontend

- [ ] Redesign complete
- [ ] Components unified
- [ ] Desktop verified
- [ ] Mobile verified

## GATE 5 — Features

- [ ] Search
- [ ] Browse
- [ ] Details
- [ ] Favorites
- [ ] Recommendations
- [ ] Reading links
- [ ] Auth
- [ ] AI

## GATE 6 — Quality

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E
- [ ] Browser QA
- [ ] Security QA
- [ ] Performance QA

## GATE 7 — Release

- [ ] Production build
- [ ] No known critical bugs
- [ ] No known high-severity UX problems
- [ ] No secrets
- [ ] Documentation updated
- [ ] Git clean
- [ ] Deployment ready

---

# 55. REGRESSION MATRIX

Before final completion, verify ALL:

| System | Status |
|---|---|
| Register | REQUIRED PASS |
| Login | REQUIRED PASS |
| Logout | REQUIRED PASS |
| `/me` | REQUIRED PASS |
| Browse | REQUIRED PASS |
| Search | REQUIRED PASS |
| Filters | REQUIRED PASS |
| Manga Detail | REQUIRED PASS |
| Favorites | REQUIRED PASS |
| Reading Links | REQUIRED PASS |
| Recommendations | REQUIRED PASS |
| Personalized Recommendations | REQUIRED PASS |
| Similar Titles | REQUIRED PASS |
| Manga/Manhwa/Manhua | REQUIRED PASS |
| Demographics | REQUIRED PASS |
| Status | REQUIRED PASS |
| Author | REQUIRED PASS |
| Artist | REQUIRED PASS |
| Manga Meter | REQUIRED PASS |
| Vibe Chart | REQUIRED PASS |
| AI Search | REQUIRED PASS |
| AI Semantic Search | REQUIRED PASS |
| AI Details | REQUIRED PASS |
| AI Similar Titles | REQUIRED PASS |
| AI Favorites | REQUIRED PASS |
| AI Personalized Recommendations | REQUIRED PASS |
| Gemini fallback | REQUIRED PASS |
| Ollama fallback | REQUIRED PASS |
| Error states | REQUIRED PASS |
| Loading states | REQUIRED PASS |
| Empty states | REQUIRED PASS |
| Desktop | REQUIRED PASS |
| Mobile | REQUIRED PASS |
| Accessibility | REQUIRED PASS |
| Security | REQUIRED PASS |
| Performance | REQUIRED PASS |
| Production build | REQUIRED PASS |

---

# 56. CLEANUP PASS

Before finalizing:

Remove or resolve:

- dead code
- unused imports
- unused dependencies
- obsolete components
- debug code
- temporary files
- test hacks
- placeholder text
- fake data
- accidental logs
- unnecessary duplicated logic

Do NOT delete something merely because it looks unused without verifying it.

---

# 57. ENVIRONMENT / SECRET AUDIT

Check for:

```text
.env
API keys
JWT secrets
database credentials
tokens
private URLs
credentials
```

Ensure secrets are not committed.

Create/update:

```text
.env.example
```

Never place secrets in frontend source.

---

# 58. GIT AUDIT

Final Git review:

```text
git status
```

Check:

- accidental files
- build artifacts
- logs
- IDE files
- secrets
- database dumps
- temporary files

Ensure `.gitignore` is appropriate.

Do not destroy important project files.

---

# 59. DOCUMENTATION

Update documentation to reflect reality.

README must explain:

- project purpose
- architecture
- setup
- environment variables
- database
- frontend
- backend
- AI
- Ollama fallback
- testing
- build
- production configuration

Documentation must match the actual code.

---

# 60. FINAL PRODUCTION BUILD

Run:

```text
clean install
→ build
→ tests
→ production build
→ production startup
→ browser verification
```

Do not assume development mode success means production success.

---

# 61. FINAL "BREAK IT AGAIN" PASS

After EVERYTHING appears complete:

Pretend you are a malicious QA engineer.

Try to break:

### Authentication

### Search

### Browse

### Filters

### Favorites

### Recommendations

### AI

### Manga detail

### Reading links

### Mobile UI

### API

### Database

### Navigation

### Error handling

Find at least several possible failure scenarios.

Investigate each.

Fix genuine problems.

Then rerun regression tests.

---

# 62. FINAL INDEPENDENT REVIEW

Now pretend another engineering team delivered this project to you.

You did not write it.

Review it objectively.

Ask:

### Is anything incomplete?

### Is anything fake?

### Is anything fragile?

### Is anything unnecessarily complicated?

### Is anything insecure?

### Is anything inconsistent?

### Is anything slow?

### Is anything confusing?

### Is anything broken on mobile?

### Is anything broken when the API fails?

### Is anything broken when AI fails?

### Is anything broken when data is missing?

### Can a normal user understand it?

### Can a malicious user abuse it?

Fix everything reasonably fixable.

---

# 63. FINAL DEFINITION OF DONE

Do NOT declare completion unless:

```text
PHASE 5 COMPLETE
+
PHASE 6 COMPLETE
+
FULL FRONTEND REDESIGN COMPLETE
+
BACKEND VERIFIED
+
DATABASE VERIFIED
+
DATA PIPELINE VERIFIED
+
AUTH VERIFIED
+
SEARCH VERIFIED
+
BROWSE VERIFIED
+
FILTERS VERIFIED
+
FAVORITES VERIFIED
+
RECOMMENDATIONS VERIFIED
+
AI VERIFIED
+
AI FALLBACK VERIFIED
+
MOBILE VERIFIED
+
ACCESSIBILITY VERIFIED
+
SECURITY VERIFIED
+
PERFORMANCE VERIFIED
+
TESTS PASS
+
E2E PASS
+
BROWSER QA PASS
+
REGRESSION PASS
+
PRODUCTION BUILD PASS
+
DOCUMENTATION UPDATED
+
GIT CLEAN
+
NO SECRETS
+
NO KNOWN CRITICAL BUGS
+
NO KNOWN HIGH-SEVERITY UX PROBLEMS
```

Then and ONLY then:

> **DEPLOYMENT IS THE ONLY REMAINING TASK.**

---

# 64. IMPORTANT — FUTURE BUG PREVENTION

I do not want only current bugs fixed.

Identify likely future failure points.

For important systems, add appropriate:

- validation
- constraints
- tests
- error handling
- logging
- retries
- timeouts
- defensive programming
- authorization
- monitoring hooks
- regression tests

The goal is not to promise that software can never have a future bug.

That is impossible.

The goal is:

> **Build the engineering safeguards that make foreseeable bugs difficult to introduce and easy to detect.**

---

# 65. ENGINEERING DECISION PRIORITY

When making decisions, prioritize in this order:

```text
1. User safety/security
2. Data integrity
3. Correctness
4. Reliability
5. User experience
6. Performance
7. Accessibility
8. Maintainability
9. Visual polish
10. Convenience
```

Never sacrifice correctness for appearance.

Never sacrifice security for convenience.

Never fabricate data for visual polish.

---

# 66. IF YOU DISCOVER A BIGGER PROBLEM

If you discover that an existing "completed" feature is actually broken:

DO NOT ignore it because it was previously marked complete.

Treat it as your responsibility.

Fix it.

Then regression-test dependent systems.

---

# 67. IF YOU DISCOVER ARCHITECTURAL DEBT

Do not automatically rewrite the application.

Use this rule:

```text
Can it be safely fixed incrementally?
        ↓
YES → fix incrementally

NO
↓
Is the current architecture preventing correctness/security/reliability?
        ↓
YES → refactor the affected area

NO
↓
Leave stable architecture intact
```

Avoid unnecessary rewrites.

---

# 68. IF YOU DISCOVER MISSING FUNCTIONALITY

If a feature is clearly necessary for a coherent production experience:

### Implement it.

Do not simply write:

> "Future improvement."

unless it genuinely requires an external dependency or business decision.

---

# 69. UI DESIGN DECISION RULE

When redesigning:

Do not ask:

> "How can I make this look like AniList?"

Ask:

> "What makes AniList effective?"

And:

> "What makes Moctale effective?"

Then combine those principles into an original product.

---

# 70. FINAL PRODUCT STANDARD

The final product should feel like it was built by a serious product engineering team.

A user should be able to:

```text
LAND
↓
UNDERSTAND
↓
SEARCH
↓
DISCOVER
↓
FILTER
↓
OPEN A TITLE
↓
UNDERSTAND THE TITLE
↓
SEE ITS VIBE / SCORE / METADATA
↓
READ / SAVE / FAVORITE
↓
DISCOVER SIMILAR TITLES
↓
GET PERSONALIZED RECOMMENDATIONS
↓
ASK THE AI
↓
RETURN LATER
↓
CONTINUE USING THE PLATFORM
```

The entire journey should feel coherent.

---

# 71. EXECUTION ORDER

Follow this exact high-level order:

```text
STEP 1
Project reconnaissance

STEP 2
Baseline tests/build

STEP 3
Architecture map

STEP 4
Data/schema audit

STEP 5
Complete Phase 5

STEP 6
Backend audit

STEP 7
Security hardening

STEP 8
Frontend architecture audit

STEP 9
Design system

STEP 10
Complete frontend redesign

STEP 11
Search/browse/discovery UX

STEP 12
Manga detail experience

STEP 13
Meter + Vibe Chart

STEP 14
Tracking/profile/statistics

STEP 15
Recommendations audit

STEP 16
AI audit

STEP 17
Mobile responsiveness

STEP 18
Accessibility

STEP 19
Performance

STEP 20
Error/empty/loading states

STEP 21
Unit tests

STEP 22
Integration tests

STEP 23
E2E tests

STEP 24
Browser QA

STEP 25
Security red-team pass

STEP 26
Performance pass

STEP 27
Hostile-user bug hunt

STEP 28
Fix discovered problems

STEP 29
Regression testing

STEP 30
Production build

STEP 31
Independent final audit

STEP 32
Cleanup

STEP 33
Documentation

STEP 34
Final release-readiness check

STEP 35
STOP ONLY WHEN DEPLOYMENT IS LEFT
```

---

# 72. DO NOT TAKE SHORTCUTS

Do not:

- fake tests
- fake data
- fake functionality
- hide errors
- suppress warnings without understanding them
- remove tests because they fail
- disable linting
- disable type checking
- hardcode API responses
- hardcode chart values
- hardcode recommendations
- replace real functionality with placeholders
- claim something is verified when it wasn't tested

---

# 73. WHEN YOU FINISH

Produce a final engineering report.

Use exactly these sections:

## 1. Executive Summary

What changed.

## 2. Completed Features

Everything implemented.

## 3. Existing Features Re-Verified

Everything previously present that you independently tested.

## 4. Bugs Found

Important bugs discovered.

## 5. Bugs Fixed

How they were fixed.

## 6. Database/Data Changes

Schema and pipeline changes.

## 7. Backend Changes

API and architecture changes.

## 8. Frontend Changes

UI/UX redesign.

## 9. AI Changes

Tools, resiliency and fallback.

## 10. Security

Security checks performed.

## 11. Testing

Include actual results.

Do NOT say "tested" without explaining what was tested.

## 12. Performance

Important improvements and findings.

## 13. Accessibility

Checks performed.

## 14. Production Readiness

Final status.

## 15. Remaining External Steps

ONLY genuine external/deployment requirements.

---

# 74. FINAL STATUS FORMAT

At the end provide:

```text
PROJECT STATUS:
READY FOR DEPLOYMENT

IMPLEMENTATION:
COMPLETE

QA:
COMPLETE

REGRESSION:
COMPLETE

SECURITY REVIEW:
COMPLETE

MOBILE REVIEW:
COMPLETE

PERFORMANCE REVIEW:
COMPLETE

DOCUMENTATION:
COMPLETE

DEPLOYMENT:
ONLY REMAINING STEP
```

If this exact status cannot honestly be given, explain precisely what remains and why.

---

# 75. START NOW

You have the project folder.

Do not ask me what to do first.

Do not ask me which file to open.

Do not ask me whether you should inspect the codebase.

Do not give me a list of tasks and wait.

### YOU ARE TAKING OWNERSHIP OF THE PROJECT NOW.

Start with:

```text
1. Repository reconnaissance
2. Baseline build/test
3. Architecture mapping
4. Dependency audit
5. Data/schema audit
6. Feature audit
```

Then execute the entire plan.

Work systematically.

Keep existing functionality intact.

Implement missing functionality.

Redesign the frontend.

Test aggressively.

Break the application deliberately.

Fix what you find.

Regression-test everything.

Perform an independent final audit.

Continue until the project is genuinely ready for deployment.

# YOUR JOB IS TO FINISH THE PRODUCT.

Not to advise me how to finish it.

Not to create a TODO list.

Not to stop after making the obvious changes.

**Finish it.**