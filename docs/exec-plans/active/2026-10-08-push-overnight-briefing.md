# Overnight briefing: game pushes and links (2026-10-08)

Plan: [2026-10-07-game-push.md](2026-10-07-game-push.md). ADR:
[2026-10-07 game push and app links](../../adrs/2026-10-07-game-push-and-app-links.md).

**Bottom line.** Steps 1–4 and 6 are built and tested, and step 5 is drafted. Nothing is deployed, and
no push has reached a real device.

- **Built and tested:**
  - the OGS API (handles, consent, the send endpoint, per-game keys, web push)
  - profile-kit
  - the app (JavaScript only)
  - Pocket Draft's pushes
  - the two kits
  - the docs site
- **Drafted, not built:** Codebreakers "Play over days" (spec and `.feature` only, waiting for your
  approval).
- **No device has received a push yet**, because step 0 needs you.

## Where it is

| Repo | Branch | Commits | State |
|---|---|---|---|
| open-game-system | `feat/game-push` (worktree `~/src/ogs-push-links`, based on `docs/push-and-links`) | 15 | Committed and pushed; draft PR opened |
| pocket-draft | `feat/ogs-push` (local only: the repo has no remote) | 3 | Committed, not pushed (nowhere to push) |
| codebreakers | `spec/play-over-days` | 2 (docs only) | Committed on the branch; `main` untouched |

## Steps

| Step | What | Committed | Tested | Not done |
|---|---|---|---|---|
| 1 API | `push_handles`, `push_surfaces`, `push_grants`, `game_api_keys` (hashed, prefixed, scoped). `POST /games/:appId/push-handles`, `POST /games/:appId/notifications`, `GET/DELETE /me/push-grants`, `POST /me/push-active/:appId`. `issue-key` script. Routing to the last-active surface, falling through to the next. Never a tablet. The url must be on the game's origin. `/notifications/send` and device tokens removed | yes | 534 unit + 177 integration; Stryker 99.5%; CRAP ≤ 7 | Not deployed. `api_keys` (plaintext) is still in production D1 until someone drops it |
| 2 profile-kit + app | profile-kit: `requestOgsNotifications`, `onOgsNotification`. App: `notifications` bridge store, consent sheet (RN Alert), no sheet when the player already allowed the game, Settings "Game notifications" switches, foreground gate, link routing by catalogue origin plus `opengame.org/play`. app.json and opengame.org's AASA claim `/play/*` | yes | 1022 app tests, 118 profile-kit; Stryker 100% on every new module; CRAP ≤ 6 | No native build (needed for the new Android filter and for iOS to fetch the new AASA), so nothing has run on a phone |
| 3 Pocket Draft | Seam tests first (9), then direct rule tests (9). Then `PUSH_HANDLE` after the first lock-in; stall nudge 10 min after one GM locks (alarm, once per round); "opponent joined", "draft done", "opponent ready"; connected seats skipped (the DO stamps its live sockets); learn rooms never push | yes (local) | 993 tests, typecheck, build, `gm:sim` 10/10; Stryker 92–100% | No OGS key set (`OGS_API_KEY`), so pushes go nowhere yet. Not deployed |
| 4 web push | Per-game VAPID keys, encrypted under `PUSH_KEY_SECRET`; `GET /push-key`; `POST /push-subscriptions` (origin check); RFC 8291/8292 via `@block65/webcrypto-web-push`. New package notification-kit-web (`subscribeOgsPush`, `sw.js`). notification-kit-server is now `createOgsNotifier` | yes | `http_ece` decrypts what we send; the VAPID JWT verifies with Node crypto; end-to-end send to a web-only handle; `sw.js` in real Chromium (4 Playwright tests via DevTools pushes); Stryker 92–100% | RFC 8291 Appendix A vector not run: the library can't fix the salt and local key. `PUSH_KEY_SECRET` not set anywhere. No real push service called |
| 5 Codebreakers | "Play over days" spec section and `docs/play-over-days.feature` | yes, on `spec/play-over-days` | — | Implementation waits for your approval (by design) |
| 6 docs site | Notifications page, profile-kit reference (drift test green), quickstart step 13, testing (pushes), rules (rule 10), contract §9 status | yes | Docs tests 19/19 | — |

