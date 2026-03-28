# Quality Grades

Grade each package/domain. Update after major changes.

| Package | Grade | Tests | Mutation Score | Notes |
|---------|-------|-------|----------------|-------|
| services/api | A- | 58 unit + 57 integration = 115 pass | 68.79% | Full endpoint + D1 integration coverage. CORS, cross-game isolation, scheduled handler, content-type all integration-tested. Stryker configured. |
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
| apps/web | D | no tests | — | Marketing site, build only. No test infrastructure. |
| apps/mobile | B | passing (Jest) | configured | Services tested, Stryker configured. No E2E yet. |

## Grading Scale

- **A** — Well tested, clean architecture, documented
- **B** — Adequate tests, minor debt, mostly documented
- **C** — Gaps in coverage, some debt, docs may be stale
- **D** — Significant gaps, needs attention
- **F** — Untested, undocumented, high risk

## Mutation Testing Summary (2026-03-17)

| Package | Score | Killed | Survived | Notes |
|---------|-------|--------|----------|-------|
| services/api | 68.79% | 302 | 137 | scheduled.ts low (30%) — covered by integration tests. Auth improved to 79%. |
| notification-kit-core | 66.67% | 18 | 9 | Survivors are bridge safety patterns (optional chaining). |
| notification-kit-server | 82.35% | 28 | 6 | Survivors are error message strings. |
