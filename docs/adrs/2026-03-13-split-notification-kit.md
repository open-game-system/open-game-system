# Split notification-kit into 3 Packages

**Date:** 2026-03-13
**Status:** Accepted

## Context

notification-kit was a single package with 3 tsup entry points (core, /react, /server). The app-bridge family uses a one-package-per-concern pattern with 6 packages. Consistency across the monorepo matters for developer experience.

## Decision

Split notification-kit into 3 independent packages:
- `notification-kit-core` — OGS detection, device ID, shared types
- `notification-kit-react` — React hooks and provider
- `notification-kit-server` — Server-side notification client

## Consequences

- Consistent with app-bridge package structure
- Consumers only install what they need (server apps don't pull in React)
- Import paths changed: `@open-game-system/notification-kit/server` → `@open-game-system/notification-kit-server`
- Internal dependency chain: react and server both depend on core via `workspace:*`
