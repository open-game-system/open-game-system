# @open-game-system/stream-kit-server

Server-side primitives for the Stream Kit package layer.

## What This Package Is

Today this package contains two things:

- `createStreamKitRouter()` for storage-backed stream state endpoints
- newer `StreamKitServer` exports that are still incomplete relative to the deployed example

The stable, tested piece here is the router.

## Installation

```bash
pnpm add @open-game-system/stream-kit-server @open-game-system/stream-kit-types
```

## `createStreamKitRouter()`

This helper builds a request handler around storage hooks you provide.

Supported routes:

- `GET /stream/:streamId`
- `GET /stream/:streamId/sse`
- `POST /stream/:streamId`
- `DELETE /stream/:streamId`

### Example

```ts
import { createStreamKitRouter } from "@open-game-system/stream-kit-server";

const router = createStreamKitRouter({
  hooks: {
    async saveStreamState({ streamId, state, env }) {
      await env.kv.put(streamId, JSON.stringify(state));
    },
    async loadStreamState({ streamId, env }) {
      const value = await env.kv.get(streamId);
      return value ? JSON.parse(value) : null;
    },
    async deleteStreamState({ streamId, env }) {
      await env.kv.delete(streamId);
    },
    async *subscribeToStateChanges() {
      // Yield snapshot/patch events here
    },
  },
});
```

## Notes

- This package is not what powers the working Cloudflare example under `examples/bun-stream-server/`.
- The exported `StreamKitServer` and `createStreamClient` server-side API are not yet the source of truth for deployed behavior.
- If you want the working end-to-end runtime, look at the example and the repo-level docs instead.

## Related Packages

- [`@open-game-system/stream-kit-types`](../stream-kit-types/README.md)
- [`@open-game-system/stream-kit-web`](../stream-kit-web/README.md)

## License

MIT
