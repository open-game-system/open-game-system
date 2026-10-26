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
