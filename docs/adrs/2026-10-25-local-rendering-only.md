# The host phone renders every TV; the cloud GPU renderer is removed

**Date:** 2026-10-25
**Status:** Accepted (owner, Jon, 2026-10-25; revised the same day: the host phone renders, not
the Chromecast or a TV browser)
**Supersedes:** [Streaming renders only on Cloud Run](2026-10-06-streaming-cloud-run-only.md) in
full; both delivery modes of [TV platforms](2026-10-04-tv-platforms.md) ("Stream" from the cloud
and "Direct" on the TV's own engine; [AirPlay display](2026-10-23-airplay-display.md) already
reversed its "no phone rendering"); and the rendering part of
[Browser screens](2026-10-17-browser-screens.md) (the browser TV plays the phone's stream instead
of running the launcher). Pairing through the API stands.

## Context

Until now a Chromecast cast worked like this: the phone sent LOAD_VIEW to the Cast receiver
(`apps/web/public/receiver.html`), the receiver asked the API (`/api/v1/stream/*`) to start a
stream, the API had the Cloud Run GPU service `stream-gpu` (project `opengame-stream`; one NVIDIA L4,
8 vCPU / 32 GiB, CPU always allocated, scale to zero, `maxScale` 1) load the OGS TV launcher in
headless Chrome and publish its tab over WebRTC to the Cloudflare Realtime SFU (through TURN), and
the receiver played the SFU's video. A heartbeat kept the GPU up while a TV watched.

Forces:

- **Cost per screen.** A cast cost about $1 per screen-hour of GPU time (owner's figure; L4 plus
  8 vCPU and 32 GiB with CPU always allocated on Cloud Run, unverified against the bill), plus
  Realtime SFU and TURN minutes. A family evening of two hours on one TV is about $2; it bills
  whether the game is a quiz or a 3D world.
- **Scale needs near-zero marginal cost.** The goal is AppLovin-style distribution: games reach
  very large numbers of households, and each extra household must cost close to nothing. A
  per-screen-hour GPU bill grows linearly with play, so it can't be the default path. `maxScale` 1
  also meant one TV at a time per region.
- **TV devices can't render games.** Owner, 2026-10-25: a Chromecast and a TV's browser "are not
  powerful enough" to run the launcher and the games. The host phone is.
- **The phone can already drive a TV.** AirPlay (PR #53): the phone renders the TV page on the
  Apple TV's external display. A laptop already streams its own tab to the Chromecast receiver
  peer to peer over WebRTC (PEER_OFFER).
- **Operational weight.** The renderer needed a Docker image with Chrome and a capture extension,
  idle-stop logic in three places (launcher `__ogsActivityAt`, renderer, receiver heartbeat), TURN
  and Realtime secrets in production and every PR preview, readiness scripts, and a cost watch.

## Decision

The TV is always rendered on the host phone. Nothing renders in our cloud, on the Chromecast, or
in a TV browser:

- **Apple TV / AirPlay TVs:** unchanged. The phone renders the TV page on the AirPlay external
  display.
- **Chromecast and "Another screen"** (the browser TV, renamed in #57): the phone renders the TV
  page off screen and sends it as a peer-to-peer WebRTC stream over the LAN; the TV only plays
  video. This is the old cloud stream's idea (render off screen, stream WebRTC) with the phone as
  the renderer, so no GPU bill and no SFU. The receiver side is being specced on branch
  `spike/phone-p2p-cast`.
- Until that ships, a phone's LOAD_VIEW on the Chromecast receiver shows "This TV can't show games
  from the OGS app yet" and logs `receiver.view.unsupported`. A laptop's PEER_OFFER cast is
  unchanged.

Some of what this ADR removes (the receiver's WebRTC video client, pieces of stream-kit) may come
back in peer-to-peer form for that work. It is deleted here rather than kept dormant; restore from
`3a579c4d` what the P2P design needs.

Removed (code, tests, CI, docs):

- `packages/stream-kit-{types,web,react,server,testing}` and `examples/stream-react-demo`.
- `services/api/container` (the `stream-gpu` image source: Bun server, Puppeteer, capture
  extension, stream lifetime and variant logic).
- The API's `/api/v1/stream/*` routes (`start-stream`, `subscribe`, `subscribe/:id/answer`,
  `heartbeat`, `ice-servers`, `ready`, `health`, `debug-state`, `publisher/*`), the Realtime SFU
  client (`lib/realtime.ts`), the SFU parsers (`protocol.ts`), `stream:ready`, and the env vars
  `STREAM_SERVER_URL`, `CLOUDFLARE_REALTIME_APP_ID/SECRET`, `CLOUDFLARE_TURN_API_TOKEN/KEY_ID`,
  `DEBUG_STATE_TOKEN`.
- The receiver's cloud stream client (ICE fetch, start, subscribe, answer, heartbeat, connection
  timeout, `?viewUrl` / `?streamServerUrl` / `?publisherSessionId` overrides).
- The launcher's `window.__ogsActivityAt` (only the renderer's idle stop read it).
- CI: the production deploy's `STREAM_SERVER_URL` / TURN secret step, the PR preview's Realtime /
  TURN / debug-token secrets, stream-kit in `publish-packages` and `.changeset`.
