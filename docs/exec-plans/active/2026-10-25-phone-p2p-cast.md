# Phone renders, streams peer to peer to the TV: feasibility spike (2026-10-25)

Branch `spike/phone-p2p-cast` (off #55, `chore/remove-cloud-render`). Spike code: `spikes/phone-p2p-cast/`.
Not merged; no deploys.

## The direction (Jon, 2026-10-25)

> "it should always be drawn/rendered on the phone... no cloud rendering or on chromecast or tv
> browser, they are not powerful enough."

The host phone renders the TV page off screen and streams it over the LAN (WebRTC, peer to peer) to:

- the Chromecast's custom receiver, which only plays a `<video>`;
- the "Another screen" browser TV, which also only plays a `<video>`.

AirPlay is unchanged. The local-render branch (PR #58) is the wrong direction and is kept for reference.

## What ran, and where

| Part | How |
|---|---|
| Phone | iOS Simulator (iPhone 17 Pro, iOS 26.3) running the spike app `spikes/phone-p2p-cast/ios` (xcodegen). A 1280×720 WKWebView holds the TV page, configured as the shell's would be (inline media, no gesture for playback) |
| TV | The real Cast receiver page (`apps/web/public/receiver.html`, the peer path that #55 kept), in Chrome on the same Mac. Driven by `receiver-driver.mjs` |
| Signaling | `server.mjs`, a WebSocket relay on the Mac. It stands in for the Cast namespace and carries the receiver's existing messages: REQUEST_VIEW, PEER_OFFER {sdp, iceServers: []}, PEER_ANSWER |
| ICE | No STUN and no TURN. The phone offers only host candidates, and WebKit hides them as mDNS `.local` names. Chrome resolved them |
| Games | (1) `sender.html`, a synthetic 720p page with a timestamp bar for glass-to-glass latency and a 2-second beep plus flash. (2) Kite Count on `wrangler dev`, with two Chrome phones that join, start and answer |

**Not on real hardware.**

- Jon's iPhone was "unavailable" in `devicectl` at 21:00 and again at 22:15.
- The Chromecast was not on the LAN. At 15:05 and 22:15, an mDNS browse found only the LG OLED (Cast built in) and the Nest Mini.
- The iPad Air 4 was available, but I did not use it: it is a family device and the test page beeps.

**Caveat on the numbers.** The Mac's load average was 45–84 during the spike, from other sessions. The Simulator has no hardware video or JPEG encoder. Simulator CPU is Mac-core percent and gives no battery figure. Read every number below as a pessimistic Simulator bound; the iPhone numbers are still owed.

## 1. Phone-side capture

### (a) Canvas + Web Audio inside the WebView (`capture.js`, injected as a user script)

This approach sends `canvas.captureStream(30)` plus a tap on everything connected to `AudioContext.destination` (a MediaStreamDestination), over an RTCPeerConnection inside WKWebView.

| Measure (Simulator) | Result |
|---|---|
| WebView off screen (x = 4000) | Still renders at 60 fps (`pageFps`); WebKit does not throttle it |
| Received at the TV | 1280×720, **30 fps p50** (min 18), jitter 23 ms, jitter buffer 107 ms, 2 freezes in 30 s, 0 lost |
| Glass-to-glass | **p50 150 ms**, p90 423 ms, min 48 ms (the same Mac clock on both sides) |
| Audio | Arrives (`totalAudioEnergy` 0.62) |
| Sender | Encode ~20 ms per frame (software in the Simulator). A 6 Mbit/s cap set after the answer; WebKit only accepts `setParameters` encodings once they have been negotiated |
| CPU | WebKit ~35–50 % of a Mac core while drawing, ~55–65 % while streaming. Total Simulator ~67 % |
| Visible WebView (one noisy run) | 24 fps, glass-to-glass p50 513 ms, RTT 725 ms: the bandwidth estimator collapsed under host load |
| Baseline: Chrome → Chrome on the Mac | 30 fps, glass-to-glass p50 77 ms |

**What (a) misses: everything that is not drawn into that one canvas.** Kite Count's TV page has a CSS gradient sky and DOM text (question, timer, bars, scores), and its canvas exists only during the 6-second "show" phase. Under (a) the receiver never got a picture in 60 s. (a) works only for games that draw the whole TV into one canvas, `window.__ogsCastCanvas`.

### (b) Native: snapshots of the off-screen WKWebView

| Measure (Simulator) | Result |
|---|---|
| `WKWebView.takeSnapshot`, 1280×720 | **p50 5 ms; 104/s** (test page) and **123/s** (Kite Count). Captures everything: DOM, CSS, canvas |
| Snapshot → CVPixelBuffer (CGContext draw, main thread) | 26 ms p50. Avoidable by drawing the IOSurface-backed image directly or with vImage |
| **(b2)**: snapshot → JPEG → back into the page's hidden canvas → WebKit's own WebRTC (no new native dependency) | 23–24 fps with 4 JPEG encodes in flight. The JPEG encode is **145 ms per 720p frame** (software in the Simulator) and dominates. App CPU ~280 % of a Mac core |
| (b2) at the TV | 1280×720, 21–24 fps p50, jitter 40–66 ms, jitter buffer 120–190 ms, audio via the same page tap |
| (b2) glass-to-glass | p50 519 ms, p90 593 ms, min 263 ms (the JPEG queue) |
| Width 960 / 640 (one encode in flight) | 11.8 / 21.2 fps: the encode cost scales with pixels |
| Kite Count via (b2) | A full round streams correctly: kites, question, timer, bars, scores, sound. This is the video |

### Verdict

**(b) wins: it is the only approach that streams today's OGS TV pages unchanged.** (a) needs canvas-only games.

- In the Simulator, (b) is limited by the hand-off of each frame, not by the capture: snapshots run at 100+/s.
- The cheapest real build is (b2). It keeps WebRTC and the audio tap inside WebKit. A real iPhone encodes JPEG in hardware; I estimate 5–10 ms per 720p frame (**unverified**), which would put (b2) at 30 fps with roughly 100–200 ms glass-to-glass.
- If the iPhone can't do that, use (b) with a native libwebrtc video track: snapshot, then IOSurface to CVPixelBuffer, then VideoToolbox H.264. Audio then needs a PCM bridge from the page's tap (AudioWorklet → native RTCAudioSource), because a native app can't tap WKWebView's audio.

Glass-to-glass so far:

- (a): 150 ms p50 in the Simulator.
- (b2): 519 ms p50 in the Simulator.
- Chrome → Chrome floor on this Mac: 77 ms.

The target on a phone is 150 ms or less, still to be measured.

## 2. Signaling

- **Chromecast: no server needed on the LAN.** The receiver already speaks the peer protocol over `urn:x-cast:org.opengame.view`: REQUEST_VIEW `{accepts: ['view', 'peer', 'peer-canvas']}` → PEER_OFFER `{sdp, iceServers}` → PEER_ANSWER, plus PEER_KEYFRAME and PEER_STOP. That is the laptop path #55 kept.
  - The phone sends PEER_OFFER through the same CastSession channel that `packages/shell/src/cast-view.ts` already opens for LOAD_VIEW.
  - Non-trickle: one offer once gathering is done (≤ 2 s), which fits Cast messages.
- **Browser TV ("Another screen"):** the same three messages, relayed through the screen's pairing in the OGS API (`services/api/src/routes/screens.ts`). The API carries only a few kilobytes of SDP; media stays on the LAN.
- **ICE:** host candidates only, with no STUN/TURN. WebKit offers mDNS `.local` names, and Chrome resolved them.
  - **Unverified: whether a Chromecast resolves mDNS candidates.** If it can't, the phone must offer its LAN IP. With the WKWebView route that is not possible without a media-capture permission. With native libwebrtc it is a setting.

## 3. Receiver

The receiver is already a thin WebRTC `<video>` player (the peer path: playout buffer, stall watch with a keyframe ask, keep-awake).

The spike adds **`receiver.peer.stats`** to the client log every 30 s (`?statsEvery=` overrides): `fps`, `size`, `kbps`, `jitterMs`, `jitterBufferMs`, `rttMs`, `freezes`, `lost` and `decoder`. I checked it end to end, and the e2e receiver suites (laptop, events, stops) still pass, 18 of 18.

Glass-to-glass latency can't be computed on the receiver alone; the spike decodes the sender's timestamp bar instead.

#55 removed the cloud stream client. Nothing more from it is needed: the peer path never used it.

## 4. Proof

- Kite Count streamed from the phone's WebView, approach (b2), to the receiver page in Chrome, through two-phone gameplay with sound.
- A real Chromecast: **not run** (not on the LAN).
- The LG OLED (Cast built in) could run the published receiver's peer path, but I did not turn on the living-room TV at night unasked.

## 5. Video

`recordings/p2p-cast-kite-b2-simulator.mp4` (git-ignored). Left: the phone (Simulator, its on-screen copy of the TV page). Right: the TV (Chrome receiver).

- Audio is the TV's received track, recorded with MediaRecorder: −39 dB mean, then −42 dB after the mux. The recorder fails if the audio is missing or silent.
- The two clips are lined up by picture content (`align.py`).
- `record-run.mjs` re-records it.

## Recommended build plan

1. **Device numbers first (half a day).** Install the spike app on Jon's iPhone (team 34S957HD77) and run `run-b2.sh` and `run-a.sh` against a Chrome receiver on the LAN. Measure fps, glass-to-glass, CPU and battery drain over 30 min with Instruments' Energy log.
   - If (b2) holds 30 fps at ≤ 200 ms, build (b2).
   - If not, build native libwebrtc for the video track (react-native-webrtc or the WebRTC xcframework, with a custom `RTCVideoCapturer` fed from snapshots) plus the PCM audio bridge.
2. **Shell: a "phone TV" cast backend** (`packages/shell`, next to `airplay-cast.ts`).
   - A hidden 1280×720 WKWebView loads the launcher URL (the same `viewUrl` and launcher token as AirPlay).
   - The capture user script, and the snapshot pump for (b2).
   - The offer goes out through the Cast channel (Chromecast) or the screens API (browser TV).
   - Keep-awake, and the "keep the app open" notice from AirPlay, because iOS stops a backgrounded app.
   - Every step goes to the client log.
3. **Receiver.** Rename the peer path from "laptop" to "phone". Accept PEER_OFFER from the phone as the default (LOAD_VIEW only for older apps). Keep `receiver.peer.stats`. The browser TV page gets the same `<video>` player.
4. **Tests.**
   - Seam: the shell backend against a fake Cast channel, offer and answer.
   - e2e: the receiver suites already cover the peer path.
   - A device check: phone → Chromecast, using `game-rig cast bridge` to carry PEER_OFFER and PEER_ANSWER.
   - A recorded video with audio.
5. **Real Chromecast.** Verify mDNS candidate resolution, the H.264 decoder (`decoderImplementation`), the jitter buffer and 30-minute stability.

## Round 2 (2026-10-26): native path, "a smooth 30 fps on the TV"

Jon found the b2 video choppy and expected the phone to show its controller while the TV page
renders hidden. Round 2 builds the native path in the spike app (`spikes/phone-p2p-cast/ios`).

### The pipeline

The phone shows its controller: the game's phone page, full screen. The TV page renders in a hidden
1280×720 WKWebView behind it.

1. A CADisplayLink fixed at 30 Hz triggers capture, and each frame is timestamped at the display link's vsync.
2. `takeSnapshot` returns 1280 px (`snapshotWidth` = 1280 / screen scale).
3. Core Image (Metal), off the main thread, renders into an IOSurface-backed BGRA `CVPixelBuffer` from a pool.
4. The frame goes into a libwebrtc video track through `RTCVideoCapturer`. The library is **stasel/WebRTC 153.0.0** (exact pin), with H.264 first via `setCodecPreferences` and the VideoToolbox hardware encoder.
5. Back-pressure: at most one snapshot and one render in flight. A busy stage drops the frame instead of queueing it.
6. Sender settings: `maintainFramerate`, 2–7 Mbit/s, max 30 fps. libwebrtc answers the receiver's PLI with keyframes.
7. Audio uses a PCM bridge: an injected tap on `AudioContext.destination` feeds a ScriptProcessor, which sends 16-bit mono PCM to native.
   - `PCMAudioDevice` (libwebrtc's `RTCAudioDevice`) delivers it in 10 ms frames from its own thread.
   - The TV page's audio is muted on the phone.
   - The TV page's `navigator.audioSession.type` is forced to `ambient`. Otherwise the controller page's "playback" session interrupts the TV page's AudioContext (it showed state `interrupted`).
8. Signaling and ICE work as before.
   - Native libwebrtc offers the phone's real LAN IP as host candidates, with no mDNS names, so a Chromecast doesn't need to resolve `.local`.
   - A clock sync over the signaling socket (best of 20 round trips) lets frames carry a TV-clock timestamp bar, for glass-to-glass.

### What made it choppy, found with a reference

- **A steady local 30 fps VP9 file** played in the same Chrome: presented intervals p95 34 ms. So the measurement is sound, headed or headless.
- **A steady 30 fps clip sent over WebRTC** from Chrome to the receiver page: p95 50 ms.
- **The phone stream into a `<video>`:**
  - p95 67 ms at every jitter-buffer target (0, 50, 100, 200 ms), on Chromium and on Chrome stable.
  - Decoder inter-frame delay was mean 33.8 ms, σ 7–8.5 ms. Chrome shows each WebRTC frame as soon as it decodes, so that jitter makes it skip ~5–15 % of decoded frames (presented 28/s while decoding 30/s).
  - The sender was not the cause: 29.6–29.8 frames encoded per second, 0–0.4 dropped per second.
- **The fix is in the receiver.** It now has a *smooth presenter*. Frames are read from the track (`MediaStreamTrackProcessor`) and drawn to a canvas on a playout clock: frame time + the smallest delay seen + 40 ms (`?presentDelay=`). Each display refresh draws the newest due frame.
  - The `<video>` keeps playing, invisibly, for the sound. `?present=video` turns the presenter off.
  - `receiver.peer.stats` now also logs `shownFps`, `intervalP50Ms`, `intervalP95Ms` and `skipped`.

### Before and after, measured at the TV (Chrome receiver page, getStats + every presented frame)

| Run | Received fps p50 | Frame interval p95 | Freezes | Glass-to-glass p50 | Notes |
|---|---|---|---|---|---|
| Round 1, b2 (JPEG detour), Simulator, test page | 21 | 67 ms | 1 / 30 s | 519 ms | Choppy |
| Native, Simulator, Kite Count, `<video>` | 30 | 67 ms | 0 | 96–105 ms | Presenter skips ~5 % |
| **Native + smooth presenter, Simulator, Kite Count, 5 min, 5 games** | **30** (p5 28) | **41.7 ms** (p99 66.6) | **0** | **104 ms** (p90 113, p99 254) | All 4 targets met; σ of decode 8.5 ms |

Phone side in that 5-minute Simulator run:

- Capture: 29.6 fps captured, 0.2 dropped per second; snapshot 1.2 ms, render 24 ms (Simulator Metal).
- Encode: VideoToolbox, 3.4 ms per frame, 1.75 Mbit/s, no quality limit.
- CPU: app 39 % of a core (WebContent ~10 %). Thermal stayed nominal. Battery is not available in the Simulator.
- Audio: 0 underruns; the TV's audio level was 0.46.

**Real iPhone: not yet measured.** The app is built (Release, team 34S957HD77) and installed on Jon's iPhone 16 Pro. Two launches failed:

1. 13:12: the phone was locked.
2. 13:20: "may need to be unlocked", then "unavailable". The earlier launch probably also hit iOS's local-network prompt, because the app never reached the Mac.

Jon was asked to:

1. unlock the phone;
2. tap Allow on the local-network prompt;
3. keep it on charge and on Wi-Fi.

Ready to run: `node native-run.mjs --device 8EE95E69-FAB4-5CC0-BE1D-355B7B806E73 --seconds 300 --out <dir>` (5 min at the 4 targets, plus thermal and battery). Then `proof-video.mjs --device … --frames <SPIKE_FRAMES dir>` for the video with the controller inset, which the app posts at 10 frames per second.

### Proof video

`recordings/p2p-native-kite-simulator.mp4` (Simulator).

- Left: the phone's screen, showing only its controller (Watch the TV / the four colors).
- Right: the TV, recorded from the received stream itself (MediaRecorder in the receiver page). Sound checked: −37 dB mean.

### Left to ship it in the shell

1. Real-iPhone numbers, then a 30-minute battery and thermal run.
2. Move the pipeline into `packages/shell` as a "phone TV" cast backend next to `airplay-cast.ts`. Swift goes into the shell's pod (`ios/module`), with the WebRTC xcframework pinned in the podspec.
   - Keep the launcher URL and token flow (LOAD_VIEW's `viewUrl` loaded in the hidden WebView).
   - Signaling over the CastSession channel (`cast-view.ts`) for a Chromecast, or the screens API for a browser TV.
   - Keep-awake and the "keep the app open" notice from AirPlay (iOS stops drawing a backgrounded app).
   - Client-log events for each step.
3. Receiver: make the peer path the phone path, with the smooth presenter on by default.
   - Check `MediaStreamTrackProcessor` and canvas cost on a real Chromecast with Google TV (CrKey 1.56 is Chrome 114; the API exists from Chrome 94).
   - Fall back to `<video>` where it's missing.
4. Android: the same design with `WebView` + libwebrtc. Out of scope for this spike.

### Device attempt (2026-10-26, 13:59–14:31): blocked by iOS, not by the pipeline

- 13:59–14:14: launches were refused as "Locked". The phone auto-locks within a minute. `native-run.mjs` now retries the launch for 3 minutes; once running, the app keeps the screen awake.
- 14:14–14:31: the app launches and its WebViews load the Kite Count pages from the Mac (wrangler logged `GET /tv/…` and `GET /join/…` from the phone). But its native connections to the spike server fail with "The Internet connection appears to be offline" (NSLog at 14:17), and no metrics arrive. That is iOS **Local Network** access being off for P2PSpike: WebKit's networking is allowed, the app's own sockets are not. The Mac's firewall is off.
- Jon's steps:
  1. Settings > Privacy & Security > Local Network > P2PSpike **on**.
  2. Settings > Display & Brightness > Auto-Lock > **Never**.
  3. Run `spikes/phone-p2p-cast/run-device.sh`.
- For the shell: a phone-TV backend must ask for Local Network access up front (with a clear reason) and say so on the phone when it's denied. WebViews keep loading, so the failure is otherwise silent.

