# Stream Kit API Specification Updates

## Overview of Changes

This document outlines the proposed changes to the Open Game System (OGS) Specification to enhance the Cloud Rendering Protocol section and provide more detailed documentation for the Stream Kit API, which has been highlighted in the updated homepage.

## Cloud Rendering Protocol Updates

### 1. Enhanced Protocol Description

Replace the current Cloud Rendering Protocol introduction with:

```markdown
### Cloud Rendering Protocol

The Cloud Rendering Protocol enables games to offload intensive graphics rendering to powerful cloud servers and stream the output via WebRTC to the client. Unlike other cloud gaming solutions that require streaming the entire game, OGS Stream Kit allows selective cloud rendering of specific graphics-intensive components while maintaining local rendering for UI elements, creating a hybrid rendering approach ideal for web games.

This protocol is especially valuable for:
- Turn-based games requiring high-fidelity 3D graphics
- Games that need to support low-powered devices without compromising visual quality
- Experiences where consistent visual quality across all devices is important
- Games with graphically complex scenes that would benefit from powerful GPU rendering
```

### 2. Stream Kit Architecture

Add a new section detailing the Stream Kit architecture:

```markdown
#### Stream Kit Architecture

The Stream Kit is built on a component-based architecture that allows developers to integrate cloud rendering selectively within their existing web games:

1. **StreamCanvas Component**: A client-side component that displays cloud-rendered content within your web UI
2. **Render Routes**: Standalone web pages optimized for cloud rendering that contain only the graphics-intensive elements
3. **Stream Session Management**: Handles negotiation between client and cloud rendering service
4. **WebRTC Pipeline**: Delivers low-latency video and audio streams from cloud to client

This architecture allows developers to:
- Render only specific components in the cloud rather than the entire application
- Compose multiple StreamCanvas instances in a single UI
- Maintain responsive local UI elements while offloading graphically intensive rendering
- Seamlessly switch between cloud and local rendering based on device capabilities

```

### 3. Implementation Strategy 

Add a section on implementation strategy:

```markdown
#### Implementation Strategy

Stream Kit is designed for progressive enhancement of web games:

1. **Standalone Route Creation**: Create dedicated routes in your web application that render only the graphics-intensive elements (3D scenes, complex visualizations, etc.)
2. **Component Integration**: Integrate the StreamCanvas component from stream-kit into your main UI where these elements should appear
3. **Conditional Rendering**: Implement logic to conditionally use cloud rendering based on device capabilities, user preferences, or specific high-fidelity needs
4. **Composition**: Combine multiple StreamCanvas instances to create rich, interactive experiences with different cloud-rendered views

This approach maintains your game's web-first nature while enhancing it with powerful cloud rendering capabilities.
```

### 4. Updated HTTP/WebRTC Sequence

Replace the current HTTP/WebRTC sequence diagram with:

```markdown
#### HTTP/WebRTC Sequence for Cloud Rendering

```mermaid
sequenceDiagram
    participant Client as Game Client (w/ stream-kit)
    participant OGSPlatform as OGS Platform/Broker
    participant Renderer as Cloud Rendering Instance
    
    Client->>OGSPlatform: 1. Initialize StreamCanvas (renderUrl, options)
    OGSPlatform->>OGSPlatform: 2. Authenticate & Provision Renderer
    OGSPlatform->>Renderer: 3. Load Render Route URL
    Renderer->>Renderer: 4. Start Rendering & Prepare Stream
    OGSPlatform->>Client: 5. Return Session Info & Signaling Data
    Client->>OGSPlatform: 6. Complete WebRTC Negotiation
    OGSPlatform->>Renderer: 7. Forward Negotiation Data
    Renderer->>Client: 8. Establish Direct WebRTC Connection
    Renderer-->>Client: 9. Stream Video/Audio via WebRTC
    Note over Client: StreamCanvas displays video
    Client->>Client: 10. Handle User Interaction Locally
    Client->>OGSPlatform: 11. Send Input Events (Optional)
    OGSPlatform->>Renderer: 12. Forward Input Events
    Client->>OGSPlatform: 13. Request End Session (When Done)
    OGSPlatform->>Renderer: 14. Terminate Instance
