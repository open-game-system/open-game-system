# Proposed Changes to Open Game System (OGS) Specification v1

This document outlines the proposed additions and modifications to the `SPEC.md` to incorporate the **Cloud Rendering Protocol** and the conceptual **`stream-kit`**.

**Goal:** Define how web games can leverage OGS to render graphics-intensive games on cloud servers and stream the result to clients via WebRTC, enabling high-fidelity experiences on low-power devices.

## 1. Updates to Table of Contents

*   Add "Cloud Rendering Protocol" under "Core Specifications".

```diff
  - [Account Linking Protocol](#account-linking-protocol)
  - [Push Notification Protocol](#push-notification-protocol)
  - [TV Casting Protocol](#tv-casting-protocol)
+ - [Cloud Rendering Protocol](#cloud-rendering-protocol)
```

## 2. Updates to Introduction

*   Mention Cloud Rendering as a capability enabled by OGS.

```diff
The OGS v1 specification includes three core protocols:
+ The OGS v1 specification includes core protocols for:
  Account Linking, Push Notifications, TV Casting,
+ and optional Cloud Rendering.
```

## 3. New Section: Cloud Rendering Protocol

*   Insert the following new section under "Core Specifications":

```markdown
### Cloud Rendering Protocol

The Cloud Rendering Protocol allows games to offload intensive graphics rendering to powerful cloud servers and stream the output via WebRTC to the client (typically running within the OGS App or a compatible browser). This is ideal for turn-based games or experiences where high visual fidelity is desired and absolute minimal latency is not the primary concern.

#### Protocol Overview

1.  **Client Initialization:** The game client (using `stream-kit`) initializes and optionally informs the OGS backend it's ready for potential streaming.
2.  **Stream Request:** The game client requests a cloud rendering session from the OGS platform, providing the game URL to be rendered and potentially authentication/session data.
3.  **Session Setup:** The OGS Platform (or a dedicated Cloud Rendering Broker service managed by OGS) receives the request, authenticates it, provisions a cloud rendering instance (e.g., a container with a GPU and Puppeteer/equivalent), and instructs it to load the specified `gameUrl`.
4.  **WebRTC Connection:** The OGS Platform facilitates the WebRTC connection negotiation between the Cloud Rendering Instance and the Game Client. The Cloud Rendering Instance captures the rendered game output (video/audio).
5.  **Streaming:** The Cloud Rendering Instance streams the captured video/audio directly to the Game Client via the established WebRTC PeerConnection. The `stream-kit` handles receiving the stream and displaying it within the designated HTML element.
6.  **Input Forwarding (Optional/Future):** For interactive streamed experiences, client-side input events could be captured by the `stream-kit` and sent back to the Cloud Rendering Instance via the WebRTC data channel or through the OGS API. (v1 focuses on non-interactive/display-only streaming initially).
7.  **Session Termination:** The game client requests termination, or the session times out. The OGS Platform tears down the Cloud Rendering Instance and associated resources.

#### HTTP/WebRTC Sequence for Cloud Rendering

```mermaid
sequenceDiagram
    participant Client as Game Client (w/ stream-kit)
    participant OGSPlatform as OGS Platform/Broker
    participant Renderer as Cloud Rendering Instance
    
    Client->>OGSPlatform: 1. Request Stream Session (gameUrl, authData?)
    OGSPlatform->>OGSPlatform: 2. Authenticate & Provision Renderer
    OGSPlatform->>Renderer: 3. Load Game URL
    Renderer->>Renderer: 4. Start Game & Capture Stream
    OGSPlatform->>Client: 5. Signal WebRTC Offer/ICE Candidates (via Broker)
    Client->>OGSPlatform: 6. Signal WebRTC Answer/ICE Candidates (via Broker)
    OGSPlatform->>Renderer: 7. Forward WebRTC Signaling
    Renderer->>Client: 8. Establish Direct WebRTC PeerConnection
    Renderer-->>Client: 9. Stream Video/Audio via WebRTC
    Note right of Client: stream-kit displays video
    Client->>OGSPlatform: 10. Request End Session (Optional)
    OGSPlatform->>Renderer: 11. Terminate Instance
