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
| API | `services/api/` | Auth, device registration, push dispatch | Hono, D1 |
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

## Error Contract

All API errors use this shape (no exceptions):

```json
{ "error": { "code": "snake_case_code", "message": "Human readable", "status": 400 } }
```

Codes: `invalid_body`, `missing_fields`, `invalid_platform`, `missing_auth`, `invalid_auth`, `invalid_api_key`, `device_not_found`, `push_failed`

## Database Schema (D1/SQLite)

| Table | Primary Key | Columns | Notes |
|-------|-------------|---------|-------|
| `devices` | `ogs_device_id` | platform, push_token, created_at, updated_at | Upsert on register |
| `api_keys` | `key` | game_id, game_name, created_at | Manual inserts for now |

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

### Streaming (Planned)

```
Game Client                     services/api              CF Container        Display
    │                               │                         │                  │
    │  POST /streams/create         │                         │                  │
    │  { game_url, session_id }     │                         │                  │
    │──────────────────────────────►│                         │                  │
    │                               │  Spin up container      │                  │
    │                               │  with Puppeteer         │                  │
    │                               │────────────────────────►│                  │
    │           stream_id           │                         │  Load game_url   │
    │◄──────────────────────────────│                         │  in headless     │
    │                               │                         │  Chrome          │
    │  WebRTC signaling via PeerJS  │                         │                  │
    │◄─────────────────────────────────────────────────────►  │                  │
    │                               │                         │  WebRTC stream   │
    │                               │                         │─────────────────►│
```