```
```

### 5. Enhanced API Details

Replace the current API endpoints with more detailed information:

```markdown
#### Stream Kit API Reference

##### StreamCanvas Component Properties

The `StreamCanvas` component is the primary interface for integrating cloud rendering:

```typescript
interface StreamCanvasProps {
  // URL of the standalone render route to be cloud-rendered
  url: string;
  
  // Styling options for the canvas
  className?: string;
  style?: React.CSSProperties;
  
  // Rendering preferences
  renderOptions?: {
    resolution?: "720p" | "1080p" | "1440p" | "4k" | string;
    targetFps?: number;
    quality?: "low" | "medium" | "high" | "ultra";
    priority?: "latency" | "quality";
    region?: string; // Preferred cloud region for reduced latency
  };
  
  // Initial data to pass to the render route
  initialData?: Record<string, any>;
  
  // Callbacks
  onReady?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: StreamState) => void;
  
  // Input handling
  handleInputLocally?: boolean; // Whether to handle input events locally
  forwardInput?: boolean; // Whether to forward input events to cloud
}

interface StreamState {
  status: "initializing" | "connecting" | "streaming" | "reconnecting" | "error" | "ended";
  latency?: number; // Estimated round-trip latency in ms
  resolution?: string; // Actual streaming resolution
  fps?: number; // Current frames per second
  errorMessage?: string;
}
```

##### Request Stream Session (Client SDK → OGS Platform)

```http
POST /api/v1/stream/session HTTP/1.1
Host: api.opengame.org 
Content-Type: application/json
Authorization: Bearer OGS_SESSION_TOKEN_OR_GAME_API_KEY 

{
  "renderUrl": "https://yourgame.com/path-to-render",
  "clientId": "unique-client-identifier",
  "renderOptions": {
    "resolution": "1920x1080",
    "targetFps": 60,
    "quality": "high",
    "priority": "latency",
    "region": "us-central1"
  },
  "initialData": {
    "sceneId": "world-map-01",
    "userToken": "user-auth-token",
    "viewParameters": {
      "camera": { "x": 0, "y": 10, "z": -5 },
      "target": { "x": 0, "y": 0, "z": 0 }
    }
  },
  "webRtcConfig": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ],
    "sdpSemantics": "unified-plan"
  }
}
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "sessionId": "stream-session-xyz789",
  "status": "initializing",
  "rendererId": "renderer-abc123",
  "signalingUrl": "wss://signaling.opengame.org/stream/xyz789",
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { 
      "urls": "turn:turn.opengame.org:3478", 
      "username": "username", 
      "credential": "password" 
    }
  ],
  "estimatedStartTime": 500, // ms until stream should begin
  "region": "us-central1"
}
```

##### Send Input to Cloud Renderer (Client SDK → OGS Platform)

```http
POST /api/v1/stream/session/{sessionId}/input HTTP/1.1
Host: api.opengame.org
Content-Type: application/json
Authorization: Bearer OGS_SESSION_TOKEN_OR_GAME_API_KEY 

{
  "type": "interaction",
  "timestamp": 1627845292123,
  "data": {
    "action": "select",
    "position": { "x": 250, "y": 300 },
    "entityId": "character-5",
    "additionalData": {
      "pressure": 0.8
    }
  }
}
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "received": true,
  "timestamp": 1627845292150,
  "latency": 27 // ms between client timestamp and server receipt
}
```

##### Update Stream Parameters (Client SDK → OGS Platform)

```http
PATCH /api/v1/stream/session/{sessionId} HTTP/1.1
Host: api.opengame.org
Content-Type: application/json
Authorization: Bearer OGS_SESSION_TOKEN_OR_GAME_API_KEY 

