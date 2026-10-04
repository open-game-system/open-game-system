# Exec plan: OGS app rework, M1–M3 (overnight 2026-10-03)

Spec: `docs/product-specs/ogs-app-v3.html` (the source of truth for behaviour). Contract:
`packages/ogs-protocol` (manifest, instances + `playingView`, couch session reducer, launcher↔game
frame messages, identity claims). Branch: `design/ogs-app-hillclimb`. **No push, no deploy, no paid
services tonight.** Everything is verified locally.

## Decisions (taken overnight on the owner's "take your recommendations")

| Decision | Choice | Why |
|---|---|---|
| Scope | M1 Library + Playing + instances/identity · M2 TV tab cast + launcher · M3 games in one stream, swap, swipe back = home | Each milestone tested before the next; kids-follow (M4) and recovery (M5) next |
| Hosting a game in the stream | **The launcher frames the game's TV page** | None of the five games sends X-Frame-Options/CSP, so framing needs no game changes |
| How the TV gets the game's URL | **The game's existing `useCastViewUrl(tvUrl)`** → app sends `game.view` to the session → launcher frames it | All five games already call it; zero game changes. Today the same call recasts |
| Phone navigation | Tabs Playing · TV · Library; opens on Playing only when a game you were playing is live, else Library; today's left-edge swipe back = `home` | Spec v3 |
| Launcher look | Own language: stickers on a couch, boxes with resume points, status-first rows (Continue · Tonight · Library), box↔fullscreen cut-over | Round-03 critics: the other three are console clones; the room is ownable but must scale |
| Identity | Household + device JWT (`OGS_JWT_SECRET`, existing `lib/jwt.ts`), claims in `ogs-protocol/token.ts` | Instances need an owner; sockets need auth |
| Storage | D1 (existing) for households, devices, library, instances; the CouchSession DO keeps live state | Neon migration is separate future work |
| e2e | tester.army `e2e` with deterministic locators only (no model key on this machine); agent steps written but skipped | Owner adds a key later |

## Architecture

```
phone (Expo app) ──HTTP──▶ services/api  /households /catalogue /library /instances
      │                         │
      └──WS /couch/ws?token ──▶ CouchSession DO (idFromName(householdId)) ◀── WS ── apps/tv launcher
                                │  reduceSession() from ogs-protocol            (framed game TV page)
kid iPads (paired) ──WS ───────┘  (M4: follow by name)
```

- **Cast:** TV tab → Cast → existing `cast-sync` sends `LOAD_VIEW` with the **launcher URL**
  (`<TV_BASE>/?api=<API>&token=<launcher token>`) once per evening. In the simulator,
  `EXPO_PUBLIC_FAKE_CAST=1` replaces Google Cast with a fake device whose "receiver" is
  `scripts/fake-chromecast.mjs` (a Playwright browser that opens the launcher URL).
- **Start:** a Library tap or the remote's OK → `game.start` → session → launcher shows "Starting…",
  host phone opens the game's start page in the WebView → game calls `useCastViewUrl` →
  app sends `game.view` → launcher frames it.
- **Swipe back:** the game screen pops → app sends `home` → session suspends the instance (resume
  label) → launcher shrinks the frame into its box.

## Ownership (parallel agents, disjoint paths)

| Owner | Paths | Delivers |
|---|---|---|
| API | `services/api/**` | households + device/launcher tokens, catalogue, library, instances, `CouchSession` DO + WS, D1 schema, seam tests over real WebSockets |
| TV launcher | `apps/tv/**` (new) | Vite + React launcher: home rows, game page, framing + `game.view`, focus ring + remote moves, box↔fullscreen, Playwright/e2e web tests against a fake session |
| Mobile | `apps/mobile/**` | tabs, Playing/Library/TV, Add games, game screen + swipe back = home, `game.view` forwarding, fake cast, API + session clients, Jest tests |
| Main loop | `packages/ogs-protocol/**`, `docs/**`, `e2e/**` (new), `scripts/**` | contract changes, cross-surface e2e, fake Chromecast, integration, briefing |

Protocol changes go through the main loop: agents write requests in their final report (or message
the main loop) instead of editing `packages/ogs-protocol`.

## Local ports

API `wrangler dev` 8787 · launcher 5180 · Metro 8081 · fake Chromecast control 5181.

## Verification (definition of done per milestone)

1. Unit/seam: `pnpm --filter @open-game-system/ogs-protocol test`, `pnpm --filter @open-game-system/api test` and `test:integration`, `pnpm --filter @open-game-system/tv test`, mobile `test:ci`.
2. e2e per surface: launcher (web target), app (iOS simulator target), all deterministic.
3. Cross-surface run with recordings: simulator app + fake Chromecast launcher + local API, the swap flow with 0 recasts (`casts` stays 1), videos in `docs/exec-plans/active/evidence/`.
4. Repo gates: `pnpm typecheck`, `pnpm lint`, package tests.

## Existing tests

The app's Detox specs and some Jest tests pin today's home screen, which the spec replaces. They are
never edited silently: an update to one goes in its own commit naming the spec section that changed
the behaviour, and every such test is listed in the morning briefing.
