# Cast-to-TV E2E Test Plan

## What can be automated

### 1. Stream Server API (Playwright + Docker)
Tests that the stream container starts, renders a URL, and provides WebRTC signaling.

```
Test: POST /start-stream returns success with srcPeerId
Test: Container renders target URL (verify via screenshot or DOM check)
Test: WebSocket signaling endpoint is reachable at streamUrl
Test: DELETE /sessions/:id stops the container
Test: Container auto-shuts down after idle timeout
```

**How to run:** Playwright against the OGS API (wrangler dev) with Docker running.

### 2. Cast API (Integration tests)
Tests the OGS API's cast session endpoints.

```
Test: POST /api/v1/cast/sessions creates session and provisions container
Test: GET /api/v1/cast/sessions/:id returns session status
Test: POST /api/v1/cast/sessions/:id/state forwards state to container
Test: DELETE /api/v1/cast/sessions/:id tears down session and container
Test: Invalid viewUrl returns 400
Test: Missing auth returns 401
Test: Stream server failure returns 502
```

**How to run:** Integration tests against wrangler dev with Docker.

### 3. Cast Receiver (Playwright)
Tests the receiver page in a browser (simulating what the Chromecast does).

```
Test: Receiver loads with streamUrl param
Test: Receiver shows "Connecting to game stream..." overlay
Test: Receiver establishes WebRTC peer connection
Test: Receiver displays video element when track received
Test: Receiver shows "Connection timed out" after 15s with no connection
Test: Receiver shows "Cast session ended" when peer disconnects
Test: Receiver handles missing streamUrl gracefully
```

**How to run:** Playwright opens `receiver.html` with a mock or real streamUrl.

### 4. Bridge Handshake (Playwright in WebView-like context)
Tests the app-bridge web side with a mock ReactNativeWebView.

```
Test: Web bridge detects ReactNativeWebView and sends BRIDGE_READY
Test: Web bridge handles STATE_INIT for cast store
Test: Web bridge handles STATE_UPDATE with JSON patches
Test: CastProvider renders children when store is available
Test: CastButton shows when isAvailable is true
Test: CastButton dispatches SHOW_CAST_PICKER on tap
Test: CastButton dispatches STOP_CASTING when connected
```

**How to run:** Playwright with `window.ReactNativeWebView` injected via `page.addInitScript`.

### 5. Native Bridge (Jest/unit tests)
Tests the React Native bridge message handling.

```
Test: BRIDGE_READY triggers STATE_INIT for all registered stores
Test: STATE_INIT sends correct cast store snapshot
Test: EVENT dispatches to correct store
Test: Device updates flow from Google Cast SDK to cast store to bridge
```

**How to run:** Jest with mocked WebView.

## What requires manual testing

### Physical Chromecast
- Chromecast device discovery on local network
- Native Google Cast picker dialog
- Receiver loading on actual Chromecast hardware
- Video quality on TV
- Cast disconnect/reconnect behavior
- Multiple cast devices on network

### iOS App on Physical Device
- OGS app WebView + bridge integration on real hardware
- Local network permission prompt
- App background/foreground behavior during cast
- Cast button in game UI (visual verification)

## Test Infrastructure Needed

1. **Docker** — Must be running for stream container tests
2. **OGS API** — `wrangler dev` with Container binding or STREAM_SERVER_URL
3. **Trivia Jam** — Deployed or local for spectate URL rendering
4. **Playwright** — For browser-based E2E tests
5. **Jest** — For native bridge unit tests (already in place)

## Recommended Test Order

1. Stream server API tests (verify containers start/stop)
2. Cast API integration tests (verify session lifecycle)
3. Receiver tests (verify WebRTC connection + display)
4. Bridge handshake tests (verify web ↔ native communication)
5. Manual: Full flow on physical device with Chromecast

## Running the Full Suite

```bash
# 1. Start Docker
docker info

# 2. Start OGS API with stream server
cd services/api && pnpm dev

# 3. Run automated tests
pnpm test:e2e:cast

# 4. Manual test on phone
# - Install OGS app preview build
# - Open trivia-jam game
# - Tap CastButton → select Chromecast → verify TV shows game
```
