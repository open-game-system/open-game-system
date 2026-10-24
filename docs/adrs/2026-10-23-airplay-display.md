# 2026-10-23: An Apple TV is a cast device; the phone renders the TV page on Screen Mirroring's external display

## Status

Accepted. Proven in Crak & Bam's app on Jon's iPhone 16 Pro with an Apple TV ("Kitchen", 4K) on
2026-10-23, moved into `@open-game-system/shell` the same day (branch `feat/airplay-display`).

## Context

- The Chromecast path renders the OGS TV launcher on a cloud GPU (the stream server behind
  `/api/v1/stream`) and plays it on the receiver. Apple TVs can't run a Cast receiver, and many of
  the households we test with (ours included) have an Apple TV, not a Chromecast.
- iOS gives an app an **external display** when the user picks Control Center > Screen Mirroring:
  a `UIScreen` (apps on the app-delegate life cycle, which an Expo app is) or a
  `windowExternalDisplayNonInteractive` scene. An app that puts its own window there gets
  **extended mode**: the TV shows that window while the phone keeps its own UI.
- iOS has no API to start Screen Mirroring. `AVRoutePickerView` only routes **audio and media**:
  in Crak & Bam's first test it sent the sound to the Apple TV and no picture (a real bug).
- The browser TV (ADR 2026-10-17-browser-screens) already showed that the launcher runs well
  outside the stream: it is a web page that speaks the couch session and frames each game.

## Decision

- **The AirPlay TV is one more `CastBackend`** (`packages/shell/src/airplay-cast.ts`), combined
  with the Chromecasts and browser TVs in the OGS app (`apps/mobile/services/runtime.ts`) and in a
  game's own app (`castGameStores`, shell config `cast: { receiver: "ogs", airplay: true }`). The
  cast flow, couch session, launcher token and game starts don't change.
- **TV URL and auth: the cast's LOAD_VIEW `viewUrl`, unchanged.** That is the OGS TV launcher
  (`<tvBase>/?api=<api>&token=<launcher token>`; a game's own app adds `chrome=none&app=<appId>`,
  ADR-less feature 2026-10-18-cast-chrome-none). The token is the launcher token
  `POST /api/v1/sessions` minted for this couch session, as a Chromecast and a browser TV get it.
  The backend loads it in the phone's TV window instead of sending it to a stream server. So
  `ogs:start`, `ogs:suspend` / `ogs:resume`, sitting labels and the couch's names work as on every
  other TV, because the launcher does them. We do **not** load a game's `tvUrl` directly: that would
  bypass the launcher protocol and need a second auth path.
- **The phone renders it** (`OgsAirplayDisplay`, `packages/shell/ios/module/AirplayDisplay`): a
  second full-screen WKWebView on the external display. No cloud GPU, no stream server.
- **No AirPlay picker.** Picking "Apple TV / AirPlay" with no display connected opens the guided
  Screen Mirroring steps (`ShowOnTvSheet`) and the cast waits for the display; a sound-only AirPlay
  route (an `.airPlay` output with no external screen, after the route settles) says "That sent
  sound only. Use Screen Mirroring for the picture."
- "Apple TV / AirPlay" is listed only when **AVRouteDetector** finds an AirPlay receiver (searched
  for 30 s per discovery) or a display is already connected, so a home with neither still gets "No
  TV found" and the browser-TV way.
- **TV audio:** both WebViews refuse AirPlay media (`allowsAirPlayForMediaPlayback = false`); while
  a TV window is up the app's audio session is `.playback` + `.mixWithOthers`, which is never the
  Now Playing app (no "now playing" card on the Apple TV), and `MPNowPlayingInfoCenter` is never
  set. The previous session is restored when the display goes. Mirroring sends all app audio to the
  TV with the picture.
- **While casting:** keep-awake (`isIdleTimerDisabled`, only while a TV page is on a display); the
  TV shows "Open <app> to keep the TV going" while the app is in the background (iOS stops drawing a
  backgrounded app) and the app schedules the same as a local notification; Stop casting puts back
  the TV's idle card; stopping Screen Mirroring ends the cast.
- **Everything is logged** (native + JS) to the client log, which is now also stored per launch and
  readable with a key (docs/agents/client-log.md).

## Consequences

- The shell has native code: `expo-module.config.json` and `ios/OgsShell.podspec` autolink
  `OgsAirplayDisplay` in every app on the shell, apps/mobile included. Its native fingerprint
  changes: the next release is a store build, not an OTA. The module does nothing until a display
  connects or JS calls it.
- The phone is busy while it casts: it renders the launcher and the game's TV page, and stays
  awake. Heavy 3D TV pages run at the phone's GPU budget (the Simulator's external display and a
  1080p Apple TV were fine for Crak & Bam's table).
- The app must stay in front. iOS suspends a backgrounded app, so the TV freezes on the notice until
  the app comes back. That is the platform's limit, and the notice says so.
- Android: no change (the module is iOS only; Android TVs use Cast or the browser TV).
- Overlap: PR #52 (Live Activities) adds a second module to the same pod (`ios/module`, same
  podspec); merging it after this is a union of the two `expo-module.config.json` module lists.
