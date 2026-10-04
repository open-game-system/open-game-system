# Morning briefing — OGS app rework, overnight 2026-10-03 → 04

Branch `design/ogs-app-hillclimb`, all committed, **nothing pushed, nothing deployed, $0 spent**.
Spec: `docs/product-specs/ogs-app-v3.html`. Plan: `2026-10-03-ogs-app-rework.md`.

**Watch first:** `evidence/2026-10-04/phone-and-tv.mp4` (phone and TV side by side, 31 s).

## What works (verified locally: simulator + fake Chromecast + local API)

| Spec behaviour | Proof |
|---|---|
| Tabs Playing · TV · Library; opens on Library unless your game is live | Detox `home-screen` 7/7 |
| Family step creates the household (identity token, offline draft + retry) | iOS e2e "first run" |
| TV tab → Cast: **one** LOAD_VIEW with the launcher URL; tab becomes the remote | iOS e2e (Chromecast loads +1), couch-flow |
| Remote moves the TV focus ring; select → game page; back | launcher e2e, couch-flow |
| Library tap → TV says "Getting ready… on Jonathan's phone" → **the real Rocket Crew TV page framed** once its page declares the TV view | iOS e2e (real game, not a fixture) |
| Left-edge swipe back = Home: game paused in Continue, kids back to the launcher, Back in pill | iOS e2e, Detox `game-screen`, couch-flow |
| Swap games in the same stream: **0 recasts** (session casts = 1, Chromecast loads = 1) | iOS e2e, couch-flow, protocol tests |
| Continue resumes the same instance + resume point; New from the game page | couch-flow, protocol tests |
| Kid iPads follow by name into their role | couch-flow (WebSocket iPads), protocol tests |
| Remote phone goes dark → Mom is offered the remote | couch-flow |
| Identity rules (launcher token can't edit Library; other households refused) | API e2e + 116 integration tests |

## Test counts

| Suite | Result |
|---|---|
| ogs-protocol (vitest) | 237 |
| services/api unit / integration (real WebSockets) | 155 / 116 |
| apps/tv unit / Playwright | 70 / 13 |
| apps/mobile Jest / Detox (Release build) | 286 / 26 |
| tester.army `e2e` (deterministic, no model) | launcher 4, API 3, iOS 5 — all pass |
| `e2e/couch-flow.mjs` (phone, Mom, 2 iPads, launcher in the fake Chromecast) | 9/9 |
| Repo gates | typecheck ✓, lint ✓, test ✓ except `examples/cast-receiver` (4 Playwright tests fail **on main too**; flagged as a separate task) |
| Mutation (ogs-protocol, Stryker) | 59.5% → **98.55%** (8 survivors, all equivalent; reasons in `bdf9950d`) |

## Bugs the cross-surface runs found (all fixed test-first, committed)

1. TV launcher render loop while a game waited for its TV view.
2. Phone opened a started game **twice** (its own push + the session's host follow): two rooms; swipe back revealed the duplicate.
3. The first-visit hint "Swipe to go home" swallowed the swipe it teaches.
4. TV said "Paused just now" twice (the session invented a resume point).
5. Possessive: "Our family' living room".
6. Phone tiles showed the game HUD and a smiling planet (crop only applied on the TV); Rocket Crew's TV hero had smiling stars. Both now use the manifest's HUD-free crop.

## Existing tests changed (all named, none weakened)

- `b905ee2d` biome formatting only (cast-session-device, cast-sync, cast-view, game-directory).
- `51143fc7` Detox specs updated for spec v3 App structure: `homeScreen`→`libraryScreen`, `hamburgerMenu`→`householdButton`; smoke checks the three tabs; onboarding passes the family step; `home-screen` rewritten as the Tabs spec; `continue-lifecycle` rewritten for Cast-to-play + pill (spec v3 retires the 20-URL Continue list); `game-screen` opens from Library; **`game-detail.test.ts` deleted** (the Game Directory → detail flow no longer exists).
- `3c2735e8` fixed a bug in tonight's `game-screen` rewrite (opened the game in `beforeAll`, but setup reloads RN before every test).
- `5cedb9f1` couch-flow counts Chromecast loads per run (harness bug).

## Decisions I took on "your recommendations"

Launcher frames each game's TV page (no game changes); the TV URL arrives at runtime from the game's
existing `useCastViewUrl` (`game.view`); household + device JWT identity; D1 for now; a game with no
resume point shows its tagline (not a time) on the TV and "Paused" on the phone.

## Needs you

1. **Revert stray formatting** in `services/api/container/**` (8 files a build agent reformatted and
   couldn't revert; not mine to undo without you):
   `git checkout -- services/api/container`
2. **Default family names.** If you skip typing names, the TV says "Me has the remote" and the couch
   reads Me / Big kid / Little one. Options: require the first name, or keep placeholders greyed
   (not values). I'd require the grown-up's name.
3. **Real devices** (iPad, your phone, Chromecast): needs the API + launcher deployed (Cloudflare
   preview) and a dev build with real Cast. OK to push the branch, open a PR and deploy previews?
   Then I'll have an HTTPS URL + QR ready.
4. **e2e model** (optional): `e2e login` (ChatGPT plan) to enable the agent steps; everything tonight is
   deterministic and needs no model.
5. **Add by link** only works for games already in the catalogue (`PUT library` takes catalogue ids).
   Real third-party add needs manifests stored per household — your call on scope.

6. **Two protocol edge cases** mutation testing surfaced (behaviour unchanged, your call):
   an `expired` instance the session reports as live is still pinned as live in Playing; and
   `end` ("End for tonight") marks the TV not cast immediately, even before the launcher disconnects.
   I'd keep both (live beats expiry; End should read as ended at once).

## Not done yet (next milestones)

- **M4 kid iPads in the app**: the session sends `follow` to tablets (tested), but the app only acts
  on the host follow; tablets need the game's join URL per role (games must expose it).
- **M5 recovery**: cast-lost / launcher reconnect UI states beyond the reconnecting chip.
- Real Google Cast path untested tonight (fake Chromecast only); GPU streaming untouched (no cost).

## Running locally

```
cd services/api && pnpm db:local && pnpm dev:local --port 8788
cd apps/tv && pnpm dev            # :5180
cd e2e && node fake-chromecast.mjs   # :5181   (node fixture-game/server.mjs for couch-flow)
cd e2e && pnpm exec e2e run       # launcher + API + iOS (Release build with EXPO_PUBLIC_FAKE_CAST=1)
```
