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
| 2026-03-14 | [cast-state-updates.feature](2026-03-14-cast-state-updates.feature) | Game state sync to TV view, error handling (9 scenarios) |
| 2026-03-14 | [cast-receiver.feature](2026-03-14-cast-receiver.feature) | Minimal receiver page, WebRTC connection, display (9 scenarios) |
| 2026-03-14 | [cast-ui-components.feature](2026-03-14-cast-ui-components.feature) | CastButton, DeviceList, CastStatus, React hooks (18 scenarios) |
| 2026-03-15 | [ogs-app-onboarding.feature](2026-03-15-ogs-app-onboarding.feature) | 3-page onboarding flow, notifications permission, skip behavior (12 scenarios) |
| 2026-03-15 | [ogs-app-home-screen.feature](2026-03-15-ogs-app-home-screen.feature) | Continue section, Game Directory, empty state, navigation (13 scenarios) |
| 2026-03-15 | [ogs-app-game-detail.feature](2026-03-15-ogs-app-game-detail.feature) | Game detail screen, features display, launch flow (6 scenarios) |
| 2026-03-15 | [ogs-app-game-screen.feature](2026-03-15-ogs-app-game-screen.feature) | Full-bleed WebView, loading, error, swipe hint, swipe back, push banner (18 scenarios) |
| 2026-03-15 | [ogs-app-continue-lifecycle.feature](2026-03-15-ogs-app-continue-lifecycle.feature) | URL tracking, entry management, swipe-to-close, push routing, persistence, cookie/storage persistence (26 scenarios) |
| 2026-03-15 | [ogs-app-settings.feature](2026-03-15-ogs-app-settings.feature) | Notification toggles, developer mode, debug overlay, custom URLs (18 scenarios) |
| 2026-03-15 | [ogs-app-lifecycle.feature](2026-03-15-ogs-app-lifecycle.feature) | Background/foreground, force quit, memory, offline, deep links (14 scenarios) |

Retired 2026-10-06: `cast-session-api.feature` (v1 `/api/v1/cast/*`) and
`cast-stream-rendering.feature` (one Cloudflare Container per cast), with the code they described
(ADR 2026-10-06-streaming-cloud-run-only). The 2026-03 `cast-session-lifecycle`,
`cast-state-updates` and `cast-to-tv-streaming` files still mention that API in places; the
current cast flow is `cast-first-app`, `cast-receiver-e2e` and `tv-switching`.

## Relationship to Product Specs

Product specs (prose) -> Acceptance tests (Gherkin) -> E2E tests (runnable)

When requirements change:
1. Update the product spec (the intent)
2. Update or create the `.feature` file (the contract)
3. Failing acceptance tests drive the implementation change
| 2026-10-03 | [cast-first-app.feature](2026-10-03-cast-first-app.feature) | Cast-first app: Playing · TV · Library, instances, launcher, games in one stream, swipe back, swap with 0 recasts, Library = your games, a game's page lists its sittings; supersedes the 2026-03-15 home screen |
| 2026-10-04 | [ogs-profiles.feature](2026-10-04-ogs-profiles.feature) | OGS profiles slice 1: make your profile (name, @id, sticker), back up and sign in by email code (app; the API also verifies Apple and Google, emulated), Profile tab, couch sessions owned by the caster, join with the TV code; friends and game tokens listed @later |
| 2026-10-04 | [ogs-friends.feature](2026-10-04-ogs-friends.feature) | OGS friends slice 2: add a friend by QR (accepts at once), code, link or @id (request → accept), requests, remove, presence (online / casting / playing / offline), Join card for a friend's cast, non-friends use the TV code |
| 2026-10-04 | [games-know-you.feature](2026-10-04-games-know-you.feature) | Slice 3: game tokens (ES256, aud = appId, 1 h) with profile id, @id, name, avatar; NameGate skips itself in OGS; TV players in ogs:start; game A's token rejected by game B; never friends/age/device ids; sitting labels per game |
| 2026-10-04 | [cast-receiver-e2e.feature](2026-10-04-cast-receiver-e2e.feature) | TV receiver: REQUEST_VIEW handshake, LOAD_VIEW on the sender's stream server, URL overrides, default view, error states; laptop PEER_OFFER with HUD, timeout, stop; heartbeat, renderer idle/lifetime 410, no-phone 20 min, 3-hour cap (e2e/tests/receiver-*.e2e.ts) |
| 2026-10-04 | [ogs-game-contract.feature](2026-10-04-ogs-game-contract.feature) | The OGS game contract, TV page side: ogs:start on load and after ogs:ready, ogs:suspend/resume (parked = silent, same frame), sitting labels, origin check, plain browser, no cast/join UI on an OGS TV (spec: docs/specification.md) |
| 2026-10-05 | [multi-couch.feature](2026-10-05-multi-couch.feature) | Several households play one game: multiCouch manifest flag, ogs:room → game.room, game.start/ogs:start room, couch claim in game tokens, invites (push + opengame.org/play link), Join with your couch on Playing, Home parks one couch, each couch keeps a Room sitting; Join a friend's cast unchanged (e2e/multi-couch.mjs) |
| 2026-10-05 | [tv-switching.feature](2026-10-05-tv-switching.feature) | Switching TVs works every time: wait for the old Cast session to end before starting the new one, ten alternating switches, "Switching to <TV>…", one switch at a time, a clear failure with Try again |
| 2026-10-05 | [observability.feature](2026-10-05-observability.feature) | One wide event per API request, couch action and container step; errors once via console.error with error.type/message; uncaught app errors (global handler, rejections, error boundary) with errorType; no names or tokens; sre-agent at autonomy 0 |
| 2026-10-05 | [cast-logging.feature](2026-10-05-cast-logging.feature) | Client wide events: POST /api/v1/client-events → one JSON line each in Workers Logs; the app's cast lifecycle with an attempt id; offline buffer, flush on background; the receiver logs without credentials; no tokens, hashed device ids |
| 2026-10-06 | [join-and-invite.feature](2026-10-06-join-and-invite.feature) | PLANNED: launcher join QR next to the TV code (opengame.org/join/<code>), web join for guests (name + picture, no install, app is the upgrade), every couch phone follows the TV, mid-game invite card in the manifest's inviteCorner (phone Invite or ogs:invite), games never draw join codes, "Play on TV with OGS" transfer link; households stay in multi-couch.feature |
