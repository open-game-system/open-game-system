# @open-game-system/stream-kit-react

React bindings for an existing `RenderStream`.

## What This Package Is

This package does not create stream sessions on its own. It wraps a `RenderStream` instance from `@open-game-system/stream-kit-web` and gives you:

- `StreamProvider`
- `StreamCanvas`
- `createStreamStateContext()`
- `useStream()`

It is a UI binding layer around an already-created stream object.

## Installation

```bash
pnpm add @open-game-system/stream-kit-react @open-game-system/stream-kit-web @open-game-system/stream-kit-types
```

## Current API

### `StreamProvider`

`StreamProvider` expects a `stream` prop, not a client:

```tsx
import { StreamProvider } from "@open-game-system/stream-kit-react";

<StreamProvider stream={stream}>
  <App />
</StreamProvider>;
```

### `StreamCanvas`

`StreamCanvas` renders the underlying video element from the provided stream:

```tsx
import { StreamCanvas } from "@open-game-system/stream-kit-react";

function Player() {
  return <StreamCanvas className="stream-canvas" />;
}
```

### Full example

```tsx
import { createStreamClient } from "@open-game-system/stream-kit-web";
import { StreamCanvas, StreamProvider } from "@open-game-system/stream-kit-react";

const client = createStreamClient({
  brokerUrl: "https://api.example.com",
});

const stream = client.createRenderStream({
  url: "https://your-game.com/render/world",
});

function App() {
  return (
    <StreamProvider stream={stream}>
      <StreamCanvas />
    </StreamProvider>
  );
}
```

### Stream state helpers

`createStreamStateContext()` returns selector helpers and small state components such as:

- `Status`
- `When`
- `Stats`
- `Quality`
- `Match`
- `Overlay`

These are useful when you want to subscribe to only part of the stream state.

## Notes

- This package is intentionally narrow: it binds React to a `RenderStream`.
- It is not yet the future OGS product SDK shape described in `docs/integration.md`.
- The earlier README examples that passed `client` to `StreamProvider` were incorrect for the current code.

## Related Packages

- [`@open-game-system/stream-kit-web`](../stream-kit-web/README.md)
- [`@open-game-system/stream-kit-types`](../stream-kit-types/README.md)
- [`@open-game-system/stream-kit-testing`](../stream-kit-testing/README.md)

## License

MIT
