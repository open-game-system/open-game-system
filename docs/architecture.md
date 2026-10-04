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
 │  │-web            │─────►│  /streams/* (planned) ──────┼──► CF Containers
 │  └────────────────┘ │    └────────────────────────────┘      (headless browser
 │                     │                                         WebRTC render)
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
| GET / POST | `/api/v1/me/instances` | any (launcher = host's) | `Instance[]` newest first / `InstanceReport & { source: bridge\|visit }` → `Instance` |
| POST | `/api/v1/sessions` | phone/tablet | `{ tvName }` → 201 `{ sessionId, code, tvName, host, token }` (launcher token) |
| GET | `/api/v1/sessions/:sid` | its launcher, host or a member | → `{ sessionId, code, tvName, host }`; 403 `not_a_member`, 404 `session_not_found` |
| POST | `/api/v1/sessions/join` | phone/tablet | `{ code }` (TV code; case, spaces, dashes ignored) → session view; 404 `session_not_found` |
| POST | `/api/v1/auth/apple`, `/auth/google` | optional phone/tablet | `{ idToken, nonce?, device? }`: with a token links the login (back up) → `Me`; without signs in (`device` required) → `Me & { token }`. 401 `invalid_id_token`, 409 `login_in_use`, 404 `login_not_found` |
| POST | `/api/v1/auth/email/start` | none | `{ email }` → 202 `{ sent: true }` (6-digit code, 10 min, 5 tries, via Resend); 503 `email_unavailable`, 502 `email_failed` |
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
| GET | `/api/v1/catalogue` | none | → `Manifest[]` (the five deployed games, `services/api/src/catalogue.ts`; local dev/e2e may point start URLs at local servers with `CATALOGUE_START_URLS` = JSON `{ appId: url }`) |
| POST | `/api/v1/games/:appId/token` | phone/tablet | Game token for the app's WebView → `{ token, profile: { id, handle, name, avatar }, expiresAt }`; 404 `game_not_found`, 403 `profile_token_required` (launcher), 503 `game_tokens_unavailable` |
| POST | `/api/v1/sessions/:sid/game-token` | its launcher, host or a member | `{ appId }` → `{ token, players, expiresAt }` for the framed TV page (`sid`, players = host + joined); 403 `not_a_member`, 404 `session_not_found` / `game_not_found`, 503 `game_tokens_unavailable` |
| GET | `/.well-known/jwks.json` | none | OGS's public game-token key `{ keys: [{ kty: "EC", crv: "P-256", x, y, kid, alg: "ES256", use: "sig" }] }` (cache 5 min) |
| GET (WS) | `/api/v1/couch/ws?token=&session=` | token in query | launcher: its own session; phone/tablet: host or member of `session`. 400 `missing_session`, 403 `not_a_member`, 404 `session_not_found` |

Sign-in config (wrangler `vars`, `.dev.vars.example`): `APPLE_ISSUER`, `APPLE_CLIENT_IDS`,
`GOOGLE_ISSUER`, `GOOGLE_CLIENT_IDS`, `RESEND_BASE_URL`, `EMAIL_FROM`; secret `RESEND_API_KEY`.
ID tokens are verified RS256 against the issuer's discovery document → JWKS, plus `iss`, `aud`
(one of the client ids), `exp`, and `nonce` when sent. Tests and local dev point these at
vercel-labs/emulate (`pnpm --filter @open-game-system/api emulate`; integration tests start it on
4202/4204/4208 in `test/integration/global-setup.ts`).

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
`{ type: "error", code: invalid_json|invalid_message|identity_from_token, message }`. Connect errors
are HTTP: 401 `missing_auth`/`invalid_token`, 426 `upgrade_required`.

## Error Contract

All API errors use this shape (no exceptions):

```json
{ "error": { "code": "snake_case_code", "message": "Human readable", "status": 400 } }
```

Codes: `invalid_body`, `missing_fields`, `invalid_platform`, `missing_auth`, `invalid_auth`, `invalid_api_key`, `device_not_found`, `push_failed`, `session_not_found`, `stream_provisioning_failed`, `invalid_view_url`, `invalid_token`, `profile_not_found`, `profile_token_required`, `handle_taken`, `unknown_app`, `upgrade_required`, `missing_session`, `session_not_found`, `not_a_member`, `invalid_id_token`, `invalid_code`, `login_in_use`, `login_not_found`, `email_unavailable`, `email_failed`

## Database Schema (D1/SQLite)

| Table | Primary Key | Columns | Notes |
|-------|-------------|---------|-------|
| `devices` | `ogs_device_id` | platform, push_token, created_at, updated_at | Upsert on register |
| `api_keys` | `key` | game_id, game_name, created_at | Manual inserts for now |
| `cast_sessions` | `session_id` | game_id, device_id, view_url, stream_session_id, stream_url, status, created_at, updated_at | Status: pending/active/ended |
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

### Cast Session (TV Casting via Stream-Kit)

```
OGS Native App                 services/api              CF Container        TV (Chromecast)
    │                               │                         │                  │
    │  POST /cast/sessions          │                         │                  │
    │  { deviceId, viewUrl }        │                         │                  │
    │──────────────────────────────►│                         │                  │
    │                               │  POST /start-stream     │                  │
    │                               │  to stream server       │                  │
    │                               │────────────────────────►│                  │
    │                               │                         │  Load viewUrl    │
    │                               │                         │  in headless     │
    │           201 Created         │                         │  Chrome          │
    │  { sessionId, streamUrl }     │                         │                  │
    │◄──────────────────────────────│                         │                  │
    │                               │                         │                  │
    │  Send streamUrl to TV         │                         │  WebRTC stream   │
    │  via Cast SDK                 │                         │─────────────────►│
    │───────────────────────────────────────────────────────────────────────────►│
    │                               │                         │                  │
    │  POST /cast/sessions/:id/state│                         │                  │
    │  { state: { round: 3 } }     │                         │                  │
    │──────────────────────────────►│  Relay to container     │                  │
    │                               │────────────────────────►│  Re-render       │
    │                               │                         │─────────────────►│
    │                               │                         │                  │
    │  DELETE /cast/sessions/:id    │                         │                  │
    │──────────────────────────────►│  Tear down container    │                  │
    │                               │────────────────────────►│                  │
```
