# open-game-system — Architecture

## Overview

The Open Game System (OGS) is a platform that lets web games use native mobile capabilities -- push notifications, streaming/casting, and native UI -- without leaving the browser paradigm. Game developers build standard web games, then integrate lightweight SDKs that communicate through the OGS host app via a WebView bridge.

## System Map

```
 GAME DEVELOPER                        OGS PLATFORM                         EXTERNAL
 ─────────────                         ────────────                         ────────

 ┌─────────────────┐
 │  Game Web App    │
 │  (React/HTML)    │
 │                  │
 │  ┌─────────────┐ │    ┌──────────────────────────────────────────┐
 │  │ app-bridge   │◄────┤  apps/mobile (Expo/React Native)         │
 │  │ -web/-react  │────►│                                          │
 │  └─────────────┘ │    │  WebView hosts game                      │
 │                  │    │  app-bridge-native injects JS bridge      │
 │  ┌─────────────┐ │    │  app-bridge-react-native provides hooks  │
 │  │notification  │ │    │                                          │
 │  │-kit-react    │ │    │  expo-notifications ──────────────────────┼──► Device OS
 │  └──────┬──────┘ │    └──────────────────────────────────────────┘
 │         │        │
 └─────────┼────────┘
           │
 ┌─────────┴──────────┐
 │  Game Server        │
 │                     │
 │  ┌────────────────┐ │    ┌────────────────────────────┐
 │  │notification-kit│─────►│  services/api               │
 │  │-server         │ │    │  (Cloudflare Worker + D1)   │
 │  └────────────────┘ │    │                             │
 │                     │    │  POST /notifications/send ──┼──► APNs (iOS)
 │  ┌────────────────┐ │    │                             │──► FCM  (Android)
 │  │stream-kit      │ │    │                             │
 │  │-web            │─────►│  /stream/* ─────────────────┼──► Cloud Run stream-gpu
 │  └────────────────┘ │    └────────────────────────────┘      (headless Chrome,
 │                     │                                         WebRTC → Realtime SFU)
 └─────────────────────┘
```

## Module Boundaries

| Module | Directory | Responsibility | Depends On |
|--------|-----------|---------------|------------|
| API | `services/api/` | Auth, device registration, push dispatch, profiles + sign-in, catalogue, instances, couch sessions + DO | Hono, D1, Durable Objects, ogs-protocol |
| Mobile App | `apps/mobile/` | WebView host, push tokens, casting, deep links | app-bridge-react-native, Expo |
| App Bridge Types | `packages/app-bridge-types/` | Core type definitions for bridge protocol | (none) |
| App Bridge Web | `packages/app-bridge-web/` | Web-side bridge (runs in WebView) | app-bridge-types |
| App Bridge Native | `packages/app-bridge-native/` | Native-side bridge (runs in RN) | app-bridge-types, immer |
| App Bridge React | `packages/app-bridge-react/` | React context/hooks for web bridge | app-bridge-types |
| App Bridge React Native | `packages/app-bridge-react-native/` | RN components (BridgedWebView) | app-bridge-native, app-bridge-types |
| App Bridge Testing | `packages/app-bridge-testing/` | Mock bridge for tests | app-bridge-types |
| Notification Kit Core | `packages/notification-kit-core/` | OGS detection, device ID from bridge | app-bridge-web |
| Notification Kit React | `packages/notification-kit-react/` | React hooks for notification state | notification-kit-core, app-bridge-react |
| Notification Kit Server | `packages/notification-kit-server/` | Server client for sending notifications | notification-kit-core |
| Stream Kit Types | `packages/stream-kit-types/` | Streaming type definitions | (none) |
| Stream Kit Web | `packages/stream-kit-web/` | Browser streaming client + WebRTC | stream-kit-types, PeerJS |
| Stream Kit React | `packages/stream-kit-react/` | React hooks/components for streaming | stream-kit-web, stream-kit-types |
| Stream Kit Server | `packages/stream-kit-server/` | Server-side rendering abstractions | stream-kit-types, Puppeteer |
| Stream Kit Testing | `packages/stream-kit-testing/` | Mock stream client for tests | stream-kit-types |
| Cast Kit Core | `packages/cast-kit-core/` | Cast store types, Zod schemas, app-bridge helpers | app-bridge-web |
| Cast Kit React | `packages/cast-kit-react/` | Headless React hooks for cast state/dispatch | cast-kit-core, app-bridge-react |

