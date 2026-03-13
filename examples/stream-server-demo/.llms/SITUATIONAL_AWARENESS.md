# Situational Awareness: WebRTC Streaming Issue

## Date
2026-02-07

## Project Overview
**Project**: Stream Kit - Bun Stream Server Example  
**Technology Stack**: Puppeteer, WebRTC, PeerJS, Chrome Extension (MV3), Node.js/Bun  
**Architecture**: Browser-based streaming system using Chrome extension to capture and stream tab content via WebRTC

## Core System Components

### 1. Container Server (`server.ts`)
- Manages Puppeteer browser instance lifecycle
- Launches Chrome with custom extension loaded
- Monitors active WebRTC connections
- Handles stream initialization and coordination
- Endpoints: `/health`, `/ping`, `/test-puppeteer`, `/start-stream`

### 2. Chrome Extension
- Manifest V3 service worker extension
- Located at `./extension/`
- Provides `streaming.html` page with WebRTC functionality
- Exposes `INITIALIZE` function to set up streaming
- Uses `chrome.tabCapture` API to capture browser tab content
- Maintains `window.activeConnections` Set to track peer connections

### 3. Receiver HTML (`receiver.html`)
- Client-side application for receiving streams
- Uses PeerJS library for WebRTC peer connections
- Workflow:
  1. User enters URL to stream
  2. Clicks "Start Stream & Listen"
  3. Establishes peer connection with receiver ID
  4. Sends request to container server to start streaming
  5. Waits for container to call back with stream

## Current Problem

### Symptoms
1. **No video playback**: Remote video element receives a stream but doesn't display video
2. **ICE connection issues**: Suspected ICE (Interactive Connectivity Establishment) problems
3. **Missing diagnostics**: Incomplete logging for WebRTC connection state

### What's Working ✅
- Browser launches successfully with extension
- Extension service worker loads properly
- PeerJS peer connections establish
- `call.on('stream')` event fires and receives MediaStream object
- Stream has active video tracks
- Video element `srcObject` is set correctly
- Video element fires lifecycle events (loadstart, loadedmetadata, etc.)

### What's NOT Working ❌
- **No video rendering**: Video element remains black/empty despite having stream
- **Potentially no ICE connectivity**: May indicate NAT traversal or ICE negotiation issues
- **Incomplete debugging**: Missing ICE event handlers to diagnose connection state

## Suspected Root Cause

### ICE Connection Failure
WebRTC requires successful ICE negotiation to establish media flow. The issue suggests:

1. **Missing ICE Diagnostics**: No handlers to monitor ICE candidate generation and connection state
2. **NAT Traversal Issues**: Container may be behind NAT without proper STUN/TURN configuration
3. **Network Topology**: Potential issues with UDP ports, firewall rules, or container networking
4. **ICE Gathering Incomplete**: Candidates may not be gathering/exchanging properly

## Proposed Solution

### Add Missing ICE Event Handlers (Currently Being Implemented)

The user has requested adding these handlers to `receiver.html`:

```javascript
// ICE Candidate Handler - Monitor candidate generation
call.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        console.log('🧊 ICE candidate generated:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port
        });
    } else {
        console.log('🧊 ICE gathering complete');
    }
};

// ICE Connection State Handler - Monitor connection state
call.peerConnection.oniceconnectionstatechange = () => {
    console.log('🧊 ICE connection state:', call.peerConnection.iceConnectionState);
    if (call.peerConnection.iceConnectionState === 'failed') {
        console.error('🧊 ICE connection failed - trying to restart...');
        call.peerConnection.restartIce();
    }
};

// ICE Gathering State Handler - Monitor gathering state
call.peerConnection.onicegatheringstatechange = () => {
    console.log('🧊 ICE gathering state:', call.peerConnection.iceGatheringState);
};
```

### Where to Add
These handlers should be added in the `setupCallHandlers()` function, specifically within the `peer.on('call', ...)` handler, right after:

```javascript
call.answer();
receivedCall = call;
```

**Location**: Lines 311-312 in `receiver.html`

## Expected ICE States

### ICE Connection States
- `new`: Initial state
- `checking`: ICE agent checking connectivity
- `connected`: Connection established (but may still be checking other candidates)
- `completed`: All checks complete, connection established
- `failed`: Connection failed (triggers `restartIce()`)
- `disconnected`: Connection lost temporarily
- `closed`: Connection terminated

### ICE Gathering States
- `new`: No gathering started
- `gathering`: Gathering candidates
- `complete`: All candidates gathered

### ICE Candidate Types
- `host`: Local IP address (best performance)
- `srflx`: Server reflexive (via STUN server, through NAT)
- `relay`: Relayed through TURN server (fallback, adds latency)
- `prflx`: Peer reflexive (discovered during connectivity checks)

## Diagnostic Strategy

Once ICE handlers are added, look for:

1. **No candidates generated**: Extension/sender side may not be creating candidates
2. **Only relay candidates**: Indicates STUN/TURN required, direct connection blocked
3. **State stuck at "checking"**: Candidates not reaching each other
4. **State goes to "failed"**: Complete connection failure
5. **Missing host candidates**: Local network discovery issue

## Network Configuration Considerations

### Container Server
- Runs on `https://stream.opengame.tv`
- Uses Chrome flags: `--webrtc-udp-port-range=10000-10100`
- May need STUN/TURN server configuration if behind NAT
- Remote debugging port: 9222

### PeerJS Configuration
Currently minimal in receiver:
```javascript
peer = new Peer(receiverId, {
    config: {
        debug: 3
    }
});
```

May need to add ICE servers:
```javascript
peer = new Peer(receiverId, {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // May need TURN server for relay
        ]
    }
});
```

## Next Steps

1. ✅ **Add ICE event handlers** to receiver.html (current task)
2. 🔲 Test stream connection and monitor console logs
3. 🔲 Analyze ICE candidate types and connection states
4. 🔲 Add ICE handlers to sender side (extension) if needed
5. 🔲 Configure STUN/TURN servers if NAT traversal issues confirmed
6. 🔲 Verify container networking and port accessibility
7. 🔲 Test with different network configurations

## Code Locations Reference

### Receiver HTML
- **File**: `/Users/jonathanmumm/src/stream-kit/examples/bun-stream-server/receiver.html`
- **Key Function**: `setupCallHandlers()` (lines 305-472)
- **Call Handler**: `peer.on('call', ...)` (lines 306-466)
- **Stream Handler**: `call.on('stream', ...)` (lines 316-453)
- **Insert Point for ICE Handlers**: After line 312

### Container Server
- **File**: `/Users/jonathanmumm/src/stream-kit/examples/bun-stream-server/container/src/server.ts`
- **Stream Start Handler**: `handleStartStream()` (lines 763-916)
- **Extension Page Access**: `getExtensionStreamingPage()` (lines 462-592)

### Chrome Extension
- **Location**: `./extension/`
- **Key Files**: `manifest.json`, `background.js`, `streaming.html`
- **Exposes**: `INITIALIZE()` function for stream setup

## Additional Context

### Browser Lifecycle
- Browser launches on first `/start-stream` request
- Stays alive while connections are active
- Monitors `window.activeConnections` every 15s
- 60s grace period before shutdown when no connections
- Automatic cleanup and restart capability

### Video Element State
Currently logs extensive video element state:
- Ready state, paused state, muted state
- Video dimensions, duration, time
- Network state, errors
- All lifecycle events (loadstart, loadedmetadata, canplay, etc.)

These logs should help correlate video readiness with ICE connection state once ICE handlers are added.

## Known Issues

1. **Missing ICE Diagnostics**: Primary issue being addressed
2. **Autoplay Policy**: Has handling for "NotAllowedError" with user interaction fallback
3. **Stream Attachment Guard**: Prevents multiple stream attachments with `streamAttached` flag
4. **Extension Loading**: Complex debugging for extension service worker detection

## Testing Checklist

After adding ICE handlers:

- [ ] Do ICE candidates generate on both sides?
- [ ] What types of candidates are generated (host, srflx, relay)?
- [ ] Does ICE connection state reach "connected" or "completed"?
- [ ] Does ICE gathering state reach "complete"?
- [ ] Are there any "failed" or "disconnected" states?
- [ ] Does video start playing once ICE connects?
- [ ] What's the timing between ICE connection and video playback?

## Environment Details

- **Platform**: Likely containerized (Docker based on server flags)
- **Browser**: Chrome/Chromium with headless mode
- **WebRTC**: Using PeerJS (peer-to-peer)
- **Server**: Bun/Node.js HTTP server
- **Port**: 8080 (container server)
- **Remote Debugging**: Port 9222

---

**Status**: Ready to implement ICE event handlers  
**Priority**: High - Core functionality blocker  
**Impact**: Without ICE diagnostics, cannot determine why video stream isn't flowing
