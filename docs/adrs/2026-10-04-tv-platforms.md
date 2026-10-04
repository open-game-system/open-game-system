# TV platforms: web launcher where the device can run it, WebRTC cloud stream where it can't; no phone rendering, no HLS

**Date:** 2026-10-04
**Status:** Accepted (owner)
**Builds on:** [Cast-kit must use app-bridge for state sync](2026-03-14-cast-kit-uses-app-bridge.md) (stream-kit renders game views in the cloud and streams them over WebRTC)

## Context

The OGS TV side is one web page, the launcher (`apps/tv`): a client of the household's couch session that frames each game's TV page. Games are web (React, Three.js). Taking OGS beyond Chromecast raises two questions per platform: can the device show the launcher and the games, and how does the phone find and start it.

Options considered and their constraints (checked, Oct 2026):

| Way to show games | Works on | Rejected or kept |
|---|---|---|
| The device runs the launcher page itself | Anything with a capable web engine: Fire TV (Fire OS WebView), Google/Android TV, Samsung (Tizen), LG (webOS), laptops and browsers | **Kept** (no cost) |
| Cloud renders the launcher/game, streams WebRTC video | Chromecast (today's receiver), Apple TV (libwebrtc builds for tvOS 17+, e.g. LiveKit's Swift SDK) | **Kept** (GPU cost per hour played) |
| The phone renders the TV page and sends it by AirPlay (an external-display scene) | Apple TV, AirPlay TVs | **Rejected by the owner:** the phone must not do the rendering |
| Cloud stream over HLS/DASH | Roku (its only video path; no WebRTC in the Roku SDK) | **Rejected by the owner:** seconds of delay |
| Rewrite each game's TV side natively per platform | Any | Rejected: breaks "adding a game is config" |

## Decision

Two delivery modes, chosen per platform:

1. **Direct:** the device's own web engine runs the launcher URL (with a launcher token) and frames games. Used where the engine is capable.
2. **Stream:** a cloud renderer (stream-kit) runs the launcher and games and streams **WebRTC** video to a thin receiver. Used where the device has no web engine or a weak one.

| Platform | Mode | Receiver | How the phone starts it | Status |
|---|---|---|---|---|
| Chromecast | Stream (per the March ADR) | Existing Cast receiver | Google Cast | Built (receiver), launcher verified locally only |
| Laptop / any browser | Direct | `tv.opengame.org` page | TV code (built) | Next |
| Google / Android TV | Stream or direct (decide after a device test) | Cast receiver | Google Cast | Next |
| Amazon Fire TV | Direct | Thin Fire TV app hosting the launcher in a WebView | Matter Casting, or TV code | Later |
| Samsung / LG smart TVs | Direct | TV web app | TV code | Later |
| Apple TV | Stream | Native tvOS app: native launcher shell + WebRTC player for games | Our tvOS app (Bonjour) or TV code | Later |
| Roku | — | — | — | **Not supported.** No web engine, no WebRTC; HLS rejected. Revisit if Roku adds WebRTC. |

Every platform's remote maps its d-pad and select to the session's existing `focus.move` / `select`; the phone remote keeps working everywhere. The join-by-TV-code flow is the universal fallback for discovery.

## Consequences

- The couch session protocol doesn't change: a native or thin TV app is just another `launcher` client.
- Stream mode costs GPU per hour per household. Owner rule: every always-on renderer has an idle shutdown, and its hourly cost is stated before it starts. Stream only while someone is on the couch; prefer direct mode wherever the device can run it.
- Roku owners have no OGS TV path until Roku supports WebRTC.
- A native "TV view" protocol (games describing 2D scenes for native renderers) is not planned; revisit only for a deliberate family of simple 2D games.
