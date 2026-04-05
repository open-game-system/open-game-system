# Progress
Working memory for ralph-realtime-sfu. Delete after run.
---

## Task 1: Realtime SFU API client ✅
- Created `services/api/src/lib/realtime.ts` with 4 functions: `createSession`, `addTracks`, `renegotiate`, `closeTracks`
- All functions use parse-at-the-boundary pattern — `parseSessionResponse` and `parseCloseTracksResponse` validate API responses
- Added `CLOUDFLARE_REALTIME_APP_ID` and `CLOUDFLARE_REALTIME_APP_SECRET` to `Env` in `services/api/src/types.ts`
- 10 tests in `services/api/test/realtime.test.ts` — all pass
- Typecheck, lint, API tests all green
- Commit: c3a433a

## Task 2: SFU protocol types ✅
- Added 8 new types to all 3 protocol files: `SessionDescription`, `TrackInfo`, `PublisherPrepareRequest`, `PublisherPrepareResponse`, `PublisherAnswerRequest`, `SubscribeRequest`, `SubscribeResponse`, `SubscribeAnswerRequest`
- Added 8 parser functions: `parseSessionDescription`, `parseTrackInfo`, `parsePublisherPrepareRequest`, `parsePublisherPrepareResponse`, `parsePublisherAnswerRequest`, `parseSubscribeRequest`, `parseSubscribeResponse`, `parseSubscribeAnswerRequest`
- Kept `IceServerConfig`, `parseTurnCredentialsResponse` (still used by stream routes)
- Kept `StartStreamRequest`, `parseStartStreamRequest` in container protocol files only — still imported by container server.ts. Will be removed in task 4.
- 42 tests in `services/api/test/protocol.test.ts` — all pass
- Typecheck, lint, all tests green
- Commit: d050296

### Next task should know:
- `SessionDescription` type: `{ type: "offer" | "answer", sdp: string }` — same shape as in `realtime.ts` but defined independently in protocol.ts (container protocol is standalone, no imports from API lib)
- `TrackInfo` type: `{ location: "local" | "remote", trackName: string, mid?: string }` — matches `RealtimeTrackInfo` shape from realtime.ts
- `PublisherPrepareRequest` uses `url` + `iceServers` (no peerId — that was PeerJS-specific)
- `PublisherPrepareResponse` returns `sessionDescription` (local SDP offer) + `tracks` (track manifest) + `traceId`
- Container protocol files still export `StartStreamRequest`/`parseStartStreamRequest` — remove these when updating container server.ts
- `examples/stream-server-demo/src/protocol.ts` was NOT updated (not in backlog scope, standalone demo server) — may need updating later
- Zombie turbo daemon processes can block `pnpm test` — run `npx turbo daemon stop` and `pkill -9 -f turbo` to clean up

## Task 3: Update Chrome extension — replace PeerJS with RTCPeerConnection ✅
- Replaced `INITIALIZE({ srcPeerId, destPeerId, iceServers, peerHost, peerPort })` with three SFU-compatible functions:
  - `INITIALIZE_PUBLISHER({ iceServers })` — captures tab, creates RTCPeerConnection, adds tracks as `cast-video`/`cast-audio`, creates local SDP offer, returns `{ sessionDescription, tracks, traceId }`
  - `APPLY_REMOTE_DESCRIPTION({ sessionDescription })` — applies SFU answer to publisher pc
  - `CLOSE_PUBLISHER()` — closes RTCPeerConnection and stops capture stream
- Removed `peer.js` script from `streaming.html`
- Removed all PeerJS/Peer references from streaming.js and streaming.html
- Connection tracking now uses `pc.connectionState` changes (connected → add, disconnected/failed/closed → remove)
- Updated both `examples/stream-server-demo/container/extension/` (canonical) and `services/api/container/extension/` (copy)
- Module-level state: `publisherPc`, `publisherTraceId` for the single publisher connection
- Track names are fixed: `cast-video` and `cast-audio` — CF Realtime SFU uses these to identify streams
- Transceivers set to `sendonly` direction since extension only publishes
- Typecheck, lint, API tests (110 tests), mobile tests (128 tests) all green
- Commit: 2dd8369