## Package Dependency Graph

```
app-bridge-types  (leaf -- no OGS deps)
  ├── app-bridge-web
  │     └── app-bridge-react
  ├── app-bridge-native
  │     └── app-bridge-react-native
  └── app-bridge-testing

notification-kit-core  (depends on app-bridge-web)
  ├── notification-kit-react  (also depends on app-bridge-react)
  └── notification-kit-server

stream-kit-types  (leaf -- no OGS deps)
  ├── stream-kit-web
  │     ├── stream-kit-react
  │     └── stream-kit-testing
  └── stream-kit-server

cast-kit-core  (depends on app-bridge-web)
  └── cast-kit-react  (also depends on app-bridge-react)

services/api  (standalone -- no workspace deps, uses Hono)
apps/mobile   (depends on app-bridge-native, -react-native, -types, -testing)
```

Build order (Turbo manages automatically):

```
Layer 0: app-bridge-types, stream-kit-types
Layer 1: app-bridge-web, app-bridge-native, app-bridge-testing
Layer 2: app-bridge-react, app-bridge-react-native, notification-kit-core,
         stream-kit-web, stream-kit-testing
Layer 3: notification-kit-react, notification-kit-server,
         stream-kit-react, stream-kit-server
```

## Auth Model

Bearer token authentication against `api_keys` table in D1:

```
Authorization: Bearer <api-key>
      │
      ▼
Auth middleware (services/api/src/middleware/auth.ts)
      │
      ├── SELECT * FROM api_keys WHERE key = ?
      ├── 401 if missing/invalid
      └── Sets gameId + gameName on Hono context → route handlers
```

### Profile tokens (OGS profiles, slice 1)

Spec: `docs/product-specs/ogs-profiles.html`. One profile per device for now. The app and the TV
launcher use profile JWTs instead of API keys: HS256 signed with `OGS_JWT_SECRET`, claims =
`ogs-protocol` `ClaimsSchema` (`sub` profile id, `did`, `kind` phone|tablet|launcher, `sid` for a
launcher only, `exp`). Phone/tablet tokens last 365 days; a launcher token (12 h) is for one couch
session and its `sub` is the host. `middleware/profile-auth.ts`: missing header → 401
`missing_auth`, non-Bearer → 401 `invalid_auth`, bad signature/expired/not claims → 401
`invalid_token`, deleted profile → 404 `profile_not_found`, a launcher token on a phone/tablet
route → 403 `profile_token_required`.

