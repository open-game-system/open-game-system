# @open-game-system/stream-kit-web

Low-level browser client primitives for the Stream Kit package layer.

## What This Package Is

This package exposes:

- `createStreamClient()`
- a broker-style `StreamClient`
- a `RenderStream` abstraction that owns a video element, stream state, and WebRTC setup

It is a low-level client package. It does not start Cloudflare containers by itself, and it is not yet the polished OGS app SDK described in the repo docs.

## Installation

```bash
pnpm add @open-game-system/stream-kit-web @open-game-system/stream-kit-types
```

## Current API

### `createStreamClient`

```ts
import { createStreamClient } from "@open-game-system/stream-kit-web";

const client = createStreamClient({
  brokerUrl: "https://api.example.com",
});
```

The returned client currently assumes a broker-style HTTP API with endpoints like:

- `POST /stream/session`
- `DELETE /stream/session/:id`
- `POST /stream/session/:id/input`
- `PATCH /stream/session/:id`

### `createRenderStream`

```ts
const stream = client.createRenderStream({
  url: "https://your-game.com/render/world",
  renderOptions: {
    resolution: "1080p",
    quality: "high",
  },
});
```

### State subscription

```ts
const unsubscribe = stream.subscribe((state) => {
  console.log(state.status);
});
```

### Mounting the video element

```ts
const video = stream.getVideoElement();
if (video) {
  document.getElementById("stream-root")?.appendChild(video);
}
```

### Cleanup

```ts
await stream.end();
stream.destroy();
```

## Notes

- The current implementation still reflects an older broker/signaling model.
- The working end-to-end Cloudflare runtime in `examples/bun-stream-server/` does not directly consume this package yet.
- Treat this package as low-level and experimental relative to the deployed example.

## Related Packages

- [`@open-game-system/stream-kit-types`](../stream-kit-types/README.md)
- [`@open-game-system/stream-kit-react`](../stream-kit-react/README.md)
- [`@open-game-system/stream-kit-testing`](../stream-kit-testing/README.md)

## License

MIT