## Mutation and CRAP

| Scope | Mutation | CRAP max |
|---|---|---|
| services/api push (keys, handles, delivery, routes, settings, devices) | 99.5% (1 equivalent) | 7 |
| services/api web push (vapid-keys, web-push-sender, push-senders) | 92% (7 equivalent: unreachable Web Crypto type guards, the AES key's extractable flag) | 6 |
| ogs-protocol push.ts | 100% | — |
| profile-kit notifications.ts | 100% | 4 |
| app push services (5 modules) | 100% | 6 |
| notification-kit-web | subscribe 100%, sw-core 94% (3 equivalent) | 6 |
| notification-kit-server | 96% (1 equivalent) | 3 |
| pocket-draft push modules | 92–100% (3 equivalent) | — |

API runs use `--coverageAnalysis off`, because per-test coverage reported false survivors (lesson in `docs/lessons.md`).

## Decisions you should check

1. **"Never a kid" is "never a tablet".** Profiles carry no age, and a kid's iPad is a `tablet` device. A
   consent request from a tablet is denied, and delivery goes to a profile's phones only. A grown-up's
   own iPad gets no game pushes either.
2. **A fourth status, `failed`** (every surface errored for now, for example Expo rate limits), so games
   don't drop live handles. The spec and docs include it.
3. **Removed** `/api/v1/notifications/send`, the device-token JWT, `api_keys`, and their tests: 3 test
   files deleted and 4 changed, each with a comment saying why. This was ADR decision 9, done without a shim.
4. **The deep-link tests stayed.** The old triviajam rules are the fallback under catalogue routing.
   `getInitialGameUrl` and `addDeepLinkListener` (unused after the change) were removed along with their 6 tests.
5. **Push taps still open their url when no rule matches**, because a cold start from a tap happens
   before the catalogue loads (OGS already checked the origin).
6. **Pocket Draft's stall wake is in a private view for the alarm caller, not `public.wakeAt`.** An
   existing test pins the public context after a lock. I didn't touch that test; the stall time stays
   server-side.
7. **Pocket Draft calls OGS with a small local client** (`ogsNotifier.ts`), not notification-kit-server
   (not vendored there yet). It sends the same request shape.
8. **The consent sheet is an RN `Alert`** ("Let Codebreakers notify you?", Not now / Allow). Check how it
   looks.
9. **notification-kit-core and notification-kit-react are left as they are.** They belong to the old
   design; removing them is your call.
10. **`tag` on the OGS app goes only in the push's data.** Whether Expo can collapse on iOS is unverified,
    so "same tag replaces" is proven for web push only.

The full log: `.swarm/decisions.tsv` in the worktree (git-ignored, so it is also copied at the end of this page).

## What needs you

1. **Step 0: one push to your iPhone.** Set up EAS push credentials for iOS (APNs key for
   `org.opengame.app`), run a build that registers your phone, then do one test send (ask me first).
2. **Deploy the API with two new secrets**, `PUSH_KEY_SECRET` (any long random string), then issue keys:

   ```bash
   cd ~/src/ogs-push-links/services/api && openssl rand -base64 48 | wrangler secret put PUSH_KEY_SECRET
   ```

   ```bash
   pnpm -s --filter @open-game-system/api issue-key pocket-draft --remote | (cd ~/src/pocket-draft/packages/room && wrangler secret put OGS_API_KEY)
   ```

3. **Safari on your iPad:** add a test page to the Home Screen, subscribe, and send a push while it is
   open and focused. Check whether Safari revokes the subscription after pushes that show nothing (we
   swallow them while the page is in front). If it does, iOS web must always show a banner.
4. **A native app build** for the `opengame.org/play/` Android intent filter, and so iOS fetches the
   updated AASA (`/play/*`). `opengame.org` needs a deploy of `apps/web` for the AASA change.
5. **Android App Links:** `opengame.org/.well-known/assetlinks.json` needs the release signing SHA-256.
   I didn't make one up.
6. **triviajam.tv:** its AASA covers only `/games/*` and it has no `assetlinks.json` (trivia-jam repo, not
   touched).
7. **Codebreakers "Play over days":** approve or change the spec (`spec/play-over-days`, three open
   questions at its end).
8. **Pocket Draft has no git remote:** its branch lives only on this Mac.

## Scenario → test

`game-push.feature`:

| Scenario | Test |
|---|---|
| Opting in inside the OGS app | api `test/game-push.test.ts` "grants a handle that names no profile, device or token"; app `game-notifications.test.ts` "REQUEST: asks the player, opts in, answers by id"; profile-kit `notifications.test.ts` "asks the app with an id…" |
| Saying no inside the app | app `game-notifications.test.ts` "Not now: denied, and OGS is never called" |
| Opting in from the game's PWA | api `game-push-web.test.ts` "from the game's origin: granted…"; nkw `subscribe.test.ts` "asks permission first…" |
| A Safari tab on iOS cannot subscribe | nkw `subscribe.test.ts` "a Safari tab on iOS: unsupported, add to Home Screen"; "browserEnv… a Safari tab on iPhone" |
| Only the game's own site can subscribe for it | api `game-push-web.test.ts` "refuses another origin, or none…" |
| Plain browser without OGS | profile-kit `index.browser.test.ts` "notifications: not the OGS app, so null" |
| The second surface joins the same handle | api `game-push.test.ts` "joins the app surface to a handle…"; `game-push-web.test.ts` "joins a handle the page already holds…" |
| One call, delivered to the app | api `game-push.test.ts` "one call is delivered to the app" |
| One call, delivered to the PWA | api `game-push-web.test.ts` "the game server sends to a web-only handle…" (decrypted) |
| Both surfaces, the last active one gets it | api `push-delivery.test.ts` "the web surface when it was active last", "the app when it was active last" |
| A dead surface falls through to the next | api `push-delivery.test.ts` "falls through to the app when the web subscription is gone…" |
| Nothing left to deliver to | api `push-delivery.test.ts` "is gone when the only web subscription is gone"; `game-push.test.ts` "a device Expo says is gone…" |
| Consent turned off in the app's Settings | api `game-push.test.ts` "consent turned off means not_permitted…"; app `game-notification-settings.test.ts` |
| Never a kid | api `game-push.test.ts` "never grants on a kid's iPad", "never pushes to a tablet…"; app "a kid's iPad: denied without asking" |
| A key for another game | api `game-push.test.ts` "rejects another game's key" |
| A handle from another game | api `game-push.test.ts` "a handle of another game, or an unknown one…" |
| A url on another origin is refused | api `game-push.test.ts` "refuses a url on another origin" |
| The same tag replaces the earlier push | nkw `e2e/sw.e2e.ts` "a later push with the same tag replaces the first" (web only; app unverified) |
| Open in the app: no banner, the page hears it | app `push-foreground.test.ts` "…open and listening: no banner…"; `notifications.test.ts` "asks the foreground gate…"; profile-kit "says LISTENING on and calls the handler…" |
| Elsewhere in the app: the app's own banner | app `push-foreground.test.ts` "another game is open, or none: banner" (it is the OS banner while the app is in front, not a custom one) |
| Open in the PWA: the worker swallows it | nkw `sw-core.test.ts` "a focused window that handles it…"; `e2e/sw.e2e.ts` "a focused page that handles it…" |
| No handler means a banner | app `push-foreground.test.ts`; nkw `sw-core.test.ts` "…no handler (no answer in time)"; `e2e/sw.e2e.ts` "no page handler…" |
| whenOpen banner always shows | app `push-foreground.test.ts`; nkw `sw-core.test.ts`; `e2e/sw.e2e.ts` |
| Taps open the push's url | app `link-routing.test.ts` "…a push's url still opens"; nkw `sw-core.test.ts` "tapping the notification" (4) |
| The device-token endpoint is gone | api `game-push.test.ts` "is gone", "device registration returns no device token" |

`game-links.feature`:

| Scenario | Test |
|---|---|
| The play link opens the app on iPhone | app `app-links-config.test.ts` (AASA `/play/*`) and `link-routing.test.ts` (play target). **On a device: unverified** |
| The play link opens the app on Android | `app-links-config.test.ts` (intent filter). **Unverified; needs assetlinks.json** |
| A first-party game's own link opens in the app at that page | `link-routing.test.ts` "any page on a catalogue game's origin…" (routing only; triviajam.tv's AASA is not whole-site) |
| Any path on a first-party game's domain | same test |
| Routing comes from the catalogue | same test (codebreakers origin) |
| Without the app the link stays in the browser | **Unmapped** (OS behaviour) |
| Typing the address stays in Safari and offers the app | **Unmapped** ("Open in OGS" banner is per game, not built) |
| An outside developer's domain goes through the play link | **Unmapped** (transfer link UI is contract §8, planned) |
| The association files cover the whole site | Partly: `app-links-config.test.ts` for opengame.org `/play/*`. **triviajam.tv not done** |

## Pocket Draft Stryker

| Module | Score | Survivors |
|---|---|---|
| push.rules.ts | 95.6% (97.3% of covered) | 1 left: `seat !== null` (a handle is only ever set for a seated GM, so equivalent) |
| notifier.ts | 100% | — |
| ogsNotifier.ts | 96% (100% of covered) | — |
| liveCallers.ts | 92% | 2 equivalent: dropping "service"/"system" from the caller-type enum still excludes those sockets |
| client/pushOptIn.ts | 100% | — |

## Decision log (copy of `.swarm/decisions.tsv`)

```text
time	step	decision	why	evidence	result
22:44	1	Add 'failed' push status beside sent/not_permitted/gone	Spec had no status for a transient provider error; calling it gone would make games drop live handles	packages/ogs-protocol/src/push.ts	added; spec to update
22:44	1	Kid = tablet device kind (no kid flag exists on profiles)	API has no kid marker; kids' iPads are profile_devices kind=tablet (session.ts ClientKind). Consent from a tablet is denied; delivery only to phone devices	services/api/schema.sql profile_devices.kind; claims.kind	adopted
22:50	1	Deleted test/notifications.test.ts, test/notifications-send.test.ts, test/integration/notifications.test.ts	They test POST /api/v1/notifications/send and device-token JWTs, removed by ADR 2026-10-07 decision 9	git rm in step-1 commit	deleted
22:50	1	Changed devices.test.ts + integration/devices-notifications: registration returns no deviceToken; api_keys checks -> game_api_keys	ADR decision 9 + game-push.feature 'device-token endpoint is gone'	comments in the tests	changed
22:50	1	Repointed integration cors/content-type tests from /notifications/send to /games/codebreakers/notifications	They test CORS/body handling, used the removed route as an example	comments in the tests	changed
22:50	1	Push routes mounted before the games router	games.use('*', anyToken) would 401 a game server's API-key request	src/index.ts	adopted
22:50	1	Kept api_keys table out of schema.sql, new game_api_keys (hashed)	schema.sql only creates; prod keeps the old table, as done for cast_sessions	schema.sql comment	adopted
22:50	1	tag sent in Expo data only	Expo collapse on iOS unverified; web push will use tag natively	push-delivery.ts	adopted, verify on device
23:00	1	Stryker coverageAnalysis off for API push modules	perTest coverage misattributed D1-proxy tests (false survivors in revokeGrant etc., killed when run by hand)	/tmp/stryker-ph.log vs manual mutation	adopted
23:00	1	Integration setup hashes the test key itself	setup calling src/hashApiKey made its mutants break setup, which Stryker reports as survived	test/integration/setup.ts	fixed
23:00	1	Accepted equivalent mutant: c.req.param('appId') ?? ''	Hono types param as string|undefined; the route always has it	src/routes/push.ts	accepted
23:02	2	site.test.ts page count 8 -> 9	The count pins the page set; the Notifications page is a new page the ADR asks for, not new code passing	apps/docs/test/site.test.ts	changed
23:02	2	Wrote the Notifications docs page in step 2, not step 6	profile-kit reference links to it, and the docs link test must stay green per step	apps/docs/content/notifications.md	adopted
23:02	2	Named server API createOgsNotifier({appId, apiKey, baseUrl?}) and web API subscribeOgsPush({appId, handle?}); sw.js copied from dist	Docs needed names before step 4; chosen to mirror profile-kit's Ogs naming	notifications.md	adopted
23:07	2	Removed getInitialGameUrl/addDeepLinkListener and their 6 tests	Dead after _layout moved to services/link-routing.ts (catalogue origins + play links); extractGameUrl and its tests kept	services/deep-links.ts	deleted
23:07	2	Kept deep-links' hard-coded triviajam rules as the fallback under catalogue routing	Semantic stability: every existing deep-link test still passes; catalogue routing is additive	services/link-routing.ts	adopted
23:07	2	Push taps still open their url when nothing matches	Cold start from a tap happens before the catalogue loads; OGS already checked the origin	link-routing openLink	adopted
23:07	2	Consent sheet = RN Alert (Allow / Not now)	Smallest native-free sheet; no new screen	services/consent-sheet.ts	adopted, check look on device
23:19	3	Pocket Draft stall wake lives in an alarm-only private view, not public.wakeAt	Existing test pins the exact public context after a lock; the stall time is server-internal; the DO syncs its alarm from both	room.rules withViews, room.server #syncAlarm	adopted
23:19	3	Connected = DO stamps callers with a live socket on every event	actor-kit declares CONNECT/DISCONNECT but never sends them	room.server.ts send()	adopted
23:19	3	Pocket Draft calls OGS with a local fetch client, not notification-kit-server	The kit is rewritten in step 4 and is not vendored here yet; same request shape, swap later	packages/room/src/ogsNotifier.ts	adopted
23:32	4	Used @block65/webcrypto-web-push 2.0.0 (Workers-ready, aes128gcm + VAPID)	Step asks to prefer a Workers library; proven by http_ece round-trip decrypt and a Node-verified VAPID JWT; RFC 8291 Appendix A vector not run (the library gives no way to fix the salt and local key)	services/api/test/web-push-sender.test.ts	adopted
23:32	4	Rewrote notification-kit-server: createOgsNotifier replaces createNotificationClient; its 5 old tests replaced	The old client called the removed device-token endpoint; greenfield, no shim	packages/notification-kit-server	changed
23:32	4	Left notification-kit-core and notification-kit-react as they are	They belong to the old bridge-store design; removing them is out of this plan's scope	-	left for owner
23:32	4	subscribeOgsPush asks Notification permission before any network wait	iOS shows the prompt only from a user gesture; awaits before it can lose the tap	subscribe.ts	adopted
23:32	4	sw.js e2e runs full Chromium (channel chromium), pushes via DevTools deliverPushMessage	The Playwright headless shell has no notifications	e2e/sw.e2e.ts	adopted
23:43	3	App answers granted without the sheet when the player already allowed the game	A game asks again in every new room; asking each time would nag	apps/mobile/services/game-notifications.ts alreadyAllowed	adopted
```
