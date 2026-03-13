# Plan: Refactor State Subscription to WebSockets for Cloudflare Workers

**Goal:** Modify the `@open-game-system/stream-kit-server` package to use WebSockets for real-time state change notifications to clients, replacing the current Server-Sent Events (SSE) implementation. This implementation will be tailored for the Cloudflare Workers runtime, using KV for state persistence and Workers/Durable Objects for WebSocket management.

**Key Decisions:**

1.  **WebSocket Only:** SSE will be completely removed.
2.  **Endpoint:** WebSocket upgrades will be handled on `GET /stream/:streamId` requests containing an `Upgrade: websocket` header.
3.  **No Generic Hooks Abstraction (Initially):** The `StreamKitHooks` abstraction will be removed. State persistence will directly use Cloudflare KV. WebSocket connection management will be handled within the Worker, with a recommendation for Durable Objects for scalability.
4.  **Cloudflare-Specific Implementation:** The router will be designed to work with Cloudflare Worker environment bindings (`env` object typically containing KV namespaces, and enabling WebSocket upgrades).

## Changes Required:

1.  **Update `src/types.ts` (or create new type definitions):
    *   Remove the `StreamKitHooks` interface.
    *   Define the structure for WebSocket messages if needed (e.g., `StateChange` for snapshots/patches, though sending full snapshots might be simpler initially).
    *   Define the expected structure of the environment object `TEnv` passed to the router, specifically that it should contain a KV namespace binding (e.g., `STATE_KV: KVNamespace`).

2.  **Refactor Router Logic (`src/router.ts`):
    *   **Remove SSE Logic:** All code related to `/sse` endpoints and `AsyncIterable<StateChange>` will be removed.
    *   **Cloudflare KV Integration:**
        *   Replace `hooks.loadStreamState` with `env.STATE_KV.get(streamId, "json")`.
        *   Replace `hooks.saveStreamState` with `env.STATE_KV.put(streamId, JSON.stringify(state))`.
        *   Replace `hooks.deleteStreamState` with `env.STATE_KV.delete(streamId)`.
    *   **WebSocket Connection Management (In-Worker for V1, DO recommended for V2):**
        *   An in-memory `Map<string, Set<WebSocket>>` (e.g., `streamSubscribers`) will be used to store active WebSocket connections per `streamId`. This is suitable for a single Worker instance or for routing to a Durable Object.
        *   **Upgrade Handling:** When a `GET /stream/:streamId` request with an `Upgrade: websocket` header is received:
            1.  Use Cloudflare's `WebSocketPair`: `const { 0: client, 1: server } = new WebSocketPair();`.
            2.  Call `server.accept()`.
            3.  Send the current full state (snapshot from KV) to the `server` WebSocket.
            4.  Store the `server` WebSocket in `streamSubscribers` for the given `streamId`.
            5.  Handle `server.onmessage`, `server.onclose`, `server.onerror`.
            6.  Return `new Response(null, { status: 101, webSocket: client });`.
    *   **Broadcasting State Changes:**
        *   After a successful `env.STATE_KV.put()` (from a `POST /stream/:streamId` request), iterate over `streamSubscribers.get(streamId)` and send the updated state (full snapshot) to each connected WebSocket.

3.  **Update Mocking and Tests (`src/mock-hooks.ts` will be removed, `src/router.test.ts` refactored):
    *   Remove `src/mock-hooks.ts`.
    *   `router.test.ts` will need to:
        *   Mock the Cloudflare KV namespace (`env.STATE_KV`).
        *   Mock the `WebSocketPair` and WebSocket server/client behavior for testing connection upgrades and message exchanges. Vitest or Jest provide ways to mock global objects or classes.
        *   Verify direct KV interactions.
        *   Test WebSocket upgrade, initial snapshot sending, and broadcast on state change.

4.  **API Documentation (`README.md`):
    *   Reflect the removal of SSE and the hook-based architecture.
    *   Specify that the server is designed for Cloudflare Workers.
    *   Detail the WebSocket endpoint (`GET /stream/:streamId` with `Upgrade` header).
    *   Document the direct dependency on a KV namespace in the Worker environment.
    *   Recommend Durable Objects for scalable WebSocket management.

## Detailed Implementation Steps & Code Examples (Illustrative for Cloudflare Workers):

### Step 1: Modify `src/types.ts`

```typescript
// src/types.ts

// Example: Define the type for messages sent over WebSocket
export interface WebSocketMessage {
  type: 'snapshot'; // Initially, only send full snapshots
  data: any; // The stream state
}

// Define the expected Cloudflare environment structure for the router
export interface StreamKitEnv {
  STATE_KV: KVNamespace; // KV namespace for storing stream states
  // Potentially a Durable Object binding for WebSocket handling in a scalable setup
  // STREAM_WEBSOCKET_DO?: DurableObjectNamespace;
}
```

### Step 2: Refactor `src/router.ts`

