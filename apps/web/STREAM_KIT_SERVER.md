# @open-game-system/stream-kit-server

Server-side implementation for the Open Game System (OGS) Cloud Rendering service. This package provides a router/middleware for managing headless browser instances that render game URLs and facilitate streaming their output via WebRTC.

## 📚 Table of Contents

- [💾 Installation](#-installation)
- [🌟 Key Concepts](#-key-concepts)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Usage](#️-usage)
- [📖 API Reference](#-api-reference)
  - [`createStreamKitRouter(options)`](#createstreamkitrouteroptions)
- [🌐 Protocol Details (HTTP+SSE)](#-protocol-details-httpsse)
  - [Session Initiation](#session-initiation)
  - [State Synchronization (SSE)](#state-synchronization-sse)
  - [Authentication](#authentication)
- [📉 State Synchronization & Patching](#-state-synchronization--patching)
  - [Conceptual State Shape](#conceptual-state-shape)
- [⚙️ Configuration](#️-configuration)
- [📜 License](#-license)
- [🔗 Related Technologies](#-related-technologies)
- [🚧 Development Status](#-development-status)

## 💾 Installation

```bash
npm install @open-game-system/stream-kit-server puppeteer fast-json-patch
# or
yarn add @open-game-system/stream-kit-server puppeteer fast-json-patch
# or
pnpm add @open-game-system/stream-kit-server puppeteer fast-json-patch
```

**Note:** `puppeteer` and `fast-json-patch` are likely peer dependencies or will be managed internally. Ensure your environment supports running headless browsers.

## 🌟 Key Concepts

-   ☁️ **Cloud Rendering Instance Management**: Manages the lifecycle (launch, control, termination) of headless browser instances rendering specific game URLs.
-   🚀 **WebRTC Facilitation**: Sets up the necessary server-side components to enable direct WebRTC streaming from the browser instance to the client. (Signaling details TBD, may leverage SSE initially).
-   📊 **Real-time State Sync**: Uses HTTP Server-Sent Events (SSE) to push state updates efficiently to connected clients.
-   ⚡ **Efficient State Patching**: Leverages `fast-json-patch` to send only the differences (patches) in state, minimizing bandwidth usage.
-   🌐 **Stateless-Capable Transport**: The HTTP+SSE approach allows for potentially stateless server deployments, similar to MCP's Streamable HTTP transport.
-   🎭 **Framework Agnostic Router**: Provides `createStreamKitRouter` which can be integrated into various Node.js frameworks (Express, Hono, Koa, etc.).
-   🔒 **Session Management**: Handles unique stream sessions, identified by IDs.

## 🏗️ Architecture

```mermaid
graph TD
    subgraph "Client Browser"
        A[Client Application<br>using stream-kit-react/web]
    end

    subgraph "Your HTTP Server (Node.js, etc.)"
        B[HTTP Server (Express/Hono/etc.)]
        C[Stream Kit Router<br>API: createStreamKitRouter]
    end

    subgraph "Stream Kit Server Logic"
        D[Session Manager]
        E[Render Instance Controller]
        subgraph "Cloud Rendering Instance"
            F[Headless Browser (Puppeteer)]
            G[Target Game URL Loaded]
            H[WebRTC Stream Source]
        end
        I[State Store & Patcher]
    end

    J[WebRTC Connection]

    A -- HTTP POST /stream --> B
    A -- HTTP GET /stream/{id}/sse --> B
    B -- Use --> C
    C -- Manages --> D
    D -- Controls --> E
    E -- Launches/Controls --> F
    F -- Loads --> G
    F -- Provides --> H
    C -- Updates/Reads --> I
    I -- Generates Patches --> C
    C -- SSE stream --> A

    H -. WebRTC Stream .-> A

    classDef client fill:#f0f0f0,stroke:#333,stroke-width:2px;
    classDef server fill:#e6f2ff,stroke:#333,stroke-width:2px;
    classDef streamkit fill:#ffe6e6,stroke:#333,stroke-width:2px;
    classDef instance fill:#ffcccc,stroke:#333,stroke-width:2px;
    classDef webrtc fill:#ccffcc,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5;

    class A client;
    class B,C server;
    class D,E,I streamkit;
    class F,G,H instance;
    class J webrtc;

```

1.  The client initiates a stream session via a `POST` request.
2.  The `StreamKitRouter` handles the request, creates a session ID, and instructs the `RenderInstanceController` to launch a headless browser instance loading the target URL.
3.  The client connects to the `GET /sse` endpoint for that session ID.
4.  The router, via the `State Store & Patcher`, sends the initial state and subsequent state patches over the SSE connection.
5.  Signaling for WebRTC occurs (details TBD, potentially via SSE messages initially or dedicated mechanism).
6.  A direct WebRTC connection is established between the client and the cloud rendering instance for video/audio streaming.

## 🛠️ Usage

Integrate `createStreamKitRouter` into your preferred Node.js HTTP framework.

```typescript
// Example using Express.js
import express from 'express';
import { createStreamKitRouter } from '@open-game-system/stream-kit-server';
import http from 'http'; // Needed for SSE

// Define environment/context if needed by custom options
interface AppEnv {
  PUPPETEER_EXECUTABLE_PATH?: string;
  // Add other env variables or services needed
}

const env: AppEnv = {
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
};

const app = express();
const server = http.createServer(app); // Use http server for SSE compatibility
const port = process.env.PORT || 3001;

// Create the Stream Kit Router
const streamKitRouter = createStreamKitRouter<AppEnv>({
  // --- Configuration Options (See API Reference) ---
  // Example: Pass environment/context to custom hooks
  getEnv: () => env,
  // Example: Override Puppeteer launch options
  // puppeteerLaunchOptions: {
  //   executablePath: env.PUPPETEER_EXECUTABLE_PATH,
  //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
  // },
  // Example: Add custom authentication/validation logic
  // validateRequest: async (req) => {
  //   const authToken = req.headers.authorization?.split(' ')[1];
  //   if (!authToken || !(await verifyToken(authToken))) {
  //     return { authorized: false, error: 'Unauthorized', status: 401 };
  //   }
  //   const decoded = await decodeToken(authToken);
  //   return {
  //      authorized: true,
  //      // Pass caller context to be used in state/logic
  //      callerContext: { userId: decoded.sub, role: decoded.role }
  //   };
  // }
});

// Use the router as middleware for paths starting with /stream
// The router internally handles POST /stream and GET /stream/:streamId/sse
app.use('/stream', streamKitRouter);

// Optional: Add other API routes or frontend serving
app.get('/', (req, res) => {
  res.send('Stream Kit Server is running!');
});

server.listen(port, () => {
  console.log(`Stream Kit Server listening on http://localhost:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Add cleanup for active browser instances if necessary
  });
});
```

## 📖 API Reference

### `createStreamKitRouter(options?)`

Creates a request handler function (middleware) compatible with common Node.js frameworks (e.g., Express, Hono, Koa) to manage stream sessions.

**Type Parameters:**

-   `TEnv`: An optional type parameter representing your application's environment or context, accessible within hooks like `validateRequest`.

**Parameters:**

-   `options` (Optional): An object containing configuration options:
    -   `basePath` (string): The base path for the stream routes. Defaults to `/`. If your middleware is mounted at `/stream`, keep this as `/`.
    -   `puppeteerLaunchOptions` (object): Options passed directly to `puppeteer.launch()`. See [Puppeteer documentation](https://pptr.dev/api/puppeteer.launchoptions).
    -   `defaultViewport` (object): Default viewport settings for new browser pages (`{ width: number, height: number }`). Defaults to `{ width: 1920, height: 1080 }`.
    -   `getEnv?`: `() => TEnv | Promise<TEnv>`: A function that returns the application environment/context, useful for custom hooks.
    -   `validateRequest?`: `(req: Request) => Promise<{ authorized: boolean; error?: string; status?: number; callerContext?: Record<string, any> }>`: An async function to validate incoming requests (e.g., check `Authorization` headers). Must return `{ authorized: true }` for the request to proceed. Can optionally return `callerContext` which might be used in state management or logging. If unauthorized, return `{ authorized: false, error: 'Reason', status: 4xx }`.
    -   `stateUpdateInterval?` (number): Interval in milliseconds for sending state patches over SSE. Defaults to `100`.
    -   `sessionTimeout?` (number): Inactivity timeout in milliseconds for a session (browser instance) before it's cleaned up. Defaults to `300000` (5 minutes).
    -   `onError?`: `(error: Error, streamId?: string) => void`: Callback for logging or handling errors during request processing or instance management.

**Returns:**

-   A request handler function `(req: Request, res: Response, next?: NextFunction) => Promise<void> | void`. This function:
    -   Matches incoming requests against `POST {basePath}` and `GET {basePath}:streamId/sse`.
    -   Handles session creation, validation, and state synchronization via SSE.
    -   Manages the lifecycle of headless browser instances.

## 🌐 Protocol Details (HTTP+SSE)

The server uses a combination of standard HTTP methods and Server-Sent Events (SSE) for communication, inspired by MCP's Streamable HTTP transport.

### Session Initiation

-   **Request:** `POST /stream`
    -   **Headers:** May include `Authorization: Bearer <token>`, `Content-Type: application/json`.
    -   **Body:** JSON object containing details needed to start the stream, e.g.:
        ```json
        {
          "targetUrl": "https://your-game.com/render/scene?params=...",
          "initialData": { "userId": "user-123" }, // Optional data for the instance
          "renderOptions": { // Optional preferences
            "resolution": "1920x1080"
          }
        }
        ```
-   **Response:** `200 OK` (or `201 Created`)
    -   **Headers:** `Content-Type: application/json`.
    -   **Body:** JSON object containing the session ID and potentially the initial state:
        ```json
        {
          "streamId": "uuid-generated-by-server",
          "initialState": { /* Initial state snapshot, see below */ }
        }
        ```
    -   *Alternative:* The server *could* immediately respond with `Content-Type: text/event-stream` and start sending the initial state and subsequent patches over SSE, eliminating the need for the client to make a separate `GET /sse` call immediately. TBD based on implementation needs (e.g., signaling).

### State Synchronization (SSE)

-   **Request:** `GET /stream/{streamId}/sse`
    -   **Headers:** Must include `Accept: text/event-stream`. May include `Authorization: Bearer <token>`.
-   **Response:**
    -   **Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
    -   **Body:** A stream of Server-Sent Events. Each event sends a JSON patch operation (or an array of operations) according to RFC 6902.
        ```sse
        event: state_patch
        data: [{"op": "replace", "path": "/status", "value": "streaming"}]

        event: state_patch
        data: [{"op": "add", "path": "/metadata/latency", "value": 75}]

        event: custom_signal # Example for potential WebRTC signaling
        data: {"type": "sdp_offer", "payload": "..."}
        ```
    -   The server periodically checks for state changes in the associated render instance, calculates patches using `fast-json-patch`, and sends them as `state_patch` events.
    -   Other event types (like `custom_signal`) might be used for auxiliary purposes like WebRTC signaling initiation.

### Authentication

-   Authentication should be handled via standard HTTP mechanisms, typically `Authorization: Bearer <token>` headers.
-   The `validateRequest` option in `createStreamKitRouter` provides a hook to implement custom token validation logic.
-   The token should be sent with both the initial `POST /stream` request and the `GET /stream/{streamId}/sse` request.

## 📉 State Synchronization & Patching

Instead of sending full state snapshots repeatedly, the server uses `fast-json-patch` to calculate the difference between the previous state and the current state of the render instance session. These differences (patches) are sent over the SSE connection.

The client (`stream-kit-react` / `stream-kit-web`) receives these patches and applies them sequentially to its local state copy, ensuring efficient synchronization.

### Conceptual State Shape

The server maintains a state object for each active stream session. This state is periodically snapshotted, compared, and patches are generated. A conceptual shape might look like this:

```typescript
interface StreamSessionState {
  streamId: string;
  status: 'initializing' | 'connecting' | 'streaming' | 'error' | 'terminated';
  targetUrl: string;
  clientConnected: boolean; // Is there an active SSE connection?
  instanceInfo?: { // Info about the browser instance
    pid?: number;
    startTime: number;
    viewport: { width: number; height: number };
  };
  webrtc?: { // State related to WebRTC setup
    signalingState: 'idle' | 'negotiating' | 'connected';
    iceCandidatesGathered?: boolean;
    // Other relevant WebRTC state needed by client
  };
  metadata?: Record<string, any>; // Any other dynamic metadata
  error?: string; // Last error message
  lastActivityTime: number;
}
```

This state object is the source from which patches are generated and sent via the `state_patch` SSE event.

## ⚙️ Configuration

The `createStreamKitRouter` function accepts an `options` object to customize its behavior:

-   **Browser:** Use `puppeteerLaunchOptions` and `defaultViewport` to control the headless browser instances.
-   **Security:** Implement `validateRequest` to secure your endpoints.
-   **Performance:** Adjust `stateUpdateInterval` and `sessionTimeout` based on your needs.
-   **Environment:** Use `getEnv` to provide context to custom hooks.
-   **Error Handling:** Use `onError` for logging or custom error reporting.

## 📜 License

MIT License.

## 🔗 Related Technologies

-   [Puppeteer](https://pptr.dev/): Headless Chrome/Chromium automation.
-   [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events): Technology for pushing updates from server to client.
-   [fast-json-patch (RFC 6902)](https://www.npmjs.com/package/fast-json-patch): Efficiently calculate and apply state differences.
-   [WebRTC](https://webrtc.org/): Real-time communication for audio/video streaming.
-   [MCP Streamable HTTP](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/206): Inspiration for the stateless-capable HTTP+SSE transport design.

## 🚧 Development Status

This package is currently under development. The API and protocol details are subject to change. Not yet recommended for production use.