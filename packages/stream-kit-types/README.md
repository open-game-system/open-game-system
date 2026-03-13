# @open-game-system/stream-kit-types

Shared TypeScript types for the Stream Kit workspace.

## What This Package Is

This package holds the shared interfaces used across the current Stream Kit packages, including:

- render options
- stream session metadata
- client-side stream state
- input event payloads
- server-side stream session state

It is the lowest-level package in the workspace and contains no runtime behavior.

## Installation

```bash
pnpm add @open-game-system/stream-kit-types
```

## Main Types

### `RenderOptions`

```ts
interface RenderOptions {
  resolution?: "720p" | "1080p" | "1440p" | "4k" | string;
  targetFps?: number;
  quality?: "low" | "medium" | "high" | "ultra";
  priority?: "latency" | "quality";
  region?: string;
}
```

### `StreamState`

```ts
interface StreamState {
  status: "initializing" | "connecting" | "streaming" | "reconnecting" | "error" | "ended";
  latency?: number;
  resolution?: string;
  fps?: number;
  bitrate?: number;
  errorMessage?: string;
  errorCode?: string;
}
```

### `StreamSession`

```ts
interface StreamSession {
  sessionId: string;
  status: StreamState["status"];
  signalingUrl?: string;
  iceServers?: RTCIceServer[];
  estimatedStartTime?: number;
  region?: string;
  error?: string;
}
```

### `InputStreamEvent`

```ts
type InputStreamEvent =
  | { type: "interaction"; data: { action: string; position?: { x: number; y: number } } }
  | { type: "command"; data: { command: string; args?: any[] } };
```

## Usage

```ts
import type {
  RenderOptions,
  StreamSession,
  StreamState,
} from "@open-game-system/stream-kit-types";

function handleState(state: StreamState) {
  console.log(state.status);
}
```

## Notes

- These types reflect the current package layer, not the final OGS SDK surface.
- Some types still model the older broker-style API used by `stream-kit-web`.

## Related Packages

- [`@open-game-system/stream-kit-web`](../stream-kit-web/README.md)
- [`@open-game-system/stream-kit-react`](../stream-kit-react/README.md)
- [`@open-game-system/stream-kit-server`](../stream-kit-server/README.md)

## License

MIT