- Tests and acceptance files for all of the above (`stream-full-pipe.feature`,
  `cast-to-tv-streaming.feature`, `e2e/tests/stream-pipe.e2e.ts`, the API stream suites).

Changed: LOAD_VIEW names the OGS API the receiver logs to as `apiUrl` (the shell's
`config.apiBase`), not a stream server URL. `EXPO_PUBLIC_OGS_STREAM` is gone. An older app's
LOAD_VIEW (`streamServerUrl`) still works: the receiver logs to the production API.

Cloud resources: Jon approved the shutdown and it was done on 2026-10-25 (Cloud Run `stream-gpu`
in us-east4 and europe-west4, Artifact Registry `stream`, Cloudflare container app
`codeflare-containers-pr-5`, Worker `opengame-api-pr-5`). Kept on purpose: the GCP project
`opengame-stream` (it has the Generative Language API enabled and may hold the Gemini key in use),
and the production `opengame-api` stream secrets and the `STREAM_SERVER_URL` repo variable, until
this change is deployed. `cast-kit-core`'s `session.streamSessionId` (always null) stays
for now: it is part of a published package's bridge state, so removing it is a separate, breaking
change.

## How cloud rendering could return

As a separate, opt-in product, not as a fallback inside the free path:

- **Its own service and package**, outside the household path: a renderer service plus a client
  SDK. The code removed here is the starting point: `git show 3a579c4d:services/api/container`,
  `3a579c4d:services/api/src/routes/stream.ts`, `3a579c4d:packages/stream-kit-*`.
- **Paid by whoever asks for it**: metered per screen-hour and billed to the game developer (or a
  premium household tier), with a budget cap per account, so OGS's marginal cost per household
  stays near zero.
- **Explicit in the protocol**: a sender asks for it by name (for example a LOAD_VIEW `render:
  "cloud"` with the renderer's URL), and the receiver accepts it in `REQUEST_VIEW.accepts`. The
  default stays local.
- **Guard rails from day one**: idle shutdown, a hard lifetime, scale limits, and a test that no
  default path can start it.
- Candidates: GPU-heavy games the host phone can't render.

## Consequences

### Positive

- No GPU, SFU or TURN cost per screen; casting cost no longer grows with play.
- About 17,000 lines of code and tests gone; no Docker image, no renderer secrets in CI.
- One rendering model to reason about: the host phone renders the TV page.

### Negative

- Until the phone-to-TV P2P stream ships (`spike/phone-p2p-cast`), a phone can't show games on a
  Chromecast. Merge this together with, or after, that work, or accept the gap.
- The phone does all the TV rendering: battery, heat and its GPU budget limit what a TV page can
  draw, and it must stay on the LAN with the TV.
- Phones in the field send `streamServerUrl` until they update; harmless (logs go to production).

### Neutral

- The Realtime SFU app and TURN key were not checked (auth error); they bill only on use.
- Wrangler migrations `v1` / `v3` (StreamContainer) stay: migrations are append-only.