### Next task should know:
- Extension now exposes `INITIALIZE_PUBLISHER`, `APPLY_REMOTE_DESCRIPTION`, `CLOSE_PUBLISHER` (NOT the old `INITIALIZE`)
- Container server.ts still calls old `INITIALIZE()` and references `Peer`, `srcPeerId`, `destPeerId` — task 4 must update this
- Container server.ts Window interface declaration still has old `INITIALIZE` type — update in task 4
- `INITIALIZE_PUBLISHER` returns `{ sessionDescription, tracks, traceId }` matching `PublisherPrepareResponse` type
- `APPLY_REMOTE_DESCRIPTION` expects `{ sessionDescription }` matching `PublisherAnswerRequest` type
- The `peer.js` file still exists in both extension directories but is no longer loaded — can be deleted in a cleanup pass
- `streaming.html` bridge now references `INITIALIZE_PUBLISHER` and `window.__pendingPublisherParams` instead of old names

## Task 4: Update container server — split start-stream into prepare/answer ✅
- Replaced `POST /start-stream` with `POST /publisher/prepare` and `POST /publisher/answer`
- Added `GET /publisher/state` debugging endpoint
- `handlePublisherPrepare`: launches Chrome, navigates to URL, captures tab, calls `INITIALIZE_PUBLISHER` in extension, returns `{ sessionDescription, tracks, traceId }` (PublisherPrepareResponse shape)
- `handlePublisherAnswer`: calls `APPLY_REMOTE_DESCRIPTION` in extension with SFU's answer SDP, returns `{ status: "success", traceId }`
- `handlePublisherState`: returns browser state, extension state, active connections for debugging
- Updated Window interface: removed `INITIALIZE`, `Peer`; added `INITIALIZE_PUBLISHER`, `APPLY_REMOTE_DESCRIPTION`, `CLOSE_PUBLISHER` with proper types
- Updated `assertExtensionLoaded` to check for `INITIALIZE_PUBLISHER` instead of `INITIALIZE`
- Updated `collectBrowserState` and connection monitoring to check new function names
- Removed `StartStreamRequest` and `parseStartStreamRequest` from both container protocol.ts files (no longer needed)
- Removed all PeerJS references: `peerId`, `destPeerId`, `srcPeerId`, `peerHost`, `peerPort`, `Peer` type
- Updated both `examples/stream-server-demo/container/` (canonical) and `services/api/container/` (copy)
- Typecheck, lint, all 110 API tests green
- Commit: 11296ed

### Next task should know:
- Container server now exposes `POST /publisher/prepare`, `POST /publisher/answer`, `GET /publisher/state` (NOT `/start-stream`)
- `POST /publisher/prepare` accepts `{ url, iceServers }` (parsePublisherPrepareRequest) and returns `{ sessionDescription, tracks, traceId }`
- `POST /publisher/answer` accepts `{ sessionDescription }` (parsePublisherAnswerRequest) and returns `{ status, traceId }`
- The Worker in `examples/stream-server-demo/src/index.ts` still proxies any path to the DO — it doesn't know about the new paths yet. Its existing test sends `/start-stream` to the Worker which mocks the DO, so the test still passes.
- The `services/api/src/routes/stream.ts` still has `POST /start-stream` route that forwards to the container — task 5/6 must update this
- The stream-server-demo Worker test (index.test.ts) still references `/start-stream` — will need updating in task 5 or 8
- `examples/stream-server-demo/src/protocol.ts` (Worker-level, NOT container) still has `StartStreamRequest` — unused but not removed (separate from container protocol)
- Container protocol.ts no longer exports `StartStreamRequest` or `parseStartStreamRequest`
- The `peer.js` file still exists in both extension directories but is no longer loaded — cleanup later
