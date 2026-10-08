# Game push notifications and links

**Status:** built on `feat/game-push` (2026-10-08), not deployed; no push has reached a real device yet. Decision: [ADR 2026-10-07 game push and app links](../adrs/2026-10-07-game-push-and-app-links.md).
Acceptance: [game-push.feature](../acceptance/2026-10-07-game-push.feature), [game-links.feature](../acceptance/2026-10-07-game-links.feature).
Plan page: https://claude.ai/artifact/QXbL6sdxYAvY62e3kBTpTT

This replaces the March 2026 device-token design (`POST /api/v1/notifications/send` with a JWT device token),
which is removed. Device registration below stays: it is how OGS reaches the app, never something a game sees.

## What it is for

A game tells a player something happened while they were away: "Sam gave Moon a clue", "this round is waiting
on you", "the Parks' couch joined your room". The player may be in the OGS app or in the game's own PWA. The
game's server makes one call; OGS delivers to the right place; a tap opens the game at the right page.

Not for: streaks, "come back and play", anything to a kid, or anything during live play that the TV already
shows.

## Actors

| Actor | Role |
|---|---|
| Player | Opts in once per game, from a tap. Gets at most one push per handoff. |
| Game page | Asks for consent at the right moment; hands the push handle to its server; handles pushes that arrive while it is open. |
| Game server | Stores one handle per seat; sends when a handoff happens and the seat is not connected. |
| OGS API | Holds handles, surfaces, consent, VAPID keys; checks the API key; routes and delivers. |
| OGS app | Registers its Expo token; shows the consent sheet; swallows the banner when the game is in front; opens taps and links in the game's WebView. |
| Game's `sw.js` | Receives web pushes on the game's origin; swallows or shows. |

## Push handles and surfaces

- A **push handle** is opaque (`ph_…`), one per player per game (`appId`). It never encodes a device, profile
  id or subscription, and a handle for one game is rejected for another.
- A handle has one or more **surfaces**:
  - `ogs`: an OGS profile. Delivered by Expo to every device of that profile that registered a push token.
  - `web`: a Web Push subscription on the game's `startUrl` origin, made with the game's VAPID key.
- Each surface keeps a **last active** time: when the player last opened the game on it (the app's WebView
  for that game; the PWA sending its handle on load).
- At send time OGS picks **the last-active surface** of each handle. If that delivery reports the surface gone,
  it is removed and the next surface is tried.

## Opting in

Asked from a tap, at the first moment it matters (for example right after the player's first turn: "Ping me
when it's my turn again?"), once per game. A "no" is remembered; the game may offer it again from its own
settings.

**In the OGS app** (`useOgsProfile()` is a profile):

1. The page calls `requestOgsNotifications()` (profile-kit) from a tap.
2. The app shows its sheet: "Let <game> notify you?" with Allow / Not now. If OS notification permission for
   OGS is off, the sheet says so and links to Settings.
3. Allow: the app calls `POST /api/v1/games/:appId/push-handles { handle? }` with its profile token; OGS
   records the grant (profile, appId) and returns `{ status: "granted", handle }`. Not now:
   `{ status: "denied" }` (the app answers without calling OGS). Plain browser: `null`.
4. The app's Settings lists each game with a toggle (`GET /api/v1/me/push-grants`); turning one off revokes
   the grant (`DELETE /api/v1/me/push-grants/:appId`; the handle's `ogs` surface stops delivering). Opting in
   again turns it back on with the same handle.
5. When the game opens in the app, the app calls `POST /api/v1/me/push-active/:appId`, so its `ogs` surfaces
   become the most recent.

**In a PWA or browser tab:**

1. The page calls `subscribeOgsPush()` (notification-kit-web) from a tap. It registers `/sw.js`, fetches the
   game's VAPID public key from OGS, asks browser permission and subscribes.
2. It posts the subscription to OGS, which checks the request's origin equals the game's `startUrl` origin and
   returns `{ status: "granted", handle }`.
3. iPhone and iPad: web push works only for Home Screen apps (iOS 16.4+). In a Safari tab the call returns
   `{ status: "unsupported", reason: "add-to-home-screen" }` and the game shows "Add to Home Screen" or
   "Open in OGS".
4. On each load the kit checks the subscription still uses the current VAPID key and re-subscribes quietly if
   not (key rotation).

**Linking surfaces:** either call accepts an existing handle (`requestOgsNotifications({ handle })`). The new
surface joins that handle, so the game's seat keeps one handle and the player is never notified twice.

## Sending

`POST /api/v1/games/:appId/notifications`, `Authorization: Bearer <game API key>` (the key's game must equal
`:appId`).

```json
{
  "to": ["ph_8K2…", "ph_Q1m…"],
  "title": "Clue: RIVER · 2",
  "body": "Sam gave Moon a clue. Your guess.",
  "url": "https://codebreakers.example/room/KQTP",
  "tag": "codebreakers-KQTP",
  "whenOpen": "deliver"
}
```

| Field | Rule |
|---|---|
| `to` | 1–100 handles for this `appId` |
| `title`, `body` | Required, ≤ 60 and ≤ 180 characters |
| `url` | Optional; same origin as the game's `startUrl`; default `startUrl` |
| `tag` | Optional; a later push with the same tag replaces the earlier one on the device |
| `whenOpen` | `deliver` (default): if the game is open and in front, no banner, the page gets it. `banner`: always show the system notification |

Response `200`: `{ results: [{ to, status }] }` with `status`:

- `sent`: delivered to a surface.
- `not_permitted`: no granted surface (consent revoked, a kid profile, or a handle of another game).
- `gone`: no surface left (all reported gone, or no phone registered); the game should drop the handle.
- `failed`: every surface errored for now (for example Expo rate limiting); try again later.

Errors use the standard shape: `invalid_body` (400), `missing_fields` (400), `missing_auth` / `invalid_auth` /
`invalid_api_key` (401), `wrong_game` (403, key for another game), `unknown_game` (404).

**Game servers skip connected seats.** The game knows which seats have a live connection to the room; it does
not send to those. OGS does not need to know.

**Never a kid.** Profiles carry no age, so OGS uses the device: a kid's iPad is a `tablet` device. A consent
request from a tablet is always `denied`, and OGS delivers to a profile's `phone` devices only, never its
tablets.

## Arriving while the game is open

- **OGS app, foreground:** the app's notification handler checks the screen. If the game's WebView for that
  `appId` is showing and `whenOpen` is `deliver`, no banner; the push goes to the page over the bridge. If the
  player is elsewhere in the app, the app shows its own banner; a tap opens the game. Background or closed:
  the OS shows it.
- **PWA:** `sw.js` looks for a focused window of the game (`clients.matchAll`). If there is one and
  `whenOpen` is `deliver`, it posts the push to that window; if the page handles it, Chrome, Edge and
  Firefox show nothing. **Safari (macOS, and every browser on iOS) always shows the notification too:**
  WebKit revokes a push subscription after three pushes that show nothing ("Enforce silent push quota";
  Discourse lost iOS subscriptions this way). Checked 2026-10-08.
- **In the page:** `onOgsNotification((n) => …)` (profile-kit) fires for a swallowed push, in the app and in
  the PWA. If the page registered no handler, the banner shows instead, so nothing is lost.

## Taps and links

One rule for both: **with the OGS app installed, a game's URL opens in the app, in that game's WebView, at that
exact URL, with the profile bridge.** Without the app, the PWA or the browser opens it.

- The app matches a URL to a game by its origin against the catalogue's `startUrl`s (not a hard-coded list;
  today `apps/mobile/services/deep-links.ts` hard-codes `triviajam.tv`).
- `https://opengame.org/play/<appId>?room=<room>` (invites, the transfer link) opens the app on iOS and Android.
- A first-party game on its own domain (triviajam.tv today) is in the app's associated domains and intent
  filters, and serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` covering its
  whole site. Adding a domain is a native build; batch them.
- Typing a game's address into Safari never opens an app (universal links fire only on taps from elsewhere).
  The game's page shows "Open in OGS" (the transfer link) when it is not inside OGS.
- A game on an outside developer's domain is opened through `opengame.org/play/<appId>`.

## Keys

- **Per-game API key:** issued by a script (`pnpm --filter @open-game-system/api issue-key <appId>`), shown
  once, stored hashed, scoped to one game and to sending notifications. The game keeps it as a Worker secret
  (`OGS_API_KEY`). The first credential a game's server holds for OGS.
- **VAPID keys:** OGS makes one P-256 pair per catalogue `appId` on first use, private key encrypted in D1
  under one Worker secret; public key at `GET /api/v1/games/:appId/push-key`. Games never see or configure them.

## Device registration (the app, unchanged)

The app registers at launch: `POST /api/v1/devices/register { ogsDeviceId, platform, pushToken }` with its
Expo push token, linked to the profile through `profile_devices`. It no longer returns a device token. When
Expo answers `DeviceNotRegistered`, the device's token is forgotten.

## First games

1. **Pocket Draft** (app pipe): "Your opponent locked their bids; this round is waiting on you" (once per stalled
   round, 10 minutes after the round stalls, via its existing DO alarm), "Your opponent is ready for kickoff",
   "Your opponent joined". Seam tests on those transitions come first.
2. **Codebreakers** with a new "Play over days" mode (both pipes): "Your clue, Keyholder", "Clue: RIVER · 2"
   to the guessing team, the result to everyone. Rooms persist in DO storage, play on phones alone (TV
   optional), one reminder after 24 hours without a move, expiry at 7 days. Needs its own spec section first.
