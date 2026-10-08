# Game pushes go through OGS to the app or the game's PWA; game links open the app

**Date:** 2026-10-07
**Status:** Accepted (owner-approved direction 2026-10-07; **planned, not built**). Plan page: https://claude.ai/artifact/QXbL6sdxYAvY62e3kBTpTT
**Supersedes:** [JWT device tokens for push notifications](2026-03-14-device-token-jwt.md)
**Builds on:** [The OGS game contract](2026-10-04-ogs-game-contract.md), [The launcher owns joining](2026-10-06-launcher-owns-joining.md)

## Context

A player can meet a game in two places: inside the OGS app (the game's `startUrl` in a WebView), or on the
game's own domain in a browser, often added to the Home Screen as a PWA. Both can show notifications: the
app through Expo (APNs/FCM), the PWA through Web Push. The player is usually *not* in the game when a push
matters ("your clue", "this round is waiting on you").

What exists today (checked 2026-10-07):

- `POST /api/v1/notifications/send` takes an API key and a **device token**: a JWT of the OGS device id with
  no expiry and no audience (ADR 2026-03-14). The app never hands it to games (no `deviceToken` in
  `apps/mobile`), so nothing depends on it. It breaks contract rule 8: games must never see device ids.
- The app registers an Expo push token at launch and opens a game from a notification tap
  (`apps/mobile/app/_layout.tsx`, `services/notifications.ts`). `ExpoPushProvider` is real, not a stub.
  Invites push to every device of a profile (`pushTo` in `services/api/src/routes/games.ts`).
- No push from the app has been seen on the owner's iPhone. Expo credentials for APNs are unverified.
- `api_keys (key, game_id, game_name)` exists; no game holds a key. profile-kit never authenticates to OGS:
  `verifyOgsToken` reads the public JWKS.
- Universal links: the app claims `applinks:opengame.org` and `applinks:triviajam.tv`; the association
  files hand the app only `opengame.org/open*` and `triviajam.tv/games/*`. Android has an intent filter
  for `opengame.org/open` only, and triviajam.tv serves no `assetlinks.json`. `opengame.org/play/<appId>`,
  the invite and transfer link (contract §7, §8), does not open the app on either platform.
- An audit of the nine catalogue games (2026-10-07) found no push, service worker or alarm-driven
  reminders anywhere. Real moments exist in Pocket Draft (a round waiting on you), Codebreakers if it
  gains an async mode (your clue, a clue for your team), Night Flight (another couch joined), Story Nook
  (a character is ready to check) and Trivia Jam once nights can be scheduled.

## Decision

1. **Games address players, not devices.** OGS gives a game an opaque **push handle** per player per game.
   The game's server stores it on the seat and sends with one call:
   `POST /api/v1/games/:appId/notifications { to: [handle], title, body, url?, tag?, whenOpen? }`,
   authenticated by a **per-game API key**. Each recipient answers `sent`, `not_permitted` or `gone`.
2. **OGS delivers both pipes.** A handle has one or more **surfaces**: an OGS profile (Expo, every device of
   that profile) or a web-push subscription on the game's origin. OGS picks at send time: the
   **last-active surface**. A game never knows which surface it reached.
3. **The surface is attached when the player opts in**, from a tap, at the first moment push matters
   ("Ping me when it's my turn again?"), once per game:
   - in the OGS app: profile-kit `requestOgsNotifications()` → the app's own consent sheet → handle;
   - in a PWA or tab: notification-kit-web `subscribeOgsPush()` → browser permission → subscription sent to
     OGS → handle;
   - opting in on the other surface with the existing handle adds a surface to the same handle.
4. **OGS holds the VAPID keys and the subscriptions.** One P-256 key pair per `appId`, made on first use for
   catalogue games, private key encrypted in D1 under one Worker secret. The public key is served to the
   kit; the game configures nothing. Subscriptions are accepted only from the game's `startUrl` origin. The
   game serves one copy-in `sw.js` (web push can only reach a worker on its own origin).
5. **The device decides banner or in-game.** When the game is open and in front (the app's WebView for that
   `appId`, or a focused window of the PWA), the system banner is swallowed and the push goes to the page:
   profile-kit `onOgsNotification(handler)`. With no handler, or `whenOpen: "banner"`, the banner shows.
   Games also skip sending to seats that are connected to their room; that is the game's own data.
6. **Never a kid profile.** OGS refuses to deliver to a kid's profile, whatever the game sends.
7. **One routing rule for taps and links.** A notification tap and a link to a game's URL do the same thing:
   with the OGS app installed, open that exact URL in the game's WebView (with the profile bridge); otherwise
   the PWA or browser. The app routes by matching the URL's origin to a catalogue `startUrl`, not a
   hard-coded list.
8. **Games keep their own domains.** `opengame.org/play/*` must open the app first (it is the link every game
   can use). First-party game domains are added to the app's associated domains and intent filters in
   batches (a native build each), and each such game serves association files covering its whole site.
   Outside developers get the "Open in OGS" transfer link instead. `*.opengame.org` game subdomains under one
   wildcard entry may come later.
9. **The device-token endpoint goes.** `POST /api/v1/notifications/send`, `DeviceTokenPayloadSchema` and the
   device-token JWT are removed, no shim (nothing consumes them). `notification-kit-server` becomes a thin,
   Zod-parsed client of the new endpoint.
10. **First games: Pocket Draft, then Codebreakers.** Pocket Draft (already async and persisted) proves the
    app pipe; its trigger points get seam tests first, since it is lightly tested. Codebreakers gets a "Play
    over days" mode (phones only, TV optional) and proves web push and handle linking.

## Alternatives considered

- **Keep device tokens, give them to games.** Per device, no audience, never expire, readable by any game.
  Rejected: breaks rule 8 and makes every game track device churn.
- **The game sends web push itself and OGS only the app.** No anonymous subscriptions in OGS, but every game
  holds a VAPID key, two credentials, two address kinds and its own de-duplication. Rejected after review:
  the burden lands on every developer.
- **OGS addresses players by profile id only.** Clean in the app, but a PWA player has no OGS profile until
  web sign-in exists. Rejected: handles cover both, and stay opaque.
- **Server-side presence decides banner vs in-game.** OGS can't see whether the game is in front on a device.
  Rejected as the main mechanism; kept as an optional later `skipIfActive` from app presence.
- **Every game on an `opengame.org` subdomain.** Universal links with one wildcard, but games lose their
  domains. Rejected for now; offered later as an option.

## Consequences

- New API surface (planned): `/api/v1/games/:appId/notifications`, push handle and surface storage, consent
  grants, per-game VAPID keys, `GET /api/v1/games/:appId/push-key`, `POST .../push-subscriptions`.
- **The first server-to-server credential a game holds.** Keys are issued by a script in `services/api` until
  a developer portal exists, stored hashed (today `api_keys.key` is plaintext), scoped to one game.
- New kit surface: profile-kit `requestOgsNotifications`, `onOgsNotification`; new package
  `notification-kit-web` (`subscribeOgsPush`, `sw.js`). The docs site's profile-kit page fails its drift
  test until these are documented.
- The app: consent sheet, per-game toggle in Settings, foreground notification handler, catalogue-driven link
  routing. Mostly JavaScript (EAS Update); new associated domains need a native build.
- OGS stores web-push subscriptions for people it cannot identify; handles are per game, so it learns nothing
  about who they are. A game's PWA notifications stop when OGS is down.
- Open, to verify on devices: whether a push reaches the owner's iPhone at all (step zero); Safari's rule
  for pushes that show nothing while the PWA is in front (it may revoke a subscription), which decides
  whether swallowing on iOS web is safe; whether a Web Push library runs on Workers or we write it on Web
  Crypto as the game tokens are.