{
  "renderOptions": {
    "resolution": "1280x720", // Downgrade resolution if network conditions change
    "targetFps": 30
  },
  "sceneData": {
    "viewParameters": {
      "camera": { "x": 10, "y": 15, "z": -8 },
      "target": { "x": 5, "y": 0, "z": 2 }
    }
  }
}
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "accepted": true,
  "applied": {
    "resolution": "1280x720",
    "targetFps": 30
  },
  "effective": {
    "actualFps": 32,
    "actualBitrate": 2500000 // bits per second
  }
}
```

##### End Stream Session (Client SDK → OGS Platform)

```http
DELETE /api/v1/stream/session/{sessionId} HTTP/1.1
Host: api.opengame.org
Authorization: Bearer OGS_SESSION_TOKEN_OR_GAME_API_KEY 
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "terminated",
  "sessionId": "stream-session-xyz789",
  "usage": {
    "duration": 1200, // seconds
    "dataTransferred": 450000000, // bytes
    "renderUnitTime": 20 // minutes of GPU time used
  }
}
```
```

### 6. Usage Examples

Add a section with concrete examples:

```markdown
### Stream Kit Integration Examples

#### Basic Integration (React)

```jsx
import { StreamCanvas } from '@open-game-system/stream-kit';

function GameView() {
  return (
    <div className="game-container">
      <header className="game-hud">
        {/* Locally rendered UI elements */}
        <div className="score">Score: 1250</div>
        <div className="health-bar">Health: 85%</div>
      </header>
      
      <main className="game-view">
        {/* Cloud-rendered 3D scene */}
        <StreamCanvas 
          url="https://yourgame.com/render/world-scene"
          className="w-full h-full"
          renderOptions={{
            resolution: "1080p",
            quality: "high"
          }}
          onStateChange={(state) => console.log("Stream state:", state)}
        />
      </main>
      
      <footer className="game-controls">
        {/* Locally rendered control UI */}
        <button>Inventory</button>
        <button>Map</button>
      </footer>
    </div>
  );
}
```

#### Multiple View Integration

```jsx
import { StreamCanvas } from '@open-game-system/stream-kit';
import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

function GameWithMultipleViews() {
  const [activeView, setActiveView] = useState('world');
  
  return (
    <div className="game-container">
      <Tabs.Root value={activeView} onValueChange={setActiveView}>
        <Tabs.List className="view-selector">
          <Tabs.Trigger value="world">World</Tabs.Trigger>
          <Tabs.Trigger value="map">Map</Tabs.Trigger>
          <Tabs.Trigger value="character">Character</Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="world" className="view-content">
          <StreamCanvas 
            url="https://yourgame.com/render/world-view"
            className="w-full h-full"
          />
        </Tabs.Content>
        
        <Tabs.Content value="map" className="view-content">
          <StreamCanvas 
            url="https://yourgame.com/render/map-view"
            className="w-full h-full"
          />
        </Tabs.Content>
        
        <Tabs.Content value="character" className="view-content">
          <StreamCanvas 
            url="https://yourgame.com/render/character-view"
            className="w-full h-full"
          />
        </Tabs.Content>
      </Tabs.Root>
      
      <div className="game-controls">
        {/* Common controls that work across all views */}
        <button>Inventory</button>
        <button>Menu</button>
      </div>
    </div>
  );
}
```

#### Conditional Cloud Rendering

```jsx
import { StreamCanvas } from '@open-game-system/stream-kit';
import { useEffect, useState } from 'react';
import { LocalRenderer } from './components/LocalRenderer';
import { detectDeviceCapabilities } from './utils/deviceDetection';

