# @open-game-system/stream-kit-testing

Testing helpers for the current Stream Kit package layer.

## What This Package Is

This package provides:

- `createMockStreamClient()`
- broker event simulation helpers
- stream assertions

It is meant for testing code built against `@open-game-system/stream-kit-web` and `@open-game-system/stream-kit-react`.

## Installation

```bash
pnpm add -D @open-game-system/stream-kit-testing
```

## Mock client

```ts
import { createMockStreamClient } from "@open-game-system/stream-kit-testing";

const mockClient = createMockStreamClient();
const stream = mockClient.createRenderStream({
  url: "https://test.example/stream",
});
```

## Simulate broker events

```ts
import { simulateBrokerEvent } from "@open-game-system/stream-kit-testing";

simulateBrokerEvent(stream, {
  type: "peer_assigned",
  peerId: "render-node-1",
  connectionDetails: {
    iceServers: [{ urls: "stun:stun.example.com" }],
  },
});
```

## Assertions

```ts
import {
  assertStreamConnected,
  assertStreamDisconnected,
  waitForStreamState,
} from "@open-game-system/stream-kit-testing";

await waitForStreamState(stream, "connecting");
assertStreamConnected(stream);
```

## React usage

```tsx
import { StreamProvider } from "@open-game-system/stream-kit-react";
import { createMockStreamClient } from "@open-game-system/stream-kit-testing";

const mockClient = createMockStreamClient();
const stream = mockClient.createRenderStream({ url: "https://test.example/stream" });

<StreamProvider stream={stream}>
  <YourComponent />
</StreamProvider>;
```

## Notes

- These helpers mirror the current package layer, not the full Cloudflare example runtime.
- They are most useful when testing `RenderStream` consumers and React bindings.

## License

MIT