```typescript
// src/router.ts
import type { StreamKitEnv, WebSocketMessage } from "./types";

// This Map is instance-local. For multi-instance, use Durable Objects.
const streamSubscribers = new Map<string, Set<WebSocket>>();

export function createStreamKitRouter<TEnv extends StreamKitEnv>() {
  return async (request: Request, env: TEnv): Promise<Response> => {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (pathSegments.length < 2 || pathSegments[0] !== "stream") {
      return new Response("Not Found", { status: 404 });
    }
    const streamId = pathSegments[1];

    // Handle WebSocket Upgrade for GET /stream/:streamId
    if (request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      if (pathSegments.length !== 2) { // Ensure it's exactly /stream/:streamId
        return new Response("Invalid WebSocket path", { status: 400 });
      }

      const pair = new WebSocketPair();
      const clientWs = pair[0];
      const serverWs = pair[1];

      serverWs.accept();

      const subscribers = streamSubscribers.get(streamId) || new Set();
      subscribers.add(serverWs);
      streamSubscribers.set(streamId, subscribers);

      // Send initial state snapshot
      try {
        const initialState = await env.STATE_KV.get(streamId, "json");
        if (initialState) {
          const message: WebSocketMessage = { type: 'snapshot', data: initialState };
          serverWs.send(JSON.stringify(message));
        } else {
          // Optionally send an error or close if state must exist
          // serverWs.send(JSON.stringify({ type: 'error', data: 'Stream state not found' }));
        }
      } catch (e) {
        console.error(`Failed to send initial state for ${streamId}:`, e);
        // serverWs.close(1011, "Error fetching initial state"); // Optional: close with error
      }

      serverWs.addEventListener("message", event => {
        // Handle incoming messages from client (e.g., keep-alive, client-side commands)
        // console.log(`Received message from ${streamId}:`, event.data);
      });

      serverWs.addEventListener("close", () => {
        subscribers.delete(serverWs);
        if (subscribers.size === 0) {
          streamSubscribers.delete(streamId);
        }
        console.log(`WebSocket closed for stream ${streamId}`);
      });

      serverWs.addEventListener("error", err => {
        subscribers.delete(serverWs);
        if (subscribers.size === 0) {
          streamSubscribers.delete(streamId);
        }
        console.error(`WebSocket error for stream ${streamId}:`, err);
      });

      return new Response(null, { status: 101, webSocket: clientWs });
    }

    // RESTful API for state management
    try {
      switch (request.method) {
        case "GET": // Get current state (non-WebSocket)
          const state = await env.STATE_KV.get(streamId, "json");
          if (state === null) return new Response("Stream Not Found", { status: 404 });
          return new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } });

        case "POST":
          const body = await request.json();
          await env.STATE_KV.put(streamId, JSON.stringify(body));
          
          // Broadcast the new state to WebSocket subscribers
          const subscribers = streamSubscribers.get(streamId);
          if (subscribers) {
            const message: WebSocketMessage = { type: 'snapshot', data: body };
            const serializedMessage = JSON.stringify(message);
            subscribers.forEach(ws => {
              if (ws.readyState === WebSocket.OPEN) { // Check if WebSocket is open
                ws.send(serializedMessage);
              }
            });
          }
          return new Response("Stream state saved", { status: 200 });

        case "DELETE":
          await env.STATE_KV.delete(streamId);
          // Optionally notify subscribers of deletion, or just close connections
          const activeSubscribers = streamSubscribers.get(streamId);
          if (activeSubscribers) {
            activeSubscribers.forEach(ws => ws.close(1000, "Stream deleted"));
            streamSubscribers.delete(streamId);
          }
          return new Response("Stream deleted", { status: 200 });

        default:
          return new Response("Method Not Allowed", { status: 405 });
      }
    } catch (error) {
      console.error(`API Error for stream ${streamId}:`, error);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}
```

## Considerations for Scalability (Durable Objects):

While the above in-Worker `streamSubscribers` Map works for a single instance, it does not scale across multiple Cloudflare Worker instances. For a production system, each `streamId` should ideally be managed by a **Durable Object (DO)**.

*   **DO Responsibilities:**
    *   Store the state for its `streamId` (internally, could still use KV or its own storage API).
    *   Manage all WebSocket connections for its `streamId`.
    *   Handle broadcasts to its connected WebSockets when its state changes.
*   **Main Worker Router:**
    *   HTTP GET/POST/DELETE requests for `/stream/:streamId` would be routed to the `fetch` handler of the corresponding DO instance (e.g., `env.STREAM_WEBSOCKET_DO.get(DO_ID).fetch(request)`).
    *   WebSocket upgrade requests for `/stream/:streamId` would also be forwarded to the DO, which would then accept and manage the WebSocket session.

This DO-based architecture is the standard way to handle stateful WebSockets at scale on Cloudflare Workers. The initial implementation can start with the in-Worker map for simplicity, with a clear path to refactor towards Durable Objects for production readiness. 