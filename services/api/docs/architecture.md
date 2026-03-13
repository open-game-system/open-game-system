# Architecture

## Overview

opengame-api is a Cloudflare Workers API built with Hono that serves as a push notification relay for the Open Game System. It has two primary functions:

1. **Device registration** -- the OGS mobile app registers its push token
2. **Notification dispatch** -- game servers send push notifications to registered devices

## API Route Structure

```mermaid
graph LR
    Client["Client Request"]
    CORS["CORS Middleware"]
    Health["/api/v1/health"]
    Devices["/api/v1/devices"]
    AuthMW["API Key Auth Middleware"]
    Notifications["/api/v1/notifications"]

    Client --> CORS
    CORS --> Health
    CORS --> Devices
    CORS --> AuthMW --> Notifications
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | None | Health check, returns `{ status: "ok" }` |
| POST | `/api/v1/devices/register` | None | Register/update a device push token |
| POST | `/api/v1/notifications/send` | Bearer API key | Send a push notification to a device |

## Device Registration Flow

```mermaid
sequenceDiagram
    participant App as OGS Mobile App
    participant API as opengame-api
    participant D1 as D1 Database

    App->>API: POST /api/v1/devices/register
    Note right of App: { ogsDeviceId, platform, pushToken }
    API->>API: Validate request body
    API->>D1: INSERT ... ON CONFLICT DO UPDATE
    D1-->>API: Success
    API-->>App: { deviceId, registered: true }
```

The registration endpoint uses an upsert pattern (`ON CONFLICT(ogs_device_id) DO UPDATE SET`) so that re-registering with a new push token is idempotent and updates the existing record.

## Push Notification Send Flow

```mermaid
sequenceDiagram
    participant Game as Game Server
    participant API as opengame-api
    participant Auth as Auth Middleware
    participant D1 as D1 Database
    participant Provider as Push Provider (APNs/FCM)

    Game->>API: POST /api/v1/notifications/send
    Note right of Game: Authorization: Bearer <api_key>
    API->>Auth: Validate API key
    Auth->>D1: SELECT FROM api_keys WHERE key = ?
    D1-->>Auth: api_key row (or null)
    alt Invalid key
        Auth-->>Game: 401 { error: { code: "invalid_api_key" } }
    end
    Auth->>API: Set gameId, gameName on context
    API->>D1: SELECT FROM devices WHERE ogs_device_id = ?
    D1-->>API: device row (or null)
    alt Device not found
        API-->>Game: 404 { error: { code: "device_not_found" } }
    end
    API->>Provider: send(push_token, notification)
    Provider-->>API: PushResult { success, providerMessageId }
    API-->>Game: { id: <uuid>, status: "sent" }
```

## Auth Middleware Flow

```mermaid
flowchart TD
    A[Incoming Request] --> B{Authorization header present?}
    B -- No --> C[401 missing_auth]
    B -- Yes --> D{Bearer scheme?}
    D -- No --> E[401 invalid_auth]
    D -- Yes --> F[Query api_keys table]
    F --> G{Key found?}
    G -- No --> H[401 invalid_api_key]
    G -- Yes --> I[Set gameId + gameName on context]
    I --> J[Call next handler]
```

## Database Schema (D1)

```mermaid
erDiagram
    devices {
        TEXT ogs_device_id PK
        TEXT platform "CHECK (ios, android)"
        TEXT push_token
        TEXT created_at
        TEXT updated_at
    }

    api_keys {
        TEXT key PK
        TEXT game_id
        TEXT game_name
        TEXT created_at
    }
```

### Indexes

- `idx_devices_push_token` on `devices(push_token)`
- `idx_api_keys_game_id` on `api_keys(game_id)`

## Push Providers

The `PushProvider` interface defines a single `send(pushToken, notification) -> PushResult` method. Two implementations exist:

- **ApnsProvider** -- for iOS devices (currently a stub that logs and returns success)
- **FcmProvider** -- for Android devices (currently a stub that logs and returns success)

The `getProviderForPlatform()` factory function selects the correct provider based on the device's `platform` field.

## Project Structure

```
src/
  index.ts              -- App entrypoint, route mounting, CORS
  types.ts              -- Env, DB row types, request types
  middleware/
    auth.ts             -- API key Bearer auth middleware
  providers/
    push.ts             -- PushProvider interface, ApnsProvider, FcmProvider (stubs)
  routes/
    devices.ts          -- POST /register endpoint
    notifications.ts    -- POST /send endpoint
test/
  health.test.ts        -- Health endpoint tests
  devices.test.ts       -- Device registration tests
  notifications.test.ts -- Notification send tests (with auth)
schema.sql              -- D1 database schema
wrangler.toml           -- Cloudflare Workers config
vitest.config.ts        -- Vitest config (node environment)
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on push and PRs to `main`. Installs deps, runs typecheck, runs tests.
- **Deploy** (`.github/workflows/deploy.yml`): Runs on push to `main`. Deploys to Cloudflare Workers via `wrangler deploy` using `CLOUDFLARE_API_TOKEN` secret.
