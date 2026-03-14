# Acceptance Tests

Gherkin scenarios defining the behavioral contract of the system.
Testable distillation of product specs in `docs/product-specs/`.

Maintained as `.feature` files, date-named and sorted chronologically.

| Date | Feature File | Covers |
|------|-------------|--------|
| 2026-03-14 | [device-registration.feature](2026-03-14-device-registration.feature) | Device registration + JWT device token issuance (5 scenarios) |
| 2026-03-14 | [send-notification.feature](2026-03-14-send-notification.feature) | Send push via device token, validation, lifecycle (14 scenarios) |
| 2026-03-14 | [cast-device-discovery.feature](2026-03-14-cast-device-discovery.feature) | Cast device detection, availability, scan requests (9 scenarios) |
| 2026-03-14 | [cast-session-lifecycle.feature](2026-03-14-cast-session-lifecycle.feature) | Start/stop casting, interruptions, device switching (10 scenarios) |
| 2026-03-14 | [cast-session-api.feature](2026-03-14-cast-session-api.feature) | API endpoints for session CRUD, auth, isolation, cleanup (17 scenarios) |
| 2026-03-14 | [cast-state-updates.feature](2026-03-14-cast-state-updates.feature) | Game state sync to TV view, error handling (9 scenarios) |
| 2026-03-14 | [cast-stream-rendering.feature](2026-03-14-cast-stream-rendering.feature) | Stream-kit container lifecycle, WebRTC, rendering quality (12 scenarios) |
| 2026-03-14 | [cast-receiver.feature](2026-03-14-cast-receiver.feature) | Minimal receiver page, WebRTC connection, display (9 scenarios) |
| 2026-03-14 | [cast-ui-components.feature](2026-03-14-cast-ui-components.feature) | CastButton, DeviceList, CastStatus, React hooks (18 scenarios) |

## Relationship to Product Specs

Product specs (prose) -> Acceptance tests (Gherkin) -> E2E tests (runnable)

When requirements change:
1. Update the product spec (the intent)
2. Update or create the `.feature` file (the contract)
3. Failing acceptance tests drive the implementation change
