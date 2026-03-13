# @open-game-system/stream-kit-react

React bindings for the Open Game System (OGS) Cloud Rendering service (`stream-kit`).

This package provides React Context, components, and hooks to simplify integrating cloud-rendered streams managed by `@open-game-system/stream-kit-web` into your React application.

## Overview

The `stream-kit` is a JavaScript/TypeScript library designed to simplify the process of requesting and displaying cloud-rendered game streams within your web application. It handles the communication with the OGS Platform/Broker API and the complexities of setting up and managing the WebRTC connection required for streaming.

**Benefits:**

*   **High-Fidelity Graphics:** Deliver visually rich experiences to users regardless of their device's GPU capabilities.
*   **Simplified Integration:** Abstracts away the complexities of WebRTC negotiation and cloud resource management.
*   **Web-First:** Allows you to enhance existing web games with optional cloud rendering for specific scenes or game modes.

**Target Use Case:** Ideal for turn-based games, strategy games, visual novels, or other experiences where peak visual quality is desired and minor latency introduced by streaming is acceptable. Typical end-to-end latency ranges from **55ms to 200ms**, depending on network conditions and geographic distance to the rendering server.

## How it Works

1.  **Initialization:** Your game initializes `stream-kit`.
2.  **Request Stream:** When needed (e.g., user clicks "Start High-Fidelity Mode"), your game calls `streamClient.requestStream()`, providing the URL of the game scene/version to be rendered in the cloud and a target HTML element where the video stream should be displayed.
3.  **OGS Orchestration:** The kit communicates with the OGS Platform API. The platform authenticates the request, provisions a secure cloud rendering instance (with GPU), and instructs it to load your game URL.
4.  **WebRTC Connection:** The kit handles the WebRTC signaling (brokered by the OGS Platform) to establish a direct peer-to-peer connection between the client and the cloud rendering instance.
5.  **Stream Display:** Once connected, the kit receives the video/audio stream and injects it into the target HTML element you specified.
6.  **State Management:** The kit provides updates on the stream's status (connecting, connected, disconnected, error) via a subscription mechanism.
7.  **Termination:** Your game can call `streamClient.endStream()` to terminate the session, or it may end due to inactivity/errors. The kit informs the OGS Platform to release the cloud resources.

## Installation

```bash
npm install @open-game-system/stream-kit-react @open-game-system/stream-kit-web
# or
pnpm add @open-game-system/stream-kit-react @open-game-system/stream-kit-web
# or
yarn add @open-game-system/stream-kit-react @open-game-system/stream-kit-web
```

## Usage (React Example - Context Pattern)

This example demonstrates the declarative, context-based pattern for integrating `stream-kit` with React. 

```jsx
import React from 'react';
// Import React-specific utilities from the react package
import { createStreamContext } from '@open-game-system/stream-kit-react';
// Import the core stream factory from the web/core package
import { createRenderStream } from '@open-game-system/stream-kit-web'; 

// 1. Create a context object using the React package utility
const StreamContext = createStreamContext();

// 2. Define stream instances using the core package factory
// These instances manage connection state and are framework-agnostic
const worldStream = createRenderStream({
  url: 'https://your-game.com/render/world-view',
  // Optional: initial data, render options etc.
  // initialData: { userToken: '...' }
});

const mapStream = createRenderStream({
  url: 'https://your-game.com/render/map-view',
});

// 3. Create components that use the context provider and consumers
const WorldCloudRenderScene = () => (
  <StreamContext.Provider stream={worldStream}>
    <div style={{ position: 'relative', width: '100%', height: '480px', background: '#111' }}>
      {/* Canvas renders the video stream */}
      <StreamContext.Canvas className="w-full h-full" />

      {/* Show loading indicator while connecting */}
      <StreamContext.Connecting>
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
          Connecting World View...
        </div>
      </StreamContext.Connecting>

      {/* Show error message if connection fails */}
      <StreamContext.Error>
        {(error) => (
          <div className="absolute inset-0 flex items-center justify-center bg-red-800 text-white">
            Error loading World View: {error.message}
          </div>
        )}
      </StreamContext.Error>
      
      {/* Other state components like StreamContext.Streaming, StreamContext.Ended etc. could exist */}
      {/* <StreamContext.Streaming>...</StreamContext.Streaming> */}
    </div>
  </StreamContext.Provider>
);

const MapCloudRenderScene = () => (
  <StreamContext.Provider stream={mapStream}>
    <div style={{ position: 'relative', width: '100%', height: '480px', background: '#111' }}>
      <StreamContext.Canvas className="w-full h-full" />
      <StreamContext.Connecting>
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
          Connecting Map View...
        </div>
      </StreamContext.Connecting>
      <StreamContext.Error>
        {(error) => (
          <div className="absolute inset-0 flex items-center justify-center bg-red-800 text-white">
            Error loading Map View: {error.message}
          </div>
        )}
      </StreamContext.Error>
    </div>
  </StreamContext.Provider>
);

// Example of switching between scenes
function GameWithMultipleViews() {
  const [activeView, setActiveView] = React.useState('world');
  
  return (
    <div>
      <div className="controls">
        <button onClick={() => setActiveView('world')} disabled={activeView === 'world'}>Show World</button>
        <button onClick={() => setActiveView('map')} disabled={activeView === 'map'}>Show Map</button>
      </div>
      
      {activeView === 'world' && <WorldCloudRenderScene />}
      {activeView === 'map' && <MapCloudRenderScene />}
    </div>
  );
}

export default GameWithMultipleViews;
```

