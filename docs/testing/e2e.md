# How to run the e2e suites

Every end-to-end suite in the repo, its command and what it needs. Deterministic unless noted
(no model is configured for tester-army `e2e`; no test may start a real GPU stream).

## tester-army `e2e` (`e2e/`, standalone install)

Install once: `cd e2e && pnpm install --ignore-workspace` (its own lockfile; inside the workspace a
plain `pnpm install` installs the root instead). Docs offline: `pnpm exec e2e guide [topic]`.
Run: `cd e2e && pnpm exec e2e run tests/<file>.e2e.ts --target <launcher|ios> --reporter list,markdown`.

| Flow | Test file | Target | Needs |
|------|-----------|--------|-------|
| 1. Receiver, phone path: REQUEST_VIEW until a view, LOAD_VIEW → start-stream/subscribe/answer on the sender's stream server, real frames; URL params override; no default view (it waits for a sender, never streams on its own); failed or unreachable start shows the error and stops the heartbeat | `tests/receiver-view.e2e.ts` | `launcher` | nothing running (all faked in the page) |
| 2. Receiver, laptop path: PEER_OFFER → PEER_ANSWER over Cast, loopback WebRTC frames, HUD iframe for `peer-canvas` (HUD_READY, HUD_MESSAGE), 20 s no-picture timeout → PEER_ERROR, bad offer, PEER_STOP | `tests/receiver-laptop.e2e.ts` | `launcher` | nothing running |
| 3. Receiver stops: heartbeat each minute; renderer idle stop (20 min without `__ogsActivityAt` activity, the renderer's own `isIdle`) via 410; no phone for 20 min; 3-hour cap; activity / a phone returning resets | `tests/receiver-stops.e2e.ts` | `launcher` | nothing running |
| TV launcher, live session | `tests/launcher.e2e.ts`, `friends.e2e.ts`, `games-know-you.e2e.ts` | `launcher` | API (`OGS_API`, 8788), launcher (`OGS_LAUNCHER`, 5180), fixture game (`FIXTURE_GAME`, 5190) |
| API over HTTP | `tests/api.e2e.ts` | `launcher` | API (8788) |
| iOS app | `tests/app.e2e.ts`, `friends-app.e2e.ts` | `ios` | Release simulator build with `EXPO_PUBLIC_FAKE_CAST=1`, `EXPO_PUBLIC_OGS_API=http://localhost:8788`; `E2E_IOS_DEVICE` / `E2E_IOS_SESSION` |

The receiver suites (flows 1–3) open `apps/web/public/receiver.html` at a routed origin
(`https://receiver.ogs.test`) with a stub of the CAF receiver SDK (`window.__cast` drives senders),
a mock stream server answered from Node whose SFU is a real `RTCPeerConnection` in a second page,
and a laptop page; every other request is aborted and must stay empty (`rx.blocked`). See
`tests/receiver-kit.ts`.

## Other suites

| Suite | Command | Needs |
|-------|---------|-------|
| TV launcher (Vitest + Playwright), incl. idle (`__ogsActivityAt` on a virtual clock) | `pnpm --filter @open-game-system/tv test:e2e` | builds/serves itself (`apps/tv/e2e/global-setup.ts`) |
| Mobile app (Detox) | `pnpm --filter @open-game-system/mobile e2e` (`e2e:build`, `e2e:test`) | `DETOX_IOS_BINARY`, `DETOX_SIM_NAME`, `E2E_OGS_API`, `FAKE_CAST` |
| Fake Chromecast (for Detox/iOS runs) | `cd e2e && node fake-chromecast.mjs [--port 5181]` | Playwright Chromium |
| Couch flow across devices | `cd e2e && node couch-flow.mjs` | API (8788), launcher (5180), fake Chromecast (5181), fixture game (5190) |
| Several households, one room (multiCouch): three couches, three recorded launchers, Night Flight; the Mumm phone in the simulator under Detox taps Invite; a Smith card moves every TV; Home/Continue on one TV; synced 2×2 video | `cd e2e && node multi-couch.mjs` (`MUMM_PHONE=scripted` without the simulator) | below |
| 4. API stream routes against a mock renderer, Realtime and TURN (start, publisher answer forwarding, subscribe/answer, heartbeat 410/502, ice-servers fallback, readiness, error contract) | `cd services/api && pnpm exec vitest run test/stream-sfu.test.ts test/stream-routes.test.ts test/stream-ready.test.ts test/stream-ready-check.test.ts` (part of `pnpm test`) | nothing (fetch stubbed) |
| 5. Post-deploy stream readiness | `pnpm --filter @open-game-system/api stream:ready <apiBase>` (below) | network, `gcloud` (optional) |
| API integration (workerd) | `pnpm --filter @open-game-system/api test:integration` | emulators started by its global setup |
| Stream server container | `cd services/api/container && pnpm test` (`tsx --test`) | nothing |

## Post-deploy stream readiness (no render)

`pnpm --filter @open-game-system/api stream:ready <apiBase> [--probe-renderer]`: the stream route
answers with TURN servers, `GET /api/v1/stream/ready` reports a renderer, Realtime and TURN
configured (booleans), and Cloud Run's control plane (`gcloud run services describe stream-gpu`)
says the renderer is Ready. Starts no stream and no instance. `--probe-renderer` also calls the
renderer's `/health` (no Chrome launch, but on a scaled-to-zero GPU service it cold-starts a billed
L4 instance). Hard limit 20 s; prints results only, never values.

