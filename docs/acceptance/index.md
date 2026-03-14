# Acceptance Tests

Gherkin scenarios defining the behavioral contract of the system.
Testable distillation of product specs in `docs/product-specs/`.

Maintained as `.feature` files, date-named and sorted chronologically.

| Date | Feature File | Covers |
|------|-------------|--------|
| 2026-03-14 | [device-registration.feature](2026-03-14-device-registration.feature) | Device registration + JWT device token issuance (5 scenarios) |
| 2026-03-14 | [send-notification.feature](2026-03-14-send-notification.feature) | Send push via device token, validation, lifecycle (14 scenarios) |

## Relationship to Product Specs

Product specs (prose) -> Acceptance tests (Gherkin) -> E2E tests (runnable)

When requirements change:
1. Update the product spec (the intent)
2. Update or create the `.feature` file (the contract)
3. Failing acceptance tests drive the implementation change
