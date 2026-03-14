# JWT Device Tokens for Push Notifications

**Date:** 2026-03-14
**Status:** Accepted

## Context

The OGS API needs a way for game servers to send push notifications to players' devices. The security model must:
- Not require user accounts or login
- Not require game developers to integrate with an OGS auth system
- Prevent unauthorized push delivery (spoofing, forging device IDs)
- Work seamlessly through the app-bridge (OGS app → WebView → game)

## Decision

Use **signed JWT device tokens** issued by the OGS API at device registration. The game server never sees the raw device ID — it receives an opaque token from the player via the app-bridge and passes it back to the OGS API when sending notifications.

### Flow

1. **OGS app registers device** — `POST /api/v1/devices/register` with `{ ogsDeviceId, platform, pushToken }`. No auth required. Returns a signed `deviceToken` (JWT).

2. **App-bridge exposes device token** — The OGS app injects the `deviceToken` into the WebView via the app-bridge. Web games read it through the notification-kit SDK.

3. **Game sends player's token to its server** — The web game sends the opaque `deviceToken` to its own game server (e.g., when joining a game lobby).

4. **Game server sends notification** — `POST /api/v1/notifications/send` with `{ deviceToken, notification }` and `Authorization: Bearer <api_key>`. The API verifies the JWT signature, extracts the device ID, looks up the push token, and delivers via Expo Push.

### JWT Contents

```json
{
  "sub": "<ogsDeviceId>",
  "iat": <issued_at>,
  "iss": "ogs-api"
}
```

No expiration — the token is valid as long as the device is registered. When a device re-registers (token rotation), a new JWT is issued. Old JWTs still work because they reference the same device ID — the API always looks up the current push token from the database.

### Security Properties

- **Can't forge** — JWT is signed with the API's secret key (HMAC-SHA256)
- **Can't send without API key** — the send endpoint requires Bearer auth
- **Can't target arbitrary devices** — game servers only have tokens that players voluntarily shared
- **No user accounts needed** — the device is the identity
- **No game-side auth integration** — games just pass through an opaque token
- **Device cleanup** — when Expo returns `DeviceNotRegistered`, the device is deleted and future sends with that token return `deviceActive: false`

### Registration is open by design

Anyone can call `/devices/register` and get a JWT. This is fine because:
1. The JWT is useless without an API key (needed to send)
2. Registering just creates a device record — no privilege escalation
3. This is analogous to email: anyone can share their address, but only authorized senders can reach them

## Consequences

- API needs a signing secret (`OGS_JWT_SECRET`) in environment/secrets
- The `send` endpoint changes from `deviceId` to `deviceToken`
- notification-kit-server client needs to accept `deviceToken` instead of `deviceId`
- The OGS app needs to store and expose the `deviceToken` via app-bridge
- Game developers interact with opaque tokens, not device internals
