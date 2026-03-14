# TV Casting

## Overview

OGS enables web games to cast a dedicated TV view to Chromecast and AirPlay devices. The TV displays a server-rendered video stream — not a browser running on the TV hardware. This ensures consistent rendering quality regardless of the display device.

Game developers provide two URLs:
1. **Game URL** — the interactive game (runs in OGS WebView on phone)
2. **TV View URL** — the spectator/scoreboard view (rendered server-side by stream-kit)

Cast-kit handles device discovery, session management, and state synchronization. The game developer writes zero casting code beyond dispatching events from headless hooks.

## Actors

- **OGS mobile app** — discovers cast devices via native SDK, brokers sessions with the API
- **Web game (in WebView)** — reads cast state from app-bridge, dispatches cast commands
- **OGS API** — manages cast sessions, orchestrates stream-kit containers
- **Stream-kit container** — renders the TV view in headless Chrome, streams video via WebRTC
- **Receiver page** — minimal `<video>` element on the TV, connects to WebRTC stream
- **Chromecast / AirPlay device** — loads receiver page, displays video

## Flow

```
Phone (WebView)           OGS App              OGS API           Stream-Kit         TV
   │                         │                    │                    │               │
   │ 1. CastButton appears   │                    │                    │               │
   │ (devices detected)      │                    │                    │               │
   │                         │                    │                    │               │
   │ 2. User taps Cast       │                    │                    │               │
   │ dispatch(START_CASTING)  │                    │                    │               │
   │ ────────────────────────>│                    │                    │               │
   │                         │ 3. Create session  │                    │               │
   │                         │ POST /cast/sessions│                    │               │
   │                         │ { deviceId,        │                    │               │
   │                         │   viewUrl }        │                    │               │
   │                         │ ──────────────────>│                    │               │
   │                         │                    │ 4. Spin up         │               │
   │                         │                    │ container          │               │
   │                         │                    │ ──────────────────>│               │
   │                         │                    │                    │ Load viewUrl  │
   │                         │                    │                    │ in headless   │
   │                         │                    │                    │ Chrome        │
   │                         │                    │ { streamUrl }      │               │
   │                         │                    │ <──────────────────│               │
   │                         │ { sessionId,       │                    │               │
   │                         │   streamUrl }      │                    │               │
   │                         │ <──────────────────│                    │               │
   │                         │                    │                    │               │
   │                         │ 5. Send streamUrl  │                    │               │
   │                         │ to TV via Cast SDK │                    │               │
   │                         │ ───────────────────────────────────────────────────────>│
   │                         │                    │                    │               │
   │                         │                    │                    │ 6. WebRTC     │
   │                         │                    │                    │ video stream  │
   │                         │                    │                    │ ─────────────>│
   │                         │                    │                    │               │
   │ 7. State updates        │                    │                    │               │
   │ dispatch(SEND_STATE)    │                    │                    │               │
   │ ────────────────────────>│ POST /sessions/   │                    │               │
   │                         │   :id/state        │                    │               │
   │                         │ ──────────────────>│ relay to container │               │
   │                         │                    │ ──────────────────>│ re-render     │
   │                         │                    │                    │ ─────────────>│
   │                         │                    │                    │               │
   │ 8. User stops cast      │                    │                    │               │
   │ dispatch(STOP_CASTING)  │                    │                    │               │
   │ ────────────────────────>│ DELETE /sessions/  │                    │               │
   │                         │   :id              │                    │               │
   │                         │ ──────────────────>│ tear down          │               │
   │                         │                    │ ──────────────────>│               │
```

## Game Developer Integration

### Web Game (React)

```tsx
import { CastProvider, useCastAvailable, useCastSession, useCastDispatch } from '@open-game-system/cast-kit-react';

function GameLobby() {
  const isAvailable = useCastAvailable();
  const session = useCastSession();
  const dispatch = useCastDispatch();

  if (!isAvailable) return null;

  return (
    <button onClick={() => {
      if (session.status === 'connected') {
        dispatch({ type: 'STOP_CASTING' });
      } else {
        dispatch({ type: 'SHOW_CAST_PICKER' });
      }
    }}>
      {session.status === 'connected' ? `Casting to ${session.deviceName}` : 'Cast to TV'}
    </button>
  );
}

// Wrap app in CastProvider (inside BridgeContext.Provider)
<CastProvider>
  <GameLobby />
</CastProvider>
```

### TV View Page

The TV view URL is a regular web page that receives game state updates. It is rendered server-side by stream-kit — the game developer doesn't need to know about WebRTC or containers.

```tsx
// https://yourgame.com/tv?code=ABCD
function TVView() {
  const [gameState, setGameState] = useState(initialState);

  // Receive state updates from the stream-kit container
  useEffect(() => {
    window.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'state-update') {
        setGameState(data.state);
      }
    });
  }, []);

  return <Scoreboard state={gameState} />;
}
```

## Packages

| Package | Purpose | Audience |
|---------|---------|----------|
| `cast-kit-core` | CastState/CastEvents types, Zod schemas, app-bridge helpers | Internal + game devs |
| `cast-kit-react` | Headless hooks (useCastState, useCastSession, etc.) | Game devs (React) |
| API `/cast/*` routes | Session CRUD, stream-kit orchestration | OGS native app |
| Receiver page | `<video>` + WebRTC | Deployed to Chromecast |

## State Model

The cast store is an app-bridge store owned by the native app:

```typescript
interface CastState {
  isAvailable: boolean;           // Are any cast devices on the network?
  devices: CastDevice[];          // Available devices [{id, name, type}]
  session: {
    status: 'disconnected' | 'connecting' | 'connected';
    deviceId: string | null;
    deviceName: string | null;
    sessionId: string | null;     // API session ID
    streamSessionId: string | null; // Stream-kit session ID
  };
  error: string | null;
}
```

Events dispatched from web → native:
- `SCAN_DEVICES` — request device scan refresh
- `START_CASTING` — connect to a device
- `STOP_CASTING` — end session
- `SEND_STATE_UPDATE` — push game state to TV
- `SHOW_CAST_PICKER` — show native device picker UI
- `RESET_ERROR` — clear error state

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/cast/sessions` | API key | Create session (provisions stream-kit container) |
| GET | `/api/v1/cast/sessions/:id` | API key | Get session status |
| POST | `/api/v1/cast/sessions/:id/state` | API key | Push game state to container |
| DELETE | `/api/v1/cast/sessions/:id` | API key | End session (tears down container) |

## Non-Functional Requirements

- **Latency**: State update → video frame on TV within 200ms
- **Resolution**: Container renders at 1920x1080 (1080p)
- **Session timeout**: Auto-expire after 30 minutes of no state updates
- **Max concurrent**: TBD (depends on CF Container capacity)
- **Cost**: One CF Container per active cast session (server-side rendering cost)

## Constraints

- Requires OGS companion app (Chromecast SDK needs native code)
- Requires internet (stream-kit containers run in the cloud)
- TV view must be a publicly accessible HTTPS URL
- No game logic runs on the TV — it's a read-only video display

## Relationship to Stream-Kit

Cast-kit orchestrates stream-kit. Stream-kit is the rendering engine:
- Cast-kit: "cast this game to that TV"
- Stream-kit: "render this URL in headless Chrome and stream the video"

They can also be used independently — stream-kit can render to any WebRTC client, not just Chromecast receivers.

## Acceptance Tests

84 scenarios across 7 feature files in `docs/acceptance/`:
- Device discovery (9), session lifecycle (10), API (17+), state updates (9), stream rendering (12), receiver (9), UI components (18)