function AdaptiveGameView() {
  const [useCloudRendering, setUseCloudRendering] = useState(false);
  
  useEffect(() => {
    // Detect if the device would benefit from cloud rendering
    const deviceCapabilities = detectDeviceCapabilities();
    
    setUseCloudRendering(
      deviceCapabilities.gpuTier < 2 || // Low-end GPU
      deviceCapabilities.isMobile ||    // Mobile device
      deviceCapabilities.preferCloudRendering // User preference
    );
  }, []);
  
  return (
    <div className="game-scene">
      {useCloudRendering ? (
        <StreamCanvas 
          url="https://yourgame.com/render/high-quality-scene"
          className="w-full h-full"
          renderOptions={{ quality: "high" }}
        />
      ) : (
        <LocalRenderer 
          scene="high-quality-scene"
          className="w-full h-full"
          quality={deviceCapabilities.gpuTier >= 3 ? "ultra" : "medium"}
        />
      )}
      
      <div className="overlay-controls">
        <button onClick={() => setUseCloudRendering(!useCloudRendering)}>
          Toggle Cloud Rendering
        </button>
      </div>
    </div>
  );
}
```
```

### 7. Update Conceptual References

Update the reference to stream-kit in the SDKs section from:

```markdown
- **[stream-kit](link-tbd)** (Conceptual): Implementation of the Cloud Rendering Protocol client-side logic
```

To:

```markdown
- **[stream-kit](https://github.com/open-game-system/stream-kit)**: Implementation of the Cloud Rendering Protocol client-side components for integrating cloud-rendered graphics into web games
```

### 8. Integration Flow Diagram

Add a specific Stream Kit integration flow diagram:

```markdown
### Stream Kit Integration Flow

```mermaid
flowchart TB
    subgraph "Your Web Game"
        MainUI[Main Game UI]
        RenderRoutes[Standalone Render Routes]
        StreamKit[stream-kit SDK]
    end
    
    subgraph "OGS Cloud Infrastructure"
        API[OGS Stream API]
        Provisioner[Renderer Provisioner]
        CloudGPU[Cloud GPU Instances]
        WebRTC[WebRTC Service]
    end
    
    subgraph "End User"
        Device[User Device]
        LocalUI[Local UI Elements]
        StreamCanvas[StreamCanvas]
    end
    
    MainUI -->|Creates| RenderRoutes
    MainUI -->|Uses| StreamKit
    StreamKit -->|Requests Stream| API
    API -->|Provisions| Provisioner
    Provisioner -->|Allocates| CloudGPU
    CloudGPU -->|Loads| RenderRoutes
    CloudGPU -->|Negotiates via| WebRTC
    WebRTC -->|Connects to| StreamKit
    StreamKit -->|Displays in| StreamCanvas
    Device -->|Renders| LocalUI
    LocalUI -->|Composes with| StreamCanvas
    
    style StreamKit fill:#9333EA,stroke:#d8b4fe,color:#ffffff
    style StreamCanvas fill:#9333EA,stroke:#d8b4fe,color:#ffffff
    style CloudGPU fill:#2563eb,stroke:#93c5fd,color:#ffffff
```
```

## SDKs Section Update

Update the SDKs section to emphasize that stream-kit is now a first-class SDK alongside the others, not just conceptual:

```markdown
## SDKs for Implementation

The following SDKs implement the OGS protocols to simplify integration:

- **[auth-kit](https://github.com/open-game-system/auth-kit)**: Implementation of the Account Linking Protocol
- **[notification-kit](https://github.com/open-game-system/notification-kit)**: Implementation of the Push Notification Protocol
- **[cast-kit](https://github.com/open-game-system/cast-kit)**: Implementation of the TV Casting Protocol
- **[stream-kit](https://github.com/open-game-system/stream-kit)**: Implementation of the Cloud Rendering Protocol with components for integrating cloud-rendered graphics into web games

Each SDK can be used independently, allowing you to implement only the features your game needs.
```

## Version History Update

Update the version history to recognize the addition of the formalized Stream Kit:

```markdown
## Version History

- **v1.1.0 (Planned Q4 2024)** - Addition of formalized Stream Kit specification and cloud rendering capabilities
- **v1.0.0 (March 2024)** - Initial OGS specification release with authentication, push notifications, and Chromecast support
``` 