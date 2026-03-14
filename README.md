# Open Game System

Add push notifications and TV casting to your web game in minutes. No native code required.

The Open Game System (OGS) lets web game developers tap into native mobile capabilities through the OGS companion app. Your players install the app, open your game in it, and you get access to push notifications, Google Cast, and cloud rendering — all through lightweight JavaScript SDKs.

## What You Can Do

### Push Notifications

Notify your players when it's their turn, when a game starts, or when a friend joins.

**1. Client — detect OGS and register the device**

```tsx
import { NotificationProvider, useNotifications } from "@open-game-system/notification-kit-react";

function App() {
  return (
    <NotificationProvider>
      <Game />
    </NotificationProvider>
  );
}

function Game() {
  const { isInOGSApp, deviceId } = useNotifications();

  useEffect(() => {
    if (isInOGSApp && deviceId) {
      // Send the OGS device ID to your server, along with the logged-in user
      fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
        },
        body: JSON.stringify({ ogsDeviceId: deviceId }),
      });
    }
  }, [isInOGSApp, deviceId]);
}
```

**2. Your server — save the device for the user**

```ts
// POST /api/devices — associate an OGS device with the authenticated user
app.post("/api/devices", async (req, res) => {
  const userId = getUserFromJwt(req); // your auth
  const { ogsDeviceId } = req.body;

  // One user can have multiple devices (phone + tablet)
  await db.query(
    `INSERT INTO user_devices (user_id, ogs_device_id)
     VALUES ($1, $2)
     ON CONFLICT (ogs_device_id) DO UPDATE SET user_id = $1`,
    [userId, ogsDeviceId]
  );

  res.json({ ok: true });
});
```

**3. Your server — send a push to all of a user's devices**

```ts
import { createNotificationClient } from "@open-game-system/notification-kit-server";

const ogs = createNotificationClient({ apiKey: "your-ogs-api-key" });

async function notifyUser(userId: string, title: string, body: string) {
  // Look up every device the user has registered
  const devices = await db.query(
    "SELECT ogs_device_id FROM user_devices WHERE user_id = $1",
    [userId]
  );

  // Send to all devices in parallel
  await ogs.sendBulkNotifications(
    devices.map((d) => ({
      deviceId: d.ogs_device_id,
      notification: { title, body },
    }))
  );
}

// Example: notify a player it's their turn
await notifyUser(nextPlayerId, "Your turn!", "Alex just played. You're up next in Settlers.");
```

### TV Casting

Let players cast your game to a TV with one tap. The phone becomes a controller, the TV becomes the display.

```tsx
import { createCastKitContext } from "@open-game-system/cast-kit/react";

const CastKit = createCastKitContext();

function GameUI() {
  return (
    <CastKit.Provider>
      <CastKit.CastButton gameId="my-game" broadcastUrl="https://my-game.com/tv" />
      <CastKit.When casting>
        {/* Phone UI switches to controller mode */}
        <ControllerView />
      </CastKit.When>
    </CastKit.Provider>
  );
}
```

### Cloud Streaming (coming soon)

Render your game in the cloud and stream it to any screen via WebRTC.

```tsx
import { createStreamClient } from "@open-game-system/stream-kit-web";

const stream = createStreamClient({ brokerUrl: "https://api.opengame.org/stream" });
const session = await stream.requestStream({ url: "https://my-game.com", quality: "1080p" });
```

## Packages

Install only what you need:

| Package | Purpose | Install |
|---------|---------|---------|
| `@open-game-system/notification-kit-react` | React hooks for push notifications | `pnpm add @open-game-system/notification-kit-react` |
| `@open-game-system/notification-kit-server` | Server-side notification client | `pnpm add @open-game-system/notification-kit-server` |
| `@open-game-system/cast-kit` | TV casting (Google Cast) | `pnpm add @open-game-system/cast-kit` |
| `@open-game-system/stream-kit-react` | React streaming components | `pnpm add @open-game-system/stream-kit-react` |
| `@open-game-system/stream-kit-web` | Streaming client (no React) | `pnpm add @open-game-system/stream-kit-web` |

Lower-level packages (you probably don't need these directly):

| Package | Purpose |
|---------|---------|
| `@open-game-system/notification-kit-core` | OGS detection, device ID access |
| `@open-game-system/app-bridge-web` | WebView-to-native communication |
| `@open-game-system/app-bridge-react` | React bindings for the bridge |
| `@open-game-system/cast-kit/mock` | Mock cast client for testing |
| `@open-game-system/app-bridge-testing` | Mock bridge for testing |
| `@open-game-system/stream-kit-testing` | Mock stream client for testing |

## How It Works

```
Your Web Game (in OGS app WebView)
    │
    ├── notification-kit-react → detects OGS, reads device ID
    ├── cast-kit/react → cast button, device picker, controller mode
    └── stream-kit-react → cloud-rendered video stream
           │
           ▼
    OGS Companion App (native)
    │   Hosts your game in a WebView
    │   Handles push tokens, Google Cast, WebRTC
    │
    ▼
Your Game Server
    │
    └── notification-kit-server → sends push notifications via OGS API
```

The OGS companion app is the bridge. Your game runs as a normal web app inside it. The SDKs communicate with the native layer through a postMessage bridge — you never write Swift or Kotlin.

## Contributing

This is a pnpm monorepo. To work on the SDKs themselves:

```bash
git clone https://github.com/open-game-system/open-game-system.git
cd open-game-system
pnpm install
pnpm build
pnpm test
```

See [docs/architecture.md](docs/architecture.md) for the full system map.

## Links

- Website: [opengame.org](https://opengame.org)
- GitHub: [open-game-system](https://github.com/open-game-system)

## License

MIT
