# Push Notifications

## Overview

The OGS API enables game servers to send push notifications to players who have the OGS companion app installed. Notifications are delivered via Expo Push Service, which handles APNs (iOS) and FCM (Android) delivery.

Game developers never deal with device IDs, push tokens, or Apple/Google APIs. They receive an opaque **device token** (JWT) from the player through the app-bridge and pass it to the OGS API when sending notifications.

## Actors

- **OGS mobile app** — registers device, exposes device token via app-bridge
- **Web game (in WebView)** — reads device token from bridge, sends to game server
- **Game server** — stores device tokens, sends notifications via OGS API
- **OGS API** — issues device tokens, validates, routes, and delivers notifications
- **Expo Push Service** — relays to APNs/FCM

## Flow

```
OGS App                    Game (WebView)           Game Server              OGS API
   │                           │                        │                      │
   │ 1. Register device        │                        │                      │
   │ POST /devices/register    │                        │                      │
   │ { ogsDeviceId, platform,  │                        │                      │
   │   pushToken }             │                        │                      │
   │ ──────────────────────────────────────────────────────────────────────────>│
   │                           │                        │                      │
   │ { deviceToken: "eyJ..." } │                        │    JWT signed with   │
   │ <─────────────────────────────────────────────────────────────────────────│
   │                           │                        │    API secret key    │
   │                           │                        │                      │
   │ 2. Expose via bridge      │                        │                      │
   │ ─────────────────────────>│                        │                      │
   │   deviceToken in store    │                        │                      │
   │                           │                        │                      │
   │                           │ 3. Send to server      │                      │
   │                           │ { deviceToken }        │                      │
   │                           │ ──────────────────────>│                      │
   │                           │                        │                      │
   │                           │                        │ 4. Send notification │
   │                           │                        │ POST /notifications/ │
   │                           │                        │   send               │
   │                           │                        │ Auth: Bearer <key>   │
   │                           │                        │ { deviceToken,       │
   │                           │                        │   notification }     │
   │                           │                        │ ───────────────────> │
   │                           │                        │                      │
   │                           │                        │ 5. Verify JWT        │
   │                           │                        │    Extract deviceId  │
   │                           │                        │    Lookup pushToken  │
   │                           │                        │    Send via Expo     │
   │                           │                        │                      │
   │                           │                        │ { sent, deviceActive}│
   │                           │                        │ <─────────────────── │
```

## Device Registration

Players' devices register with the OGS API when the app launches. Registration is idempotent — re-registering updates the push token and returns a new device token.

**Endpoint:** `POST /api/v1/devices/register`

**Request:**
- `ogsDeviceId` — stable UUID per device, stored in secure storage
- `platform` — `ios` or `android`
- `pushToken` — Expo push token (e.g., `ExponentPushToken[xxx]`)

**Response:**
- `deviceId` — the registered device ID
- `deviceToken` — signed JWT encoding the device ID (pass this to games)
- `registered` — boolean

**No auth required** — registration is open by design. See ADR 2026-03-14-device-token-jwt for rationale.

## Device Token (JWT)

The device token is a JWT signed by the OGS API's secret key. Contents:

```json
{
  "sub": "<ogsDeviceId>",
  "iat": <issued_at>,
  "iss": "ogs-api"
}
```

- No expiration — valid as long as the device is registered
- Opaque to game developers — they store and pass it, never parse it
- Exposed to web games via app-bridge notification store
- Re-registration issues a new token (old tokens still work, same device ID)

## Sending Notifications

Game servers send notifications using the device token. Requires Bearer token auth with a valid API key.

**Endpoint:** `POST /api/v1/notifications/send`

**Request:**
- `deviceToken` — the JWT device token received from the player
- `notification.title` — notification title
- `notification.body` — notification body
- `notification.data` — optional key-value data payload (e.g., `{ gameId, action }`)

**Response (success):**
- `id` — unique notification ID
- `status` — `"sent"`
- `deviceActive` — `true` (device token is still valid)

**Response (push failure):**
- `error.code` — `"push_failed"`
- `deviceActive` — `false` if device is no longer registered, `true` otherwise

## Device Lifecycle

- **Registration** — device appears in database, device token issued
- **Token rotation** — app re-registers with new Expo push token, new device token issued
- **Cleanup** — when Expo returns `DeviceNotRegistered`, device is deleted from database
- **Stale token detection** — `deviceActive: false` in send response tells game server to stop targeting that token

## Error Handling

All errors follow the standard OGS error shape:
```json
{ "error": { "code": "string", "message": "string", "status": number } }
```

### Registration errors
- `invalid_body` (400) — request body is not valid JSON
- `missing_fields` (400) — required fields missing
- `invalid_platform` (400) — platform must be `ios` or `android`

### Send errors
- `invalid_body` (400) — request body is not valid JSON
- `missing_fields` (400) — required fields missing
- `missing_auth` (401) — no Authorization header
- `invalid_auth` (401) — malformed Authorization header
- `invalid_api_key` (401) — API key not found
- `invalid_device_token` (401) — JWT signature invalid or malformed
- `device_not_found` (404) — device ID from token not in database
- `push_failed` (502) — Expo Push Service returned an error
