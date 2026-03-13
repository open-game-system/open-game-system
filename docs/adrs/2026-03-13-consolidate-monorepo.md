# Consolidate to pnpm Monorepo

**Date:** 2026-03-13
**Status:** Accepted

## Context

The Open Game System was split across 5 separate repos (opengame-api, opengame-app, notification-kit, stream-kit, app-bridge). This made it difficult to:
- Track how pieces connect
- Share types between packages
- Coordinate changes that span multiple repos
- Maintain consistent tooling and CI

## Decision

Consolidate all 5 repos into a single pnpm monorepo using Turbo for build orchestration. Internal dependencies use `workspace:*` protocol.

## Consequences

- All code in one place — easier to reason about cross-cutting changes
- Internal packages don't need publishing for consumption by sibling packages
- Single `pnpm install` resolves everything
- Turbo handles dependency-aware builds and caching
- Git history from individual repos is not preserved (clean slate)
- Old repos remain at `~/src/` as archives but are no longer canonical
