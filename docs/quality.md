# Quality Grades

Grade each package/domain. Update after major changes.

| Package | Grade | Tests | Notes |
|---------|-------|-------|-------|
| services/api | B | 10 pass | Full endpoint coverage, mocked D1. Push providers are stubs. |
| app-bridge-types | A | n/a | Pure types, no runtime code |
| app-bridge-web | A | 15 pass | Comprehensive: init, state, subscriptions, errors |
| app-bridge-native | B | passing | Core bridge + createStore tested |
| app-bridge-react | B | passing | Context/hooks tested |
| app-bridge-react-native | C | passing (Jest) | DTS build fails (React 19 vs 18 types mismatch) |
| app-bridge-testing | B | passing | Mock bridge tested |
| notification-kit-core | C | 4/5 pass | 1 failing test (onDeviceIdChange subscribe). Needs attention. |
| notification-kit-react | D | untested in monorepo | Needs OgsContext/bridge type alignment verified |
| notification-kit-server | B | 5 pass | Send, bulk, error handling covered |
| stream-kit-types | A | passing | Pure types + basic validation |
| stream-kit-web | B | passing | Client + RenderStream tested |
| stream-kit-react | B | passing | Hooks and components tested |
| stream-kit-server | C | passing | Experimental, private. Router tests exist. |
| stream-kit-testing | C | passing | Mock client tested, missing publishConfig |
| cast-kit | C | no tests | No test files yet. Build passes. |
| apps/web | D | no tests | Marketing site, build only. No test infrastructure. |
| apps/mobile | B | passing (Jest) | Services tested, Stryker configured. No E2E yet. |

## Grading Scale

- **A** — Well tested, clean architecture, documented
- **B** — Adequate tests, minor debt, mostly documented
- **C** — Gaps in coverage, some debt, docs may be stale
- **D** — Significant gaps, needs attention
- **F** — Untested, undocumented, high risk
