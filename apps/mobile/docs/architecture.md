# Architecture

## System Overview

opengame-app is the native mobile shell in the Open Game System (OGS) ecosystem. Web games run inside a WebView; the app provides native capabilities they cannot access on their own.

```mermaid
graph LR
    subgraph "OGS Mobile App"
        A[Expo Router] --> B[WebView]
        A --> C[Push Notifications]
        A --> D[Deep Link Handler]
        A --> E[Google Cast]
        B <-->|app-bridge| F[Web Game]
    end

    C -->|register device| G[opengame-api]
    G -->|send push| C
    F -->|game logic| H[Game Server]
    H -->|"POST /notifications/send"| G
    D -->|"opengame.org/open?url="| B
```

## App Bridge / WebView Integration

The app uses `@open-game-system/app-bridge-react-native` to create a two-way communication channel between the native app and web games loaded in the WebView.

```mermaid
sequenceDiagram
    participant WebGame as Web Game (WebView)
    participant Bridge as App Bridge
    participant Native as Native App
    participant Cast as Google Cast

    Native->>Bridge: createNativeBridge()
    Native->>Bridge: setStore("castKit", store)
    Bridge->>WebGame: Sync castKit state
    WebGame->>Bridge: dispatch SHOW_CAST_PICKER
    Bridge->>Native: on handler fires
    Native->>Cast: GoogleCast.showCastDialog()
    Cast-->>Native: Session events
    Native->>Bridge: dispatch SESSION_STARTED
    Bridge->>WebGame: Updated state
```

### CastKit Store

The `castKit` store is the only registered store. It tracks:

- `castState` -- Google Cast connection state (NOT_CONNECTED, CONNECTING, CONNECTED, NO_DEVICES_AVAILABLE)
- `devicesAvailable` -- whether cast-capable devices are on the network
- `sessionState` -- CONNECTED, DISCONNECTED, or CONNECTING

Events: `CAST_STATE_CHANGED`, `DEVICES_DISCOVERED`, `SESSION_STARTED`, `SESSION_ENDED`, `SESSION_RESUMED`, `SHOW_CAST_PICKER`

## Push Notification Flow

No auth-kit dependency for MVP. The OGS app IS the identity layer.

```mermaid
sequenceDiagram
    participant App as OGS App
    participant SecureStore as SecureStore
    participant OS as iOS/Android
    participant API as opengame-api
    participant GameServer as Game Server

    App->>SecureStore: getOrCreateDeviceId()
    SecureStore-->>App: ogsDeviceId (UUID)
    App->>OS: requestPermissions()
    OS-->>App: granted + Expo push token
    App->>API: POST /api/v1/devices/register {ogsDeviceId, platform, pushToken}
    API-->>App: 200 OK

    Note over App,OS: Token rotation
    OS->>App: pushTokenListener fires
    App->>API: POST /api/v1/devices/register (updated token)

    Note over GameServer,API: Sending notifications
    GameServer->>API: POST /api/v1/notifications/send {deviceId, title, body, data.url}
    API->>OS: Expo Push Service
    OS->>App: Notification delivered
    App->>App: getGameUrlFromNotification() -> setGameUrl()
```

### Key Details

- `ogsDeviceId` is a UUID persisted in `expo-secure-store` (survives app reinstalls on iOS)
- Push token is an Expo push token (not raw APNs/FCM)
- API base URL: `https://api.opengame.org`
- Android sets up a notification channel named "Default" with MAX importance
- Foreground notifications display alerts, play sound, show banner and list

## Deep Link Handling

Two entry paths into the app, both routed through Universal Links:

```mermaid
flowchart TD
    A["Universal Link: https://opengame.org/open?url=<encoded>"] --> B{App running?}
    B -->|Cold start| C[getInitialGameUrl]
    B -->|Warm start| D[addDeepLinkListener]

    E["Custom scheme: myapp://open?url=<encoded>"] --> B

    C --> F[extractGameUrl]
    D --> F
    F --> G[setGameUrl in store]
    G --> H[WebView navigates to URL]

    I["Notification tap with data.url"] --> J[getGameUrlFromNotification]
    J --> G
```

### URL Format

- Universal Link: `https://opengame.org/open?url=<encoded_game_url>`
- Custom scheme: `myapp://open?url=<encoded_game_url>`
- Both parse the `url` query parameter from the `/open` path

### Platform Configuration

- **iOS:** `associatedDomains: ["applinks:opengame.org"]` in app.json
- **Android:** Intent filter for `https://opengame.org/open` with `autoVerify: true`

## Game URL Store

A minimal observable store that decouples URL sources from the WebView consumer.

```mermaid
flowchart LR
    A[Deep Link cold start] -->|setGameUrl| S[game-url-store]
    B[Deep Link warm start] -->|setGameUrl| S
    C[Notification tap] -->|setGameUrl| S
    S -->|consumePendingGameUrl| D["Index screen (mount)"]
    S -->|subscribeToGameUrl| D
    D -->|setWebviewSource| E[BridgedWebView]
```

The store holds a `pendingUrl` and a list of listeners. On mount, the Index screen calls `consumePendingGameUrl()` (clears it), then `subscribeToGameUrl()` for subsequent changes.

## Module Dependency Graph

```mermaid
graph TD
    L["app/_layout.tsx"] -->|imports| N[services/notifications]
    L -->|imports| DL[services/deep-links]
    L -->|imports| GUS[services/game-url-store]

    I["app/index.tsx"] -->|imports| GUS
    I -->|imports| AB["@open-game-system/app-bridge-react-native"]
    I -->|imports| GC[react-native-google-cast]

    N -->|uses| EN[expo-notifications]
    N -->|uses| ES[expo-secure-store]
    N -->|uses| EC[expo-crypto]
    N -->|uses| ED[expo-device]

    DL -->|uses| EL[expo-linking]
```
