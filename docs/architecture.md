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
| API | `services/api/` | Auth, device registration, push dispatch, households, catalogue, instances, couch session DO | Hono, D1, Durable Objects, ogs-protocol |
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

### Household tokens (OGS app v3)

The app, kid iPads and the TV launcher use household JWTs instead of API keys: HS256 signed with
`OGS_JWT_SECRET`, claims = `ogs-protocol` `ClaimsSchema` (`hid`, `did`, `pid?`, `kind`
phone|tablet|launcher, `exp`). Phone/tablet tokens last 365 days, launcher tokens 12 h.
`middleware/household-auth.ts` guards every `/api/v1/households/:hid/*` route: missing header →
401 `missing_auth`, non-Bearer → 401 `invalid_auth`, bad signature/expired/not claims → 401
`invalid_token`, another household → 403 `forbidden_household`, unknown household → 404
`household_not_found`. Managing the household (pairing, launcher tokens, library edits) needs a
phone token → else 403 `phone_required`.

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/api/v1/households` | none | `{ name, people: [{ name, band, sticker }], device: { deviceId, kind: "phone", name, personIndex? } }` → 201 `{ householdId, people (with ids), token }` |
| GET | `/api/v1/households/:hid` | any household token | → `{ id, name, people, devices: [{ deviceId, kind, personId, name }] }` |
| POST | `/api/v1/households/:hid/devices` | phone | `{ deviceId, kind: phone\|tablet, personId?, name }` → 201 `{ token }` |
| POST | `/api/v1/households/:hid/launcher-token` | phone | → 201 `{ token }` (`kind: launcher`, `did: launcher-<uuid>`, 12 h) |
| GET | `/api/v1/catalogue` | none | → `Manifest[]` (the five deployed games, `services/api/src/catalogue.ts`) |
| GET | `/api/v1/households/:hid/library` | any household token | → `{ appIds }` (whole catalogue until changed) |
| PUT | `/api/v1/households/:hid/library` | phone | `{ appIds }` (catalogue ids, de-duplicated, ordered) → `{ appIds }` |
| POST | `/api/v1/households/:hid/instances` | any household token | `InstanceReport & { source: bridge\|visit }` → `Instance` (upsert by instanceId, `updatedAt` = now) |
| GET | `/api/v1/households/:hid/instances` | any household token | → `Instance[]` newest first (clients run `playingView`) |
| GET (WS) | `/api/v1/couch/ws?token=<household token>` | token in query | WebSocket to the household's `CouchSession` DO |

### Couch session WebSocket

`CouchSession` (`services/api/src/couch-session.ts`, binding `COUCH_SESSION`, one per household
via `idFromName(hid)`, WebSocket hibernation, state persisted in DO storage). On connect the DO
applies `hello` from the token's claims; when a device's last socket closes, `bye`. Client frames
are JSON `ClientMessage`s (except `hello`/`bye`, which are refused); `select` and `remote.take`
always act as the sending device. Each is applied with `reduceSession` and the `Outbound`s routed:
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

Codes: `invalid_body`, `missing_fields`, `invalid_platform`, `missing_auth`, `invalid_auth`, `invalid_api_key`, `device_not_found`, `push_failed`, `session_not_found`, `stream_provisioning_failed`, `invalid_view_url`, `invalid_token`, `forbidden_household`, `household_not_found`, `phone_required`, `unknown_person`, `unknown_app`, `upgrade_required`

## Database Schema (D1/SQLite)

| Table | Primary Key | Columns | Notes |
|-------|-------------|---------|-------|
| `devices` | `ogs_device_id` | platform, push_token, created_at, updated_at | Upsert on register |
| `api_keys` | `key` | game_id, game_name, created_at | Manual inserts for now |
| `cast_sessions` | `session_id` | game_id, device_id, view_url, stream_session_id, stream_url, status, created_at, updated_at | Status: pending/active/ended |
| `households` | `id` | name, library (JSON app ids, NULL = whole catalogue), created_at | OGS app v3 identity |
| `household_people` | `id` | household_id, name, band (grownup/kid/little), sticker, created_at | |
| `household_devices` | `device_id` | household_id, kind (phone/tablet/launcher), person_id, name, created_at | Upsert on pair |
| `instances` | `(household_id, instance_id)` | app_id, status, title, detail, your_turn, starts_at, resume_url, source, updated_at (ms) | ogs-protocol `InstanceSchema` |

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