`Profile = { id, handle, name, sticker }`, `Me = { profile, logins: [{ provider, email }] }`.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | `/api/v1/handles?name=` or `?handle=` | none | → `{ handle, available, suggestion }` (pre-fill "jonathan.m"; next free "jonathan.m2") |
| POST | `/api/v1/profiles` | none | `{ name, handle?, sticker, device: { deviceId, kind: phone\|tablet, name } }` → 201 `{ profile, token }`; 409 `handle_taken` |
| GET / PATCH | `/api/v1/me` | phone/tablet | → `Me` / `{ name?, handle?, sticker? }` → `Me`; 409 `handle_taken` |
| GET / PUT | `/api/v1/me/library` | GET any (launcher = host's), PUT phone/tablet | `{ appIds }` (whole catalogue until changed) |
| GET / POST | `/api/v1/me/instances` | any (launcher = host's) | `Instance[]` newest first (same-ms tie: latest write) / `InstanceReport & { source: bridge\|visit }` → `Instance` |
| POST | `/api/v1/sessions` | phone/tablet | `{ tvName }` → 201 `{ sessionId, code, tvName, host, token }` (launcher token) |
| GET | `/api/v1/sessions/:sid` | its launcher, host or a member | → `{ sessionId, code, tvName, host }`; 403 `not_a_member`, 404 `session_not_found` |
| POST | `/api/v1/sessions/join` | phone/tablet | `{ code }` (TV code; case, spaces, dashes ignored) → session view; 404 `session_not_found` |
| POST | `/api/v1/auth/apple`, `/auth/google` | optional phone/tablet | `{ idToken, nonce?, device? }`: with a token links the login (back up) → `Me`; without signs in (`device` required) → `Me & { token }`. 401 `invalid_id_token`, 409 `login_in_use`, 404 `login_not_found` |
| POST | `/api/v1/auth/email/start` | none | `{ email }` → 202 `{ sent: true }` (6-digit code, 10 min, 5 tries, sent with Cloudflare Email Service); 503 `email_unavailable` (no `SEND_EMAIL` binding), 502 `email_failed` (the binding refused the send) |
| POST | `/api/v1/auth/email/verify` | optional phone/tablet | `{ email, code, device? }` → like `/auth/apple`; 401 `invalid_code` |
| POST | `/api/v1/sessions/:sid/join` | phone/tablet | Join a friend's cast (Join card) → session view; host's friends only (or already host/member): 403 `not_a_friend`, 404 `session_not_found` (unknown or older than 12 h) |
| POST | `/api/v1/friends/invites` | phone/tablet | → 201 `FriendInvite { code: "KITE-42", link, qr, expiresAt }` (10 min, single use; link/qr = `<INVITE_BASE_URL>/<token>`, default `https://opengame.org/add`) |
| POST | `/api/v1/friends/invites/redeem` | phone/tablet | `{ code }` or `{ token }` → QR token: 200 `{ status: "friends", friend }`; code/link: 201 `{ status: "requested", request }` (200 friends if they had asked you or you are friends). 404 `invite_not_found`, 410 `invite_used` / `invite_expired`, 409 `cannot_friend_self` |
| POST | `/api/v1/friends/requests` | phone/tablet | `{ handle }` (`@` optional, any case) → 201 requested / 200 friends (they had asked you); 404 `handle_not_found`, 409 `cannot_friend_self` / `already_friends` |
| GET | `/api/v1/friends/requests` | phone/tablet | → `{ incoming, outgoing }` (`FriendRequest { id, from, to, via: code\|link\|handle, createdAt }`), newest first |
| POST | `/api/v1/friends/requests/:id/accept` · `/decline` | phone/tablet | accept (recipient) → 200 friends; decline (recipient, or sender withdraws) → 204; 404 `request_not_found` |
| GET | `/api/v1/friends` | phone/tablet | → `Friend[]` = `{ id, handle, name, sticker, presence, since }`; presence `casting{sessionId,tvName,game}` · `playing{sessionId,tvName,game}` · `online` (seen < 5 min) · `offline{lastSeenAt}`; sorted by presence then name |
| DELETE | `/api/v1/friends/:profileId` | phone/tablet | → 204 (mutual); 404 `friend_not_found` |
| GET | `/api/v1/friends/casting` | phone/tablet | → `CastingFriend[] { sessionId, tvName, host, game, joined }`: friends hosting a session whose TV is connected, newest first |
| GET | `/api/v1/friends/rooms` | phone/tablet | → `FriendRoom[] { appId, game, room, couches: [{ sessionId, label, host }], joined }`: rooms of `multiCouch` games a friend's live TV is in (Join with your couch), newest first; couches first to arrive first (spec §7) |
| GET | `/api/v1/catalogue` | none | → `Manifest[]` (the five deployed games, `services/api/src/catalogue.ts`; local dev/e2e may point start URLs at local servers with `CATALOGUE_START_URLS` = JSON `{ appId: url }`) |
| POST | `/api/v1/games/:appId/token` | phone/tablet | Game token for the app's WebView → `{ token, profile: { id, handle, name, avatar }, expiresAt }`. Optional `{ sid }`: the couch this phone is on, so the token carries `couch: { sid, label }`. 404 `game_not_found` / `session_not_found`, 403 `profile_token_required` (launcher) / `not_a_member`, 400 `invalid_body`, 503 `game_tokens_unavailable` |
| POST | `/api/v1/games/:appId/invites` | phone/tablet | Invite friends to this game's room: `{ room, to: [profileId] }` → 201 `{ link, invited: [{ profileId, pushed }] }`; a push to each friend's devices, link `<PLAY_BASE_URL>/play/<appId>?room=` (default opengame.org). 403 `not_a_friend`, 409 `not_multi_couch`, 404 `game_not_found`, 400 `invalid_body` (spec §7) |
| POST | `/api/v1/sessions/:sid/game-token` | its launcher, host or a member | `{ appId }` → `{ token, players, expiresAt }` for the framed TV page (`sid`, players = host + joined, `couch: { sid, label: host's name }`); 403 `not_a_member`, 404 `session_not_found` / `game_not_found`, 503 `game_tokens_unavailable` |
| GET | `/.well-known/jwks.json` | none | OGS's public game-token key `{ keys: [{ kty: "EC", crv: "P-256", x, y, kid, alg: "ES256", use: "sig" }] }` (cache 5 min) |
| GET (WS) | `/api/v1/couch/ws?token=&session=` | token in query | launcher: its own session; phone/tablet: host or member of `session`. 400 `missing_session`, 403 `not_a_member`, 404 `session_not_found` |
| GET | `/api/v1/stream/ready` | none | Post-deploy readiness, booleans only, nothing started: `{ ready, renderer: { url }, realtime, turn }`; 200 ready / 503 not (needs the renderer, `STREAM_SERVER_URL` (Cloud Run), plus Realtime and TURN secrets). `pnpm --filter @open-game-system/api stream:ready <apiBase>` reads it |
| POST | `/api/v1/stream/start-stream` · `/subscribe` · PUT `/subscribe/:id/answer` · POST `/heartbeat` · GET `/ice-servers` | none (the TV) | The receiver's stream flow (`routes/stream.ts`). Errors carry the contract plus `traceId` (and `details`, the stream server's words): 400 `invalid_body`, 403 `forbidden` (debug-state), 500 `stream_not_configured` / `stream_start_failed` / `publisher_prepare_failed` / `publisher_answer_failed` / `subscribe_failed` / `subscribe_answer_failed`; heartbeat answers `{ ok }` (502 when the server is down, 410 `{ expired }` when it ended the stream) |
| GET | `/api/v1/stream/health` · `/debug-state` (x-debug-token when `DEBUG_STATE_TOKEN` is set) · `/publisher/state` · POST `/publisher/prepare` · `/publisher/answer` | none | Passthroughs to the stream server's bare path (`STREAM_SERVER_URL`), its status and body unchanged; `/health` cold-starts a scaled-to-zero GPU instance. Every stream route that needs the renderer answers 500 `stream_not_configured` without `STREAM_SERVER_URL` |
| POST | `/api/v1/client-events` | the app: phone/tablet/launcher token (signature only, no DB); the cast receiver: none | Client wide events (`routes/client-events.ts`): `{ context: { app: mobile\|receiver, build?, version?, platform?, profileId?, sessionId?, deviceHash? }, events: [{ name, at, level: debug\|info\|warn\|error, attemptId?, durationMs?, error?, errorType?, errorStack?, data?: { k: scalar } }] }` (1–50 events, 64 KB) → 202 `{ accepted }`. Nothing stored: each event is one JSON `console.log` line (`console.error` for level error) in Workers Logs with `message` (`client <app> <name>[: error]`, the SRE agent's fingerprint), `kind: "client_event"`, `source`, `authenticated`, the token's `profileId` (never the body's), `receivedAt`; error events add `errorType` (the client's, else the event name) and `errorStack`, and emails are scrubbed from error text. `token=` values and JWTs redacted, secret-named data keys dropped. 400 `invalid_body`, 413 `payload_too_large`, 401 `missing_auth` (the app without a token) / `invalid_token`, 429 `rate_limited` (`CLIENT_EVENTS_LIMITER`, a Workers rate-limit binding: 120/min per profile, the receiver per IP) |

The mobile app currently signs in with email only (owner, 2026-10-04); `/auth/apple` and
`/auth/google` stay in the API, tested, for when the app adds them back (see `roadmap.md`).

Sign-in config (wrangler `vars`, `.dev.vars.example`): `APPLE_ISSUER`, `APPLE_CLIENT_IDS`,
`GOOGLE_ISSUER`, `GOOGLE_CLIENT_IDS`, `EMAIL_FROM`. ID tokens are verified RS256 against the
issuer's discovery document → JWKS, plus `iss`, `aud` (one of the client ids), `exp`, and `nonce`
when sent. Tests and local dev point the issuers at vercel-labs/emulate
(`pnpm --filter @open-game-system/api emulate`; integration tests start it on 4202/4204 in
`test/integration/global-setup.ts`).

**Email** goes out through [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
(Email Sending): the `send_email` binding `SEND_EMAIL` in `wrangler.jsonc`
(`allowed_sender_addresses: ["sign-in@opengame.org"]`), called through the one seam
`src/lib/email-sender.ts` (`cloudflareEmailSender(binding, EMAIL_FROM).send(to, codeEmail(code))`,
which is `env.SEND_EMAIL.send({ from: { email, name: "OGS" }, to, subject, text, html })`). The
sender's domain must be onboarded to Email Sending on the account. Locally nothing is delivered:
`wrangler dev` captures each message and lists it at
`http://localhost:<port>/cdn-cgi/local/explorer/api/local/email/sending` (a miniflare Local Explorer
route, localhost Host only, never part of the deployed Worker); e2e (tester.army, Detox) read codes
there. vitest-pool-workers can't observe the local binding, so the integration config binds
`SEND_EMAIL` to a recording outbox with the same contract (`test/integration/workers/email-outbox.mjs`,
read through `EMAIL_OUTBOX`).

### Game tokens (slice 3: games know who you are)

A game never sees the app's profile token. It gets an **ES256** JWT for that one game
(`ogs-protocol` `GameTokenSchema`): `{ iss, aud: appId, sub: profileId, handle, name, avatar, iat,
exp }` (1 h), plus `sid` and `players` on the TV page's token. Built from the profile row only — no
friends, other games, device ids, push tokens or age. Signed with the Worker secret
`OGS_GAME_SIGNING_KEY` (private P-256 JWK + `kid`; `pnpm --filter @open-game-system/api game-key`
writes one into `.dev.vars`); games verify with `/.well-known/jwks.json` via
`@open-game-system/profile-kit/server` `verifyOgsToken(token, { appId, jwksUrl })`, which rejects a
token for another game. `avatar` = `<AVATAR_BASE_URL>/art/story-nook/char-<sticker>.webp`.
Delivery: the app's game WebView gets an app-bridge store `profile`
(`{ status: asking | ready(profile) | none }`, refreshed 5 min before expiry); the launcher puts the
session token and players into `ogs:start` and re-sends it when the frame says `ogs:ready`.

### Couch session WebSocket

`CouchSession` (`services/api/src/couch-session.ts`, binding `COUCH_SESSION`, one per cast
via `idFromName(sessionId)`, WebSocket hibernation, state persisted in DO storage). On connect the
DO applies `hello` from the verified token and the profile in D1 (the joiner becomes a member); when a device's last socket closes, `bye`. Client frames
are JSON `ClientMessage`s (except `hello`/`bye`, which are refused); `select` and `remote.take`
always act as the sending device. `select` on home opens the focused `game:<appId>` icon's page, or,
on a `play:<appId>[:<instanceId>]` card (a paused sitting, Surprise me's pick), starts that game at
once as a `game.start` hosted by the selecting phone. Each is applied with `reduceSession` and the `Outbound`s routed:
`all` → every socket, `launcher` → launcher sockets, `{ deviceId }` → that device's sockets. Server
frames: `{ type: "state", state }`, `{ type: "focus.move", dir }` (launcher),
`{ type: "follow", target }`, `{ type: "remote.offer", from }`, and
`{ type: "error", code: invalid_json|invalid_message|identity_from_token|host_only, message }`. Connect errors
are HTTP: 401 `missing_auth`/`invalid_token`, 426 `upgrade_required`.

**Change TV** (`tv.rename { name }`): after the caster's phone moves the cast to another TV it names
that TV; `state.tvName` carries it to every client (phones' hero and Playing strip, the launcher's
header), and the DO writes it to `couch_sessions.tv_name` so `GET /sessions/:sid` (a launcher that
reloads, a phone that joins later) and friends' presence say it too. Until a rename `state.tvName` is
absent and clients show the name the session was created with. Only the caster's phone may send it
(else `host_only`).

**Several couches, one room** (spec §7, [ADR](adrs/2026-10-05-couches-join-the-games-room.md)): each
couch keeps its own CouchSession. `game.start` may name the game's `room` (opens or resumes this
couch's sitting in it; one paused sitting per game and room), the launcher forwards the TV page's
`ogs:room` as `game.room`, and `current.room` / `suspended[].room` / host follows carry it. After every
message the DO writes `session_rooms` when the live room changes (`roomChange` in `lib/presence.ts`),
which presence (`casting`/`playing` gain `room`) and `GET /friends/rooms` read.

## Error Contract

All API errors use this shape (no exceptions):

```json
{ "error": { "code": "snake_case_code", "message": "Human readable", "status": 400 } }
```

Codes: `invalid_body`, `missing_fields`, `invalid_platform`, `missing_auth`, `invalid_auth`, `invalid_api_key`, `device_not_found`, `push_failed`, `session_not_found`, `invalid_token`, `profile_not_found`, `profile_token_required`, `handle_taken`, `unknown_app`, `upgrade_required`, `missing_session`, `session_not_found`, `not_a_member`, `not_a_friend`, `not_multi_couch`, `invalid_id_token`, `invalid_code`, `login_in_use`, `login_not_found`, `email_unavailable`, `email_failed`, `stream_not_configured`, `stream_start_failed`, `publisher_prepare_failed`, `publisher_answer_failed`, `subscribe_failed`, `subscribe_answer_failed`, `forbidden`, `internal_error` (500: an unhandled error, logged once by the request's wide event, see [agents/observability.md](agents/observability.md))

## Database Schema (D1/SQLite)

`cast_sessions` (v1 casting) was removed from schema.sql on 2026-10-06. schema.sql is applied to
production on every deploy and only creates, so the old table stays in the production D1 until
someone drops it deliberately.

| Table | Primary Key | Columns | Notes |
|-------|-------------|---------|-------|
| `devices` | `ogs_device_id` | platform, push_token, created_at, updated_at | Upsert on register |
| `api_keys` | `key` | game_id, game_name, created_at | Manual inserts for now |
| `profiles` | `id` | handle (unique @id), name, sticker, library (JSON app ids, NULL = whole catalogue), created_at | One per person |
| `profile_devices` | `device_id` | profile_id, kind (phone/tablet), name, created_at | One profile per device |
| `profile_logins` | `(provider, subject)` | profile_id, email, created_at | Back-up logins: apple/google (OIDC sub) or email |
| `email_codes` | `email` | code_hash (SHA-256), expires_at (ms), attempts | Pending email sign-in codes |
| `couch_sessions` | `id` | host_profile_id, code (unique TV code), tv_name, created_at (ms) | One per cast, 12 h |
| `session_members` | `(session_id, profile_id)` | joined_at (ms) | Who joined with the TV code |
| `friendships` | `(profile_a, profile_b)` | created_at (ms); `profile_a < profile_b` | Mutual friends, one row per pair |
| `friend_requests` | `id` | from_profile_id, to_profile_id (unique pair), via (code/link/handle), created_at (ms) | Pending until accepted or declined |
| `friend_invites` | `id` | profile_id, code, link_token, qr_token (each unique), expires_at, used_at, used_by | 10 min, single use; QR accepts at once |
| `profile_seen` | `profile_id` | last_seen_at (ms) | Presence "online": written by `anyToken` and the couch WS (≤ 1/min) |
| `session_live` | `session_id` | app_id, since (ms) | Row while the session's TV launcher is connected; written by the CouchSession DO |
| `session_rooms` | `session_id` | app_id, room, since (ms) | The game's room on the session's TV (multiCouch, spec §7), while the TV is connected and the sitting names one; written by the CouchSession DO |
| `instances` | `(profile_id, instance_id)` | app_id, status, title, detail, your_turn, starts_at, resume_url, source, updated_at (ms) | ogs-protocol `InstanceSchema` |

Canonical schema: `services/api/schema.sql`

## Data Flows

### Device Registration

```
apps/mobile                     services/api                   D1
    │                               │                           │
    │  POST /devices/register       │                           │
    │  { ogsDeviceId, platform,     │                           │
    │    pushToken }                │                           │
    │──────────────────────────────►│                           │
    │                               │  INSERT ... ON CONFLICT   │
    │                               │  DO UPDATE SET token=...  │
    │                               │──────────────────────────►│
    │                               │                           │
    │           200 OK              │                           │
    │◄──────────────────────────────│                           │
```

### Send Notification

```
Game Server                     services/api                   D1           APNs/FCM
    │                               │                           │               │
    │  POST /notifications/send     │                           │               │
    │  { deviceId, notification }   │                           │               │
    │──────────────────────────────►│                           │               │
    │                               │  Validate Bearer token    │               │
    │                               │  SELECT * FROM devices    │               │
    │                               │  WHERE ogs_device_id = ?  │               │
    │                               │──────────────────────────►│               │
    │                               │                           │               │
    │                               │  getProviderForPlatform() │               │
    │                               │──────────────────────────────────────────►│
    │                               │                           │               │
    │           200 OK              │                           │               │
    │  { id, status: "sent" }       │                           │               │
    │◄──────────────────────────────│                           │               │
```

### Cast stream (Cloud Run renderer, Realtime SFU)

The only renderer is the Cloud Run GPU service `stream-gpu` (image built from
`services/api/container`), named by the API secret `STREAM_SERVER_URL`. ADR
[2026-10-06-streaming-cloud-run-only](adrs/2026-10-06-streaming-cloud-run-only.md).

```
TV receiver (Chromecast)        services/api /api/v1/stream     Cloud Run stream-gpu      Realtime SFU
    │  POST /start-stream { url }     │                             │                        │
    │────────────────────────────────►│  POST /publisher/prepare    │                        │
    │                                 │────────────────────────────►│ headless Chrome loads  │
    │                                 │◄──── offer + tracks ────────│ the launcher url       │
    │                                 │  createSession(offer) ─────────────────────────────►│
    │                                 │  POST /publisher/answer ───►│◄══ WebRTC (TURN) ═════►│
    │                                 │  addTracks → re-answer ────►│                        │
    │◄── { publisherSessionId } ──────│                             │                        │
    │  POST /subscribe, PUT answer ──►│  subscriber session ──────────────────────────────►│
    │◄═══════════════════════════════ video ════════════════════════════════════════════════│
    │  POST /heartbeat (~1/min) ─────►│  GET /ping ────────────────►│ (410: stream ended)    │
```

### Client logs (wide events)

```
apps/mobile                                   services/api                     Workers Logs
 cast-flow / cast-sync / cast-view /           POST /api/v1/client-events        one JSON line per event
 google-cast-backend ── CastTrace ──►          (Zod, 64 KB, rate limit,  ──►     (console.log / .error),
 (cast.* events, attempt id)                   redact tokens)                    read by the SRE agent
        │ ClientLog: batch ≤ 50, buffer ≤ 500,        ▲
        │ flush every 5 s / on background,            │ no token, source "receiver"
        │ kept in AsyncStorage for the next launch    │
        └──────────── Bearer profile token ───────────┤
apps/web/public/receiver.html (receiver.* events) ────┘ to its stream server's API
```

`services/client-log.ts` is the app's logger (redaction, hashed ids, offline buffer);
`services/cast-trace.ts` names cast events `cast.<step>` and gives each cast / switch / stop one
attempt id that the native session events after it carry. Switching TVs (`cast-flow.ts` `switchTv`)
waits for the old session's ended event (`endSessionAndWait`, 8 s) before `startSession`, because
Google Cast refuses a start while a session is still ending; `services/cast-switch.ts` holds the
phone's switch state (one at a time, "Switching to <TV>…", failure with Try again).
