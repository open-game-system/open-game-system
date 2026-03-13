# Stream Kit Cloudflare Example

This example is the current source of truth for end-to-end Stream Kit behavior.

It demonstrates:

- a Cloudflare Worker control plane
- a Durable Object per stream session
- a Cloudflare Container running Chromium
- a Chrome extension that captures the rendered tab
- a browser receiver that plays the returned WebRTC media

The deployed path now works with Cloudflare TURN-backed connectivity.

## Quick Start

### Local receiver + local container

```bash
cd examples/bun-stream-server/container
bun install
bun run src/server.ts
```

Then open [`receiver.html`](./receiver.html) and point it at `http://localhost:8080`.

### Cloudflare deploy

```bash
cd examples/bun-stream-server
npx wrangler deploy
```

Required Worker secrets:

- `CLOUDFLARE_TURN_API_TOKEN`
- `CLOUDFLARE_TURN_KEY_ID`
- optional `DEBUG_STATE_TOKEN`

## Main Endpoints

- `GET /health`
- `GET /ice-servers`
- `POST /start-stream`
- `GET /debug-state` when authorized

## Current Notes

- The Worker uses `x-stream-session-id` to isolate sessions.
- TURN credentials are short-lived and currently minted for the receiver on demand.
- The receiver is still a debugging/demo page, not yet the final OGS SDK surface.

## Product Direction

This example proves the runtime. The intended OGS product should eventually hide this infrastructure behind:

- OGS-owned APIs
- a simpler `stream-kit` SDK
- `opengame-app` integration through `app-bridge`