```

#### Required API Endpoints

##### Request Stream Session (Game Client -> OGS Platform/Broker API)

*Note: This API call would likely be abstracted by the `stream-kit`.*

```http
POST /api/v1/stream/session HTTP/1.1
Host: api.opengame.org 
Content-Type: application/json
Authorization: Bearer OGS_SESSION_TOKEN_OR_GAME_API_KEY 

{
  "gameUrl": "https://yourgame.com/path-to-render", // The specific URL the cloud instance should load
  "clientOffer": { ... }, // SDP Offer from client for WebRTC negotiation
  "clientIceCandidates": [ ... ], // ICE candidates from client
  "renderOptions": { // Optional parameters for the rendering instance
    "resolution": "1920x1080",
    "region": "us-central1", // Preferred region for lower latency
    "gpuType": "nvidia-t4" // Optional GPU preference
  },
  "initialGameData": { // Optional data to pass to the game instance in the cloud
     "userToken": "...",
     "sessionId": "..." 
  }
}
```

Response (Success):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "sessionId": "stream-session-xyz789",
  "status": "negotiating",
  "serverAnswer": { ... }, // SDP Answer from the rendering instance
  "serverIceCandidates": [ ... ] // ICE candidates from rendering instance
}
```

Response (Failure):

```http
HTTP/1.1 4xx/5xx 
Content-Type: application/json

{
  "error": "Failed to provision renderer",
  "message": "No available GPU instances in the requested region." 
}
```

##### End Stream Session (Game Client -> OGS Platform/Broker API)

*Note: This API call would likely be abstracted by the `stream-kit`.*

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
  "sessionId": "stream-session-xyz789"
}
```

##### WebSocket Signaling (Optional Alternative)

For WebRTC negotiation, a WebSocket connection between the Client, OGS Platform, and potentially the Renderer could be used instead of relying solely on HTTP polling/responses for SDP and ICE candidate exchange. This would be more efficient for the real-time nature of negotiation. The specific WebSocket message format would need further definition.

---
```

## 4. Updates to Certification Process

*   Add `streaming` to the list of possible values in the `features` array in `.well-known/opengame-association.json`.

```diff
  "contact": "developer@yourgame.com",
- "features": ["authentication", "notifications", "chromecast"],
+ "features": ["authentication", "notifications", "chromecast", "streaming"], 
  "apiVersion": "v1",
  "verification": "VERIFICATION_TOKEN"
```

## 5. Updates to SDKs Section

*   Add the conceptual `stream-kit`.

```diff
- **[cast-kit](https://github.com/open-game-system/cast-kit)**: Implementation of the TV Casting Protocol
+ **[cast-kit](https://github.com/open-game-system/cast-kit)**: Implementation of the TV Casting Protocol
+ - **[stream-kit](link-tbd)** (Conceptual): Implementation of the Cloud Rendering Protocol client-side logic
```

## 6. Updates to Integration Overview Diagram

*   Add `stream-kit` and show its interaction.

```diff
      GameClient[Game Client]
      AuthKit[auth-kit]
      NotificationKit[notification-kit]
      CastKit[cast-kit]
+     StreamKit[stream-kit] (Conceptual)
  end
  
  subgraph "OGS System"
      OGSAPI[OGS API]
+     CloudRenderer[Cloud Rendering Service]
      OGSApp[OGS Mobile App]
      OGSPlatform[OGS Platform]
  end
  
  GameServer -->|Uses| AuthKit
  GameServer -->|Uses| NotificationKit
  GameClient -->|Uses| CastKit
+ GameClient -->|Uses| StreamKit
  
  AuthKit -->|Communicates with| OGSAPI
  NotificationKit -->|Sends notifications via| OGSAPI
  CastKit -->|Communicates with| OGSApp
+ StreamKit -->|Requests/Manages Stream via| OGSAPI
+ OGSAPI -->|Coordinates| CloudRenderer 
+ CloudRenderer -->|WebRTC Stream| StreamKit 
  
  OGSApp -->|Enables native features| OGSPlatform
```

## 7. Updates to Version History

*   Add a note about Cloud Rendering being introduced conceptually or in a later point release.

```diff
- **v1.0.0 (March 2025)** - Initial OGS specification release with authentication, push notifications, and Chromecast support
+ **v1.0.0 (March 2025)** - Initial OGS specification release with authentication, push notifications, and Chromecast support. (Cloud Rendering protocol introduced conceptually).
``` 