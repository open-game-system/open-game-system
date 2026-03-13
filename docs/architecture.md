# System Architecture

## Overview

The Open Game System (OGS) is a platform that lets web games use native mobile capabilities -- push notifications, streaming/casting, and native UI -- without leaving the browser paradigm. Game developers build standard web games, then integrate lightweight SDKs that communicate through the OGS host app via a WebView bridge.

## Architecture Diagram

```
 GAME DEVELOPER                        OGS PLATFORM                         EXTERNAL
 ─────────────                         ────────────                         ────────

 ┌─────────────────┐
 │  Game Web App    │
 │  (React/HTML)    │
 │                  │
 │  ┌─────────────┐ │    ┌──────────────────────────────────────────┐
 │  │ app-bridge   │◄────┤  opengame-app (Expo/React Native)        │
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
 │  │notification-kit│─────►│  opengame-api               │
 │  │-server         │ │    │  (Cloudflare Worker + D1)   │
 │  └────────────────┘ │    │                             │
 │                     │    │  POST /notifications/send ──┼──► APNs (iOS)
 │  ┌────────────────┐ │    │                             │──► FCM  (Android)
 │  │stream-kit      │ │    │                             │
 │  │-server         │─────►│  /streams/* (planned) ──────┼──► CF Containers
 │  └────────────────┘ │    └────────────────────────────┘      (headless browser
 │                     │                                         WebRTC render)
 └─────────────────────┘
```

## Package Dependency Graph

```
app-bridge-types  (leaf -- no OGS deps)
  ├── app-bridge-web
  │     └── app-bridge-react
  ├── app-bridge-native
  │     └── app-bridge-react-native
  └── app-bridge-testing

notification-kit-core  (depends on app-bridge externally)
  ├── notification-kit-react
  └── notification-kit-server

stream-kit-types  (leaf -- no OGS deps)
  ├── stream-kit-web
  │     ├── stream-kit-react
  │     └── stream-kit-testing
  └── stream-kit-server

opengame-api  (standalone -- no workspace deps, uses Hono)
opengame-app  (depends on app-bridge-native, -react-native, -types, -testing)
```

## Auth Model

The API uses Bearer token authentication against an `api_keys` table in D1.

```
Client request:
  Authorization: Bearer <api-key>
        │
        ▼
  Auth middleware (src/middleware/auth.ts)
        │
        ├── SELECT * FROM api_keys WHERE key = ?
        │
        ├── 401 if missing/invalid
        │
        └── Sets game_id + game_name on Hono context
              │
              ▼
        Route handlers access c.var.gameId / c.var.gameName
```

Each API key is scoped to a single game. The `api_keys` table stores `game_id`, `game_name`, and the hashed key.

## Data Flow: Push Notifications

### 1. Device Registration

```
opengame-app                    opengame-api                   D1
    │                               │                           │
    │  POST /devices/register       │                           │
    │  { platform, token, user_id } │                           │
    │──────────────────────────────►│                           │
    │                               │  INSERT ... ON CONFLICT   │
    │                               │  DO UPDATE SET token=...  │
    │                               │──────────────────────────►│
    │                               │                           │
    │           201 Created         │                           │
    │◄──────────────────────────────│                           │
```

### 2. Send Notification

```
Game Server                     opengame-api                   D1           APNs/FCM
    │                               │                           │               │
    │  POST /notifications/send     │                           │               │
    │  { user_id, title, body }     │                           │               │
    │──────────────────────────────►│                           │               │
    │                               │  SELECT * FROM devices    │               │
    │                               │  WHERE user_id = ?        │               │
    │                               │──────────────────────────►│               │
    │                               │                           │               │
    │                               │  For each device:         │               │
    │                               │  getProviderForPlatform() │               │
    │                               │──────────────────────────────────────────►│
    │                               │                           │               │
    │           200 OK              │                           │               │
    │  { results: [...] }           │                           │               │
    │◄──────────────────────────────│                           │               │
```

## Data Flow: Streaming (Planned)

Stream-kit enables casting a web game to a TV/display via WebRTC. The server renders the game in a headless browser and streams the output.

```
Game Client                     opengame-api              CF Container        Display
    │                               │                         │                  │
    │  POST /streams/create         │                         │                  │
    │  { game_url, session_id }     │                         │                  │
    │──────────────────────────────►│                         │                  │
    │                               │  Spin up container      │                  │
    │                               │  with Puppeteer         │                  │
    │                               │────────────────────────►│                  │
    │                               │                         │  Load game_url   │
    │                               │                         │  in headless     │
    │           stream_id           │                         │  Chrome          │
    │◄──────────────────────────────│                         │                  │
    │                               │                         │                  │
    │  WebRTC signaling             │                         │                  │
    │◄───────────────────────────────────────────────────────►│                  │
    │                               │                         │                  │
    │  Game state sync via          │                         │  WebRTC stream   │
    │  stream-kit-web PeerJS        │                         │─────────────────►│
    │──────────────────────────────────────────────────────►  │                  │
```

The stream-kit packages handle:
- **stream-kit-web**: Client-side PeerJS connection, state synchronization
- **stream-kit-react**: React hooks for stream lifecycle
- **stream-kit-server**: Puppeteer-based headless renderer, PeerJS signaling
- **stream-kit-types**: Shared state/message type definitions
