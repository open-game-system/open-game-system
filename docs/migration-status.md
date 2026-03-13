# Migration Status

Tracking the migration from individual repos into the unified `open-game-system` monorepo.

## Completed

- [x] **app-bridge packages (6)** copied, `workspace:*` deps wired
  - `app-bridge-types`, `app-bridge-web`, `app-bridge-react`, `app-bridge-native`, `app-bridge-react-native`, `app-bridge-testing`
- [x] **stream-kit packages (5)** copied, `workspace:*` deps wired
  - `stream-kit-types`, `stream-kit-web`, `stream-kit-react`, `stream-kit-server`, `stream-kit-testing`
- [x] **notification-kit** split into 3 packages
  - `notification-kit-core`, `notification-kit-react`, `notification-kit-server`
- [x] **opengame-api** copied to `services/api`
- [x] **opengame-app** copied to `apps/mobile` (managed Expo workflow, `ios/` and `android/` gitignored)
- [x] **Examples** renamed and copied (4 total)
  - `expo-bridge-demo`, `web-game-demo`, `stream-react-demo`, `stream-server-demo`
- [x] **Root monorepo configs** in place
  - `turbo.json`, `tsconfig.json`, `pnpm-workspace.yaml`, Prettier
- [x] **Unified CLAUDE.md and README**

## TODO

- [ ] **Migrate services/api from D1 (SQLite) to Neon (Postgres)** -- enables PR preview branch deploys via Neon branching
- [ ] **Create shared types package (`@open-game-system/types`)** -- deduplicate notification types between `notification-kit-core` and `services/api`
- [ ] **Set up changesets for package publishing** -- automated versioning and npm publish
- [ ] **Unify CI/CD** -- separate GitHub Actions workflows per area (packages, mobile, api)
- [x] **Add stream preview E2E validation** -- PR-scoped Cloudflare preview deploy + cleanup workflows plus Playwright checks for `examples/stream-server-demo`
- [ ] **Wire up real APNs/FCM providers in services/api** -- currently stubs
- [ ] **Add stream control-plane endpoints to services/api** -- needed by stream-kit (`/streams/create`, `/streams/:id`, etc.)
- [ ] **Productize stream-kit SDK packages** -- working example is ahead of the SDK; stabilize APIs
- [ ] **Gate `/ice-servers` endpoint in stream-server-demo** -- currently unauthenticated
- [ ] **Test full end-to-end flow** -- mobile app -> app-bridge -> notification-kit -> api -> push delivery
- [ ] **Verify all packages build cleanly in monorepo context** -- `pnpm build` from root
- [ ] **Remove old individual repo references from CI configs** -- leftover workflows from pre-monorepo
