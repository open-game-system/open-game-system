# Quality Grades

Grade each package/domain. Update after major changes.

| Package | Grade | Tests | Mutation Score | Notes |
|---------|-------|-------|----------------|-------|
| services/api | A- | 58 unit + 57 integration = 115 pass | 68.79% | Full endpoint + D1 integration coverage. CORS, cross-game isolation, content-type all integration-tested. Stryker configured. |
| app-bridge-types | A | n/a | — | Pure types, no runtime code |
| app-bridge-web | A | 15 pass | — | Comprehensive: init, state, subscriptions, errors |
| app-bridge-native | B | passing | — | Core bridge + createStore tested |
| app-bridge-react | B | passing | — | Context/hooks tested |
| app-bridge-react-native | C | passing (Jest) | — | DTS build fails (React 19 vs 18 types mismatch) |
| app-bridge-testing | B | passing | — | Mock bridge tested |
| notification-kit-core | B | 5/5 pass | 66.67% | All tests passing. `_resetBridge` added for test isolation. Stryker configured. |
| notification-kit-react | B | 2/2 pass | — | Previously skipped test now passing. Bridge singleton reset fixed the issue. |
| notification-kit-server | B | 5 pass | 82.35% | Send, bulk, error handling covered. Stryker configured. |
| stream-kit-types | A | passing | — | Pure types + basic validation |
| stream-kit-web | B | passing | — | Client + RenderStream tested |
| stream-kit-react | B | passing | — | Hooks and components tested |
| stream-kit-server | C | passing | — | Experimental, private. Router tests exist. |
| stream-kit-testing | C | passing | — | Mock client tested, missing publishConfig |
| cast-kit-core | C | has tests | configured | Stryker configured. Sparse test coverage. |
| cast-kit-react | C | has tests | configured | Stryker configured. Sparse test coverage. |
| apps/web | C | 22 e2e (receiver) | — | Marketing site: build only. `public/receiver.html` (the Cast receiver) has 22 deterministic e2e tests (`e2e/tests/receiver-*.e2e.ts`: LOAD_VIEW, PEER_OFFER + HUD, stops) and 3 full-pipe tests against the real local renderer (`e2e/tests/stream-pipe.e2e.ts`: moving frames, idle 410, Chrome relaunch; the Realtime leg opt-in); see docs/testing/e2e.md. |
| apps/mobile | B | passing (Jest) + Detox | configured | Services tested, Stryker configured. Detox: 16 files in `apps/mobile/e2e` (incl. the `multi-couch.mjs` / `phones-follow.mjs` driver files), all passing on one local stack 2026-10-07 (docs/testing/e2e.md, "The whole Detox suite"). |

## Grading Scale

- **A** — Well tested, clean architecture, documented
- **B** — Adequate tests, minor debt, mostly documented
- **C** — Gaps in coverage, some debt, docs may be stale
- **D** — Significant gaps, needs attention
- **F** — Untested, undocumented, high risk

## Mutation Testing Summary (2026-03-17)

| Package | Score | Killed | Survived | Notes |
|---------|-------|--------|----------|-------|
| services/api | 68.79% | 302 | 137 | Auth improved to 79%. |
| notification-kit-core | 66.67% | 18 | 9 | Survivors are bridge safety patterns (optional chaining). |
| notification-kit-server | 82.35% | 28 | 6 | Survivors are error message strings. |

## CRAP (2026-10-04)

Target: CRAP < 8 for every function. Measure from a package dir after `pnpm test:coverage`:
`node ../../scripts/crap.mjs --src src --threshold 8` (mobile: `--src services`; the script reads
`coverage/lcov.info`, and `--coverage` can be repeated to merge runs).

| Scope | Max CRAP | Not yet under 8 |
|-------|----------|-----------------|
| packages/ogs-protocol (excl. friends) | 6 | none |
| apps/mobile/services (excl. runtime, app-state, playing-home, friends, ogs-api, identity) | 7 | none |
| apps/tv/src (excl. ui/*.tsx) | 6 | ui components untested in Node (Player, App, GamePage, Home, useFrames) |
| services/api/src (excl. friends, presence) | 44.7 | `POST /sessions/:sid/join` (friends), CouchSession DO methods (need a DurableObjectState; the workerd integration suite covers them but can't be measured) |
