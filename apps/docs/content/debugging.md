# Client logs and debugging

When the TV shows nothing, you need to know which of four things failed: the cast, the launcher,
your TV page, or your room. This page covers what OGS logs for you, how to look inside each
surface, and the failures every new game hits.

## What OGS logs

The OGS app, a game's own app (the shell) and the Cast receiver send **client events** to the OGS
API (`POST /api/v1/client-events`). Each one is a single structured line: a name, a level, the app
and build, the couch session, and a few scalar fields. They're kept per app launch for 7 days.

| Source | Events | Tells you |
|---|---|---|
| OGS app (`mobile`) | `cast.*`, `airplay.*`, `native.*`, `app.*` errors | Which TV was picked, each step of the cast, the external display coming and going, WebView loads and failures |
| Your own app (`shell`, with your `appId`) | `airplay.*`, `native.*` | The same AirPlay steps, from your app. Logged when `cast.airplay` is on |
| Cast receiver (`receiver`) | `receiver.*` | What the Chromecast was asked to show and what it loaded |

Nothing secret is logged: tokens and JWTs are redacted, secret-named fields dropped, emails
scrubbed, and URLs logged as host and path only.

A healthy Apple TV cast reads, in order: `airplay.start`, `airplay.sheet_open`,
`native.screen.connect`, `native.display.attach`, `airplay.connected`, `airplay.view`,
`native.keep_awake`, `native.tv_webview.finish`. A sound-only pick shows `airplay.audio_only`.

**Reading the stored log** takes a key OGS holds. There is no way yet to read your own app's
events with your game's API key. If a cast from your app fails, send OGS your `appId`, the device and
roughly when, and OGS can pull that launch.

### Your own logs

OGS doesn't collect your pages' `console` output. For errors from your TV page, phone page and room
server, send your own events to your own Worker: one line per event, with the same fields
(`name`, `level`, `appId`, the couch session's `sid` from the game token's claims, your build). Then a failure on a
family's TV is one search away. Never log the game token itself.

## Look inside each surface

| Surface | How to inspect it |
|---|---|
| TV page, on your computer | `ogs dev` ([page](cli-dev.md)): your TV page framed as the launcher frames it, with every message in and out listed |
| TV page, on a browser TV | It's a browser: on a laptop, open DevTools. Pair it at `https://ogs-tv.pages.dev` |
| TV page, on an Apple TV | It runs in a WebView on the host iPhone. The client log's `native.tv_webview.*` events say whether it loaded and why not. Reproduce layout problems in the iOS Simulator (**I/O > External Displays**) |
| TV page, on a Chromecast | The `receiver.*` events. TODO(feat/cast-local-render): how to remote-debug the local receiver, and which `receiver.*` events report your TV page's load and frame rate |
| Phone page, in the OGS app | Safari > Develop > your iPhone > the game's page (the OGS app's game WebView is inspectable) |
| Phone page, in your own app | Not inspectable yet. Run it in `ogs dev` (fake app bridge) or a plain browser, where profile-kit returns `null` |
| Your room server | `wrangler tail` on your Worker, and your own wide events |

## Common failures

| What you see | Usual cause | Fix |
|---|---|---|
| The TV says your game didn't open | Your TV page never arrived: a room game didn't name its TV page within 20 s, or the page refuses to be framed | Name the TV page from the phone (`useCastViewUrl`) or set `tvUrl`; drop `X-Frame-Options: DENY` and any `frame-ancestors` that excludes the launcher |
| Black TV in your own app | `chrome=none` shows black until the session has your TV page, and your manifest has no `tvUrl` | Set `tvUrl`, or have the host phone send the room's TV page as soon as the room exists |
| No names on the TV | `useOgsSession()` is `null` (not framed by OGS) or `token` is `""` (OGS couldn't sign one: your game isn't in the catalogue yet) | Test in `ogs dev`; get the catalogue entry approved |
| Your server rejects every token | `verifyOgsToken` got the wrong `appId` or `jwksUrl`, or production is still pointed at `ogs dev`'s key set | Make `jwksUrl` a Worker variable: `ogs dev`'s in development, the OGS API's `/.well-known/jwks.json` in production |
| Music keeps playing after Home | The frame is parked, not unloaded | `onOgsPause`: suspend the `AudioContext` and pause media |
| No sound after Continue | You resumed nothing, or resumed before the context was unlocked | Resume only what was playing; keep a flag per sound |
| Phones don't follow into the room | Your TV page never sent `ogs:room` | `reportOgsRoom(room)` once the TV knows its room |
| Apple TV plays sound but no picture | The AirPlay *sound* route was picked, not Screen Mirroring | The app says so; pick Control Center > Screen Mirroring |
| Apple TV freezes on "Open <app> to keep the TV going" | The host app went to the background, and iOS stopped drawing it | Bring the app back; the TV resumes |
| TV stutters at one moment every time | A shader compiled mid-game, or a big texture uploaded | See the [TV performance budget](tv-performance.md) |
