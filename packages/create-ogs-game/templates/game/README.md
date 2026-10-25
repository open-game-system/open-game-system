# __OGS_APP_NAME__

A phone-and-TV party game, and its own iOS and Android app, made with `create-ogs-game`:

| Part | Where | What |
|---|---|---|
| TV page | `src/client/tv.tsx` | The shared screen: the sky of kites, the question, the reveal, the scores. One 2D canvas. |
| Phone page | `src/client/phone.tsx` | Each player's controller: name, Start, four color buttons. "Show on TV" in the app. |
| Server | `src/worker.ts`, `src/room.*.ts` | One Cloudflare Worker; **one Durable Object per room** running an XState machine with [actor-kit](https://github.com/jonmumm/actor-kit). |
| Rules | `src/game/` | Pure functions (`rules.ts`, `room.ts`, `views.ts`), tested beside them. **Replace these with your game.** |
| The app | `app/` | Expo app on `@open-game-system/shell`: your name, icon and bundle id; AirPlay to an Apple TV (the phone renders the TV page), Chromecast, a browser TV; OGS profiles, push, links, client logs. |
| CI | `.github/workflows/ci.yml` | Typecheck, tests, a whole round over real WebSockets; a preview deploy on `main`. |

The starter game: the TV flies colored kites for a few seconds, then everyone picks the color they
think had the most. Five rounds. It is there to be replaced: Apple rejects apps that look like a
template (guideline 4.3), so ship **your** game, name, art and screenshots.

## From `pnpm create ogs-game` to playing on your TV

You need Node 20+, pnpm and a Cloudflare account (`pnpm exec wrangler login`). For the iOS part:
a Mac with Xcode, CocoaPods and [Maestro](https://maestro.mobile.dev) for the simulator walk.

1. **Make it** (done if you are reading this):
   ```bash
   pnpm create ogs-game __OGS_APP_ID__ --name "__OGS_APP_NAME__"
   cd __OGS_APP_ID__ && git init && pnpm install
   ```
2. **Test it**: `pnpm test` (rules, room machine, views, routes, token check), then
   `pnpm test:seam` (starts `wrangler dev` and plays a round with two phones and a TV over real
   WebSockets).
3. **Play it locally**: `pnpm dev`, open http://localhost:8787/host on your phone (same Wi-Fi: use
   the laptop's LAN address), tap the TV link on the phone's lobby on a laptop, join from a second
   phone with the room code.
4. **Deploy a preview**: `pnpm run deploy:preview`. It deploys the Worker as `__OGS_APP_ID__-preview`,
   sets a random `ACTOR_KIT_SECRET` the first time, writes the URL to `deploys.json` (the app reads
   it), and checks `/healthz`. Then `GAME_ORIGIN=<that URL> pnpm smoke` plays a round against it.
   (`pnpm run deploy`, never `pnpm deploy`: that is pnpm's own command.)
5. **The app in the iOS Simulator with the TV on its external display**:
   ```bash
   cd app && pnpm install
   pnpm e2e:ios
   ```
   `app/e2e/sim.sh` makes a simulator, builds a Release app (`expo prebuild` + `xcodebuild`, no
   Metro), turns on the Simulator's external display (it stands in for an Apple TV with Screen
   Mirroring), and Maestro walks name → lobby → **Show on TV** → **Apple TV / AirPlay** → Start.
   Screenshots of the phone and the TV land in `app/e2e/out/`, with each step's time in
   `timings.txt`. The external display is a Simulator menu, clicked through System Events: give
   your terminal Accessibility access (System Settings → Privacy & Security → Accessibility).
   Then `pnpm e2e:record` films the phone and the TV side by side (framed, labelled, a title card
   with the run's timings) into `recordings/<time>/`, plus one short clip per milestone.
6. **On your real TV**: `pnpm ios --device` (needs your Team ID in `app/app.config.ts`), open the
   app, Control Center → Screen Mirroring → your Apple TV, then **Show on TV** in the lobby.

## The TV tiers

| TV | How | Who renders the TV page | Status (2026-10-25) |
|---|---|---|---|
| **Apple TV / AirPlay TV** | Screen Mirroring; the app puts a second, full-screen web view on the external display | **The host phone**, alongside its own controller page | Works in the Simulator with the OGS PR #57 shell (`cast.airplay: true`, on here) |
| **Chromecast / Google TV** | The OGS Cast receiver loads the OGS TV launcher, which frames your TV page | The Chromecast itself (being built: OGS `feat/cast-local-render`) | Check before you rely on it; there is no cloud rendering |
| **Browser TV** | Any browser (a laptop on the TV, a smart TV browser) opens `ogs-tv.pages.dev` and shows a code; the picker's "Use a browser TV" pairs it | That browser | Works |

**Your TV page on an own-app TV (2026-10-25):** the shell forwards the TV page your phone page
declares (`useCastViewUrl`) to the couch session (`game.start` + `game.view`), and the launcher
frames it, so a room game's `/tv/CODE` shows with no catalogue entry. This is in OGS PR #57
(`feat/shell-starter`), awaiting review: with an older shell the TV keeps the idle card.

In every tier your TV page runs inside the OGS TV launcher (`chrome=none`: no OGS chrome in your
own app), which sends `ogs:start` with who is on the couch and `ogs:suspend` / `ogs:resume` when it
parks the game. The page goes silent when parked (`src/client/audio.ts`, `onOgsPause`).

## TV performance budget

The AirPlay TV is drawn by the **host's phone**, at 1920×1080, while the same phone runs its
controller page. A Chromecast is weaker still. Design for that:

- **One canvas**, 2D or a single WebGL context; DOM for text. No video backgrounds, no second WebGL
  renderer, no CSS `filter`/`backdrop-filter` over large areas.
- **30 fps is the floor, 60 the goal**, measured on a 3-year-old iPhone with Screen Mirroring on.
- **No per-frame allocation** in the draw loop; no layout thrash (read, then write).
- **Compile every shader in the lobby** if you use WebGL (three.js compiles on first draw: a freeze
  mid-game), and keep the light count fixed.
- **Under ~1 MB of JavaScript** for the TV page (the starter is ~340 kB minified), images as WebP,
  audio as MP3 (not AAC).
- **Nothing over the focal area**: scores and notices sit on the edges, inside a 5% overscan margin.
- **The TV is the table's clock**: animate results on the TV first; phones follow.

## Logs

- **The pages**: errors and milestones go to `POST /events` on your Worker
  (`src/client/log.ts` → `src/client-events.ts`), one JSON line each in Workers Logs:
  `pnpm exec wrangler tail __OGS_APP_ID__-preview`. Tokens are redacted.
- **The app**: with AirPlay on, the shell logs every AirPlay step and native display event to the
  OGS API under a launch id (`airplay.*`, `native.*`); see OGS `docs/agents/client-log.md`.

## Make it yours

- Rules: `src/game/rules.ts` (rounds, timing, what a round is), `room.ts` (join, start, pick,
  advance), `views.ts` (what each screen may see). Keep them pure and tested.
- New events: `src/room.schemas.ts` (Zod, parsed by actor-kit before the machine sees them).
- Timers: keep each deadline in the state (`endsAt`) and let screens send `TICK`; a Durable Object
  that restarts or sleeps loses XState timers (`RESUME` re-arms them, `TICK` wakes the room).
- Screens: `src/client/tv.tsx`, `src/client/phone.tsx`, `public/styles.css`.
- Name and ids: `src/game.config.ts`, `wrangler.jsonc`, `app/app.config.ts`.

## Ship it (TestFlight, then the App Store)

**Submit from your own Apple Developer account, as the game's owner.** Apple rejects apps built
from a template service and submitted on someone else's behalf (guideline **4.2.6**), and apps
that look like another app with a new skin (**4.3**). Your game, your name, your icon, your
screenshots, your account.

1. **Your identity**: an Apple Developer account (99 USD a year). Put your Team ID in
   `app/app.config.ts` (`appleTeamId`) and check `bundleIdentifier` (`__OGS_BUNDLE_ID__`): it is
   permanent once on the store.
2. **Your art**: replace `app/assets/icon.png`, `adaptive-icon.png` and `splash-icon.png` (the
   generated ones are placeholders and `pnpm presubmit` refuses them).
3. **Production deploy**: `pnpm run deploy` (writes `deploys.json` → production builds open it).
4. **EAS**: `pnpm add -g eas-cli && eas login`, then in `app/`: `eas init` (links an EAS project),
   `eas credentials` (let it create the distribution certificate and profile in your account).
5. **App Store Connect record**: appstoreconnect.apple.com → Apps → + → New App, bundle id
   `__OGS_BUNDLE_ID__`, your app's name (unique on the store).
6. **Build and upload to TestFlight**:
   `eas build --profile production --platform ios --auto-submit` (the profile sets `APP_ENV=production`)
   (or `pnpm build:preview:ios` then `pnpm submit:preview:ios` for a preview build).
7. **Test on TestFlight**: install on a real iPhone, play a whole game on an Apple TV and a
   Chromecast or browser TV.
8. **Store listing**: 3+ screenshots of **your** game (phone and TV in play) in
   `app/store/screenshots/` (iPhone 6.9": 1320×2868), the review note (`app/REVIEW_NOTES.md`: fill
   every `[bracket]`; it explains the native parts, guideline 4.2), the Privacy Nutrition Label.
9. **`cd app && pnpm presubmit`**: checks the placeholders are gone, the screenshots exist, the
   Team ID and production deploy are set and the review note is filled in, and prints the checklist
   below. Then submit for review.

### Pre-submit checklist

- [ ] Submitted from **your own** Apple Developer account (4.2.6)
- [ ] Your own name, icon, screenshots and game, not the starter's kites (4.3)
- [ ] A TestFlight build played end to end on a real iPhone and a TV
- [ ] `REVIEW_NOTES.md` filled in; demo video link works without signing in
- [ ] Privacy Nutrition Label: OGS profile (name, avatar, id), push token; no tracking
- [ ] `pnpm presubmit` passes

## Files

```
src/worker.ts            routes: /host, /tv/CODE, /join/CODE, /api (actor-kit), /events, /healthz
src/room.server.ts       the Durable Object (verifies OGS game tokens before a JOIN)
src/room.machine.ts      the room's XState machine (phases, timers, RESUME, TICK)
src/game/                the rules, as pure functions (start here)
src/client/              the TV and phone pages (React, bundled by esbuild into public/js)
e2e/round.seam.test.ts   a whole round over real WebSockets (local or GAME_ORIGIN)
scripts/deploy.ts        deploy + secret + deploys.json + health check
app/                     the iOS/Android app (its own README.md, REVIEW_NOTES.md, e2e/)
vendor/                  OGS packages not on npm yet (profile-kit, cast-kit)
```