## Several households, one room (`e2e/multi-couch.mjs`)

Everything local (no Cloud Run, no GPU, no SFU), on ports of its own so the shared 8788/5180/5181 stay
untouched:

```bash
SP=<scratch dir>
# API (8798): containers off, its own D1, Night Flight's start page local
cd services/api && pnpm exec wrangler d1 execute opengame-api-db --local --persist-to $SP/api --file=schema.sql
pnpm exec wrangler dev --enable-containers=false --port 8798 --persist-to $SP/api \
  --var 'CATALOGUE_START_URLS:{"night-flight":"http://localhost:8797/"}' --var AVATAR_BASE_URL:http://localhost:5280
# Night Flight (8797), verifying game tokens with that API
cd ~/src/night-flight-owls && pnpm exec wrangler dev --port 8797 --persist-to $SP/nf \
  --var OGS_JWKS_URL:http://localhost:8798/.well-known/jwks.json
# Launcher (5280)
pnpm --filter @open-game-system/tv build && (cd apps/tv && pnpm exec vite preview --port 5280 --strictPort)
# The app (Release, simulator) pointed at them; the script is the fake Chromecast on 5281
cd apps/mobile && EXTRA_PACKAGER_ARGS=--reset-cache EXPO_PUBLIC_OGS_API=http://localhost:8798 \
  EXPO_PUBLIC_OGS_TV=http://localhost:5280 EXPO_PUBLIC_FAKE_CAST=1 EXPO_PUBLIC_FAKE_CAST_URL=http://localhost:5281/load \
  xcodebuild -workspace ios/opengameapp.xcworkspace -scheme opengameapp -configuration Release \
  -sdk iphonesimulator -derivedDataPath $SP/dd -quiet
# Run (a simulator of your own)
cd e2e && DETOX_IOS_BINARY=$SP/dd/Build/Products/Release-iphonesimulator/opengameapp.app \
  DETOX_SIM_NAME="OGS Multi-couch e2e" node multi-couch.mjs
```

The script spawns `detox test e2e/multi-couch.test.ts` (apps/mobile) and talks to it over
`/step/<name>` and `/wait/<name>` on 5281; it records the three TV contexts (Playwright `recordVideo`)
and the simulator (`simctl io recordVideo`), and writes `multi-couch-2x2.mp4`, screenshots and
`results.json` to `docs/exec-plans/active/evidence/2026-10-05-multi-couch/`.