**Explanation:**

1.  `createStreamContext()`: Returns an object containing the necessary Context components (`Provider`, `Canvas`, `Connecting`, `Error`, etc.).
2.  `createRenderStream({ url, ... })`: Creates an object that manages the lifecycle and state for a specific stream session. This instance is passed to the `Provider`.
3.  `<StreamContext.Provider stream={myStreamInstance}>`: Makes the `myStreamInstance` and its state available to consumer components within its subtree.
4.  `<StreamContext.Canvas />`: Renders the `<video>` tag associated with the stream from the context.
5.  `<StreamContext.Connecting>`, `<StreamContext.Error>`, etc.: These components subscribe to the stream state from the context and render their children only when the stream is in the corresponding state (e.g., `Connecting` renders only when `stream.state.status === 'connecting'`). The `Error` component might receive the error object as a render prop.

This pattern allows for clean separation and declarative UI composition based on stream states.

## API (Context Pattern)

This API describes the components and functions provided by **`@open-game-system/stream-kit-react`** and its core dependency **`@open-game-system/stream-kit-web`**.

### Core (`@open-game-system/stream-kit-web`)

*   **`createStreamClient(options?)`**: (Low-level) Factory function to create the core stream client instance for direct API interaction.
*   **`createRenderStream({ url, initialData?, renderOptions? })`**: Factory function to create a framework-agnostic stream management instance for a specific render target. This instance holds the state and likely uses `createStreamClient` internally.

### React Bindings (`@open-game-system/stream-kit-react`)

*   **`createStreamContext()`**: Factory function that returns a context object:
    *   `StreamContext.Provider`: React component to provide a `createRenderStream` instance down the component tree.
    *   `StreamContext.Canvas`: React component that renders the video for the stream in context.
    *   `StreamContext.Connecting`: Renders children only when the stream state is `connecting`.
    *   `StreamContext.Streaming`: Renders children only when the stream state is `streaming`.
    *   `StreamContext.Ended`: Renders children only when the stream state is `ended`.
    *   `StreamContext.Error`: Renders children only when the stream state is `error`. Can use a render prop `children={(error) => ...}` to pass the error details.
*   `useStream()`: (Hook) Hook to access the current `createRenderStream` instance and its state from the context.

## Requirements

*   Requires `@open-game-system/stream-kit-web` as a dependency.
*   The game client must be running in an environment supported by the OGS App or a browser with WebRTC capabilities.

## Status

This document outlines the API and architecture for the **`@open-game-system/stream-kit-react`** package.

## Contributing

See the main [Open Game System contribution guidelines](link-tbd).

## License

MIT License. See the LICENSE file in the root of the Open Game System project.

## Contact

- Website: [https://opengame.org](https://opengame.org)
- Email: [hello@opengame.org](mailto:hello@opengame.org) 