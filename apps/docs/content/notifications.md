# Notifications

Tell a player something happened while they were away: "Sam gave Moon a clue", "this round is waiting
on you". Your server makes **one call** with a **push handle**; OGS delivers it to the OGS app or to your
game's PWA, whichever the player used last, and a tap opens your game at the page you name.

> **Status:** built, not deployed yet (October 2026). The contract is [§9 of the contract](contract.md#9-notifications-and-links-planned);
> this page is the how-to. Not for streaks, "come back and play", anything to a kid, or anything the TV
> already shows.

## How it works

1. **The player opts in, from a tap**, at the first moment a push would help (for example right after
   their first turn: "Ping me when it's my turn again?"). Ask once per game.
   - In the OGS app: `requestOgsNotifications()` (profile-kit). The app shows its own sheet.
   - In your PWA or a browser tab: `subscribeOgsPush()` (notification-kit-web). The browser asks.
   - Either way you get `{ status: "granted", handle }`. Send the handle to your server and keep it on
     the player's seat.
2. **Your server sends** when something happens and that player is **not connected** to your room:
   `POST /api/v1/games/<appId>/notifications` with your game's API key.
3. **OGS delivers** to the surface the player used last (the OGS app, or your PWA), and falls through
   to the other one if the first is gone.
4. **If your game is open and in front**, your page hears it with `onOgsNotification`, and there is no
   banner, except in Safari and on iOS web: WebKit revokes a subscription after three pushes that show
   nothing, so there the banner shows as well. With no handler registered, the banner shows.

A push handle (`ph_…`) is opaque: it names no device, profile or subscription, and a handle for your game
is refused for any other. OGS never pushes to a kid's iPad.

## In the OGS app

```tsx
import { requestOgsNotifications, onOgsNotification } from "@open-game-system/profile-kit";

async function askForPings(seatId: string) {
  const answer = await requestOgsNotifications(); // from a tap
  if (answer?.status === "granted") await api.saveHandle(seatId, answer.handle);
}

onOgsNotification((n) => toast(n.title)); // arrived while the game is open: no banner was shown
```

`requestOgsNotifications()` is `null` outside the OGS app, so the same code runs in a plain browser.

## In your PWA

Web push works in Chrome, Edge and Firefox on any device, and on iPhone and iPad **only for Home Screen
apps** (iOS 16.4+). Serve OGS's service worker at the root of your origin, then subscribe from a tap:

```bash
cp node_modules/@open-game-system/notification-kit-web/dist/sw.js public/sw.js
```

```ts
import { subscribeOgsPush } from "@open-game-system/notification-kit-web";

const answer = await subscribeOgsPush({ appId: "codebreakers", handle: seat.handle }); // from a tap
if (answer.status === "granted") await api.saveHandle(seat.id, answer.handle);
if (answer.status === "unsupported" && answer.reason === "add-to-home-screen") showAddToHomeScreenOrOpenInOgs();
// other reasons: "no-push" (this browser has none), "unavailable" (OGS can't take subscriptions now)
```

- OGS holds your game's VAPID keys; you configure nothing.
- OGS only accepts a subscription from your `startUrl`'s origin.
- Pass the handle you already have (`handle`), so a player who uses both the app and the PWA keeps one
  handle and is never notified twice.
- Call it on each load once granted: it re-subscribes quietly if OGS rotated your key.

## Sending from your server

Ask OGS for your game's API key (it is shown once) and keep it as a secret, for example
`wrangler secret put OGS_API_KEY`. Token verification still needs no key.

```ts
import { createOgsNotifier } from "@open-game-system/notification-kit-server";

const notify = createOgsNotifier({ appId: "codebreakers", apiKey: env.OGS_API_KEY });

const { results } = await notify({
  to: offlineSeats.map((s) => s.handle),
  title: "Clue: RIVER · 2",
  body: "Sam gave Moon a clue. Your guess.",
  url: `https://codebreakers.example/room/${room}`, // your startUrl's origin
  tag: `codebreakers-${room}`, // a later push with this tag replaces this one
});
for (const r of results) if (r.status === "gone") forgetHandle(r.to);
```

| Field | Rule |
|---|---|
| `to` | 1–100 handles |
| `title`, `body` | ≤ 60 and ≤ 180 characters |
| `url` | Your `startUrl`'s origin; default `startUrl` |
| `tag` | Optional; replaces an earlier push with the same tag |
| `whenOpen` | `deliver` (default): no banner while your game is open, the page hears it. `banner`: always show |

Each handle answers one status:

| Status | Meaning | Do |
|---|---|---|
| `sent` | A surface took it | Nothing |
| `not_permitted` | The player turned your game off, or it isn't your handle | Stop sending until they opt in again |
| `gone` | No surface left | Drop the handle |
| `failed` | Every surface errored for now | Try again later |

Errors use the OGS error shape: `401 missing_auth / invalid_auth / invalid_api_key`, `403 wrong_game`,
`404 unknown_game`, `400 missing_fields / invalid_body`.

**Skip connected seats.** Your room knows who is connected; don't push to them. One push per handoff
("your clue", "your guess"), never one per move inside a turn.

## Taps and links

A tap opens `url`: in the OGS app, inside your game's WebView with the player's profile; in your PWA,
your page. Links to your game behave the same when your domain is in the OGS app's list (first-party
games for now); everyone else links "Play on TV with OGS" to `https://opengame.org/play/<appId>`.
Typing your address into Safari never opens an app, so show "Open in OGS" outside OGS.

## Test it

- **App side:** fake the `notifications` bridge store like the `profile` store in
  [Testing](testing.md#2-the-phone-page-in-a-fake-webview): answer the page's `REQUEST` with
  `{ answer: { id, result: { status: "granted", handle: "ph_testtesttesttest" } }, last: null }`, and
  set `last: { seq: 1, notification }` to check your `onOgsNotification` handler.
- **Server side:** point `createOgsNotifier`'s `baseUrl` at a stub that records requests, and assert who
  you sent to (and that connected seats were skipped).
- **Rules:** see [Rules](rules.md#10-notifications-only-when-it-helps).
