# AGENTS.md

## Project

- **Name:** open-game-system
- **Description:** Platform enabling web games to leverage native mobile capabilities (push notifications, cloud rendering/streaming) through the OGS companion app.
- **Tech stack:** TypeScript, pnpm workspaces, Turbo, Vitest, Jest, Hono, Cloudflare Workers, Expo/React Native, tsup
- **Package manager:** pnpm 9.15+
- **Source layout:**
  - `apps/mobile/` — Expo/React Native companion app (managed workflow)
  - `apps/web/` — opengame.org marketing website (Vite + React + Tailwind + Cloudflare Pages)
  - `packages/app-bridge-*/` — WebView-to-native two-way communication (6 packages)
  - `packages/cast-kit/` — TV casting SDK for web games (Google Cast via native bridge)
  - `packages/notification-kit-*/` — Push notification SDK (core, react, server)
  - `packages/stream-kit-*/` — Cloud rendering + WebRTC streaming (5 packages)
  - `services/api/` — Hono API on Cloudflare Workers (auth, push dispatch, future stream control)
  - `examples/` — Demo/reference apps (4 apps)

## Feedback Commands

Run in this order. All must pass before committing.

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`

## Knowledge Base

Start here. Load deeper docs **only when working on the relevant domain.**

| Topic | Location |
|---|---|
| Architecture overview | [docs/architecture.md](docs/architecture.md) |
| Monorepo structure | [docs/structure.md](docs/structure.md) |
| Migration status | [docs/migration-status.md](docs/migration-status.md) |
| Product specs | [docs/product-specs/index.md](docs/product-specs/index.md) |
| Acceptance tests (Gherkin) | [docs/acceptance/index.md](docs/acceptance/index.md) |
| Architectural decisions | [docs/adrs/index.md](docs/adrs/index.md) |
| Design docs & principles | [docs/design-docs/index.md](docs/design-docs/index.md) |
| Active execution plans | [docs/exec-plans/active/](docs/exec-plans/active/) |
| Quality grades | [docs/quality.md](docs/quality.md) |
| Lessons learned | [docs/lessons.md](docs/lessons.md) |

> **Progressive disclosure:** Do NOT load all docs upfront. Read this file,
> then load the specific doc relevant to your current task.

## Core Principles

- **Simplicity first**: Make every change as simple as possible. Minimal code impact.
- **No laziness**: Find root causes. No temporary fixes. No workarounds.
- **TDD**: Red-green-refactor, always. Write the test first, see it fail, implement, see it pass.
- **Parse at the boundary**: Validate external data at system edges. No `any`, no `as` casting.
- **Spec traceability**: Every behavior should trace to an acceptance test in `docs/acceptance/`.

## Key Conventions

- **Package scope:** `@open-game-system/<name>`
- **Internal deps:** `workspace:*` protocol — never published versions for in-monorepo consumption
- **Test runners:** Vitest for packages and services, Jest for mobile app
- **D1 queries:** Always parameterized `prepare().bind().run()`/`.first()` — never string interpolation
- **Error responses:** Always `{ error: { code, message, status } }` with matching HTTP status
- **Push providers:** Stubs until real credentials wired. APNs needs .p8 + JWT, FCM needs service account.
- **Auth:** Bearer token in `Authorization` header, validated against `api_keys` table
- **Router pattern:** Each route group is a separate Hono instance in `services/api/src/routes/`, mounted in `index.ts`

## Keeping Docs Current

**Stale docs are worse than no docs. Updating docs is part of completing any task.**

| If you... | Then update... |
|---|---|
| Change a feature's behavior | Product spec + acceptance test `.feature` file |
| Add a new feature | Product spec + new `.feature` file + `docs/acceptance/index.md` |
| Add/remove a workspace package | `docs/structure.md` + this file (Source layout) |
| Change API endpoints or error codes | `docs/architecture.md` (endpoint table + error contract) |
| Change database schema | `services/api/schema.sql` + `docs/architecture.md` |
| Make a structural decision | New ADR in `docs/adrs/` + update index |
| Change module boundaries or data flow | `docs/architecture.md` |
| Fix a platform gotcha or learn a rule | `docs/lessons.md` |
| Improve or degrade quality metrics | `docs/quality.md` |
| Change the tech stack | This file (Project section) |

## Maintaining Acceptance Tests

- New features MUST have acceptance scenarios before implementation begins
- Use `YYYY-MM-DD-feature-name.feature` naming in `docs/acceptance/`
- Update `docs/acceptance/index.md` when adding/removing feature files
- If code doesn't match the `.feature` file, the code is wrong (unless the spec changed first)

## Maintaining Architectural Decisions

- Create `docs/adrs/YYYY-MM-DD-decision-name.md` for structural decisions
- ADRs are append-only — never edit old ones, supersede with new ones
- Update `docs/adrs/index.md` with the new entry

## Lessons

Two levels:

- **`docs/lessons.md`** — persistent project knowledge. Platform gotchas, architectural mistakes, patterns that work. Versioned, survives across all runs.
- **`.swarm/lessons.md`** — tactical swarm-specific lessons. Managed by swarm skill.

After any mistake: add to `docs/lessons.md` if it helps future agents.

## Off-Limits

- Do NOT modify `apps/mobile/ios/` or `apps/mobile/android/` — generated by `expo prebuild`
- Do NOT use `--no-verify` on git hooks
- Do NOT commit `.env`, `.dev.vars`, or credential files

## Git

- **Main branch:** `main`
- **Remote:** https://github.com/open-game-system/open-game-system.git
- **CI:** GitHub Actions (separate workflows per area)

## Future Work

Documented for context, not yet implemented:

- Migrate `services/api` from D1 (SQLite) to Neon (Postgres) for PR preview branch deploys
- Create `packages/types` to deduplicate notification types across packages
- Set up changesets for package publishing
- Build stream control-plane endpoints in `services/api`
- Wire real APNs/FCM providers
