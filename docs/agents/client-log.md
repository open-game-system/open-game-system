# Reading a phone's client log (for Claude and other agents)

The OGS app, a game's own app (the shell) and the Cast receiver post their events to
`POST /api/v1/client-events` (`services/api/src/routes/client-events.ts`). Each event is

1. **one JSON line in Workers Logs** (`kind: "client_event"`): live with `wrangler tail`, and what
   sre-agent fingerprints ([observability.md](observability.md)), and
2. **a stored copy** of the same line, kept per app launch in the `ClientLog` Durable Object (the
   last 500 events of each launch, the 200 most recent launches in an index, all deleted 7 days
   after the last write), read back with `GET /api/v1/client-events` and the log key.

Nothing secret is in either: `token=` values and JWTs are redacted, secret-named data keys
(`token`, `secret`, `password`, `authorization`, `cookie`) dropped, emails scrubbed from errors, and
native URLs are logged as host + path only (the launcher URL's query carries its token).

## Who logs what

| Source (`source`) | Launch id | Events |
|---|---|---|
| OGS app (`mobile`) | `context.launchId` = `launch-<uuid>`, one per app launch (`apps/mobile/services/runtime.ts`) | `cast.*` (cast-trace), `app.*` errors, `airplay.*` steps, `native.*` |
| A game's own app (`shell`, with `appId`) | `launch-<uuid>` (`packages/shell/src/airplay-shell.ts`; only with `cast.airplay` on) | `airplay.*`, `native.*` |
| Cast receiver (`receiver`) | none: stored under `receiver:<couch session>` | `receiver.*` |

Builds from before launch ids are stored under `profile:<profileId>`.

### AirPlay events

| Event | What it says |
|---|---|
| `airplay.start` | A cast to the Apple TV began (`connected`: a display was already there) |
| `airplay.sheet_open` / `airplay.sheet_close` | The Screen Mirroring steps (`mode`: `steps` or `audio-only`; `connected` on close) |
| `airplay.connected` / `airplay.disconnected` | The external display came (`name`, `width`, `height`, `waiting`) or went (`casting`) |
| `airplay.audio_only` (warn) | The user picked the AirPlay sound route while the steps waited |
| `airplay.view` | The launcher was handed to the TV window (`view`: host + path) |
| `airplay.away` / `airplay.away_failed` | The app went to the background while casting; the local notice (or why it failed) |
| `native.screen.connect` / `.disconnect` / `.mode` | A `UIScreen` came or went or changed mode (`w`, `h`, `scale`, `native_w`, `mirrored`, `max_fps`, `overscan`) |
| `native.scene.connect` / `.disconnect` | A window scene (`role`, `external_role`) |
| `native.display.attach` / `.detach` / `.resize` / `.observe` | The TV window on the display (`kind`: `scene` or `screen`, `has_view`) |
| `native.keep_awake` | `on`: the phone won't auto-lock while it draws the TV |
| `native.audio.session` / `.route` / `.route.initial` / `.interruption` / `.airplay_audio_only` | The audio session (`category`, `mix_with_others`, `tv`), each route change (`reason`, `outputs`, `airplay`, `external_display`, `now_playing_set`) |
| `native.airplay.routes` | AVRouteDetector: an AirPlay receiver is (`available`) or isn't around |
| `native.tv_webview.start` / `.finish` / `.fail` / `.fail_provisional` / `.process_terminated` | The TV window's WKWebView (`url` host + path, `ms`, NSError `domain` / `code` / `description`, `airplay_media`) |
| `native.phone_webview.notify` | The phone's WebViews when the TV came or went (`webviews`, `airplay_media` per WebView: must be `off`) |
| `native.app.active` / `.foreground` / `.resign_active` / `.background` | App state (`tv_window`, `idle_timer_disabled`) |

A good Apple TV cast, in order: `airplay.start` → `airplay.sheet_open` → `native.audio.route`
(`airplay: true`) → `native.screen.connect` → `native.display.attach` → `airplay.connected`
(`waiting: true`) → `native.audio.session` (`tv: true`) → `native.phone_webview.notify`
(`connected: true`) → `airplay.view` → `native.keep_awake` (`on: true`) →
`native.tv_webview.finish`. A sound-only pick shows `native.audio.route` with `airplay: true,
external_display: false`, then `native.audio.airplay_audio_only` and `airplay.audio_only`.

### Chromecast (local render) events

Two pages log as `receiver` on a Chromecast: the registered Cast receiver page
(`apps/web/public/receiver.html`: `receiver.launched`, `load_view.*`, `view.local`, `sender`,
`cast.ended`) and the OGS TV receiver it frames, which renders the launcher
(`apps/tv/src/receiver`, version `receiver-local-*`, `platform` = the device class). Both carry the
phone's `phoneAttemptId` and the couch `sessionId`; each has its own `attemptId`.

| Event | What it says |
|---|---|
| `receiver.tier` | The tier chosen: `tier`, `reasons` (comma list: `device:google-tv`, `frame:30ms`, `memory:1gb`, `no-webgl`, `software-gl`, `max-texture:2048`, `heap:400mb`, `override`), `deviceClass`, `gpu`, `maxTexture`, `probeP50Ms` / `probeP90Ms` / `probeFrames`, `memoryGb`, `heapLimitMb`; `durationMs` = the probe |
| `receiver.load_view.received` / `.ignored` / `.invalid` | The view (`view` host, `launcher`, `tier`); a repeat (`why: duplicate`); not an http(s) URL |
| `receiver.view.loaded` | The launcher frame loaded: `durationMs` since LOAD_VIEW, `sinceLaunchMs` since the page started |
| `receiver.view.timeout` (error) | The launcher didn't load in 30 s |
| `receiver.fps` | Each minute while a view is up, and when the page goes: `fps`, `frames`, `p50Ms`, `p90Ms`, `worstMs`, `longFrames` (> 50 ms), `tier` (the receiver page's rAF; the launcher and game draw in the same renderer) |
| `receiver.error` (error) | An uncaught error or rejection (`where`: `receiver`, `receiver.promise`, `launcher`) |
| `receiver.sender` / `receiver.cast.ended` | Senders coming and going (`state`, `count`); why the cast ended (`why`) |
| `receiver.keepawake` / `receiver.visibility` | Wake lock or keep-awake clip (`method`, `ok`, `step`); the page hidden, shown or gone |
| `receiver.message.ignored` (warn) | A message that isn't the protocol (`type`) |

A good Chromecast cast: `receiver.launched` → `receiver.load_view.received` → `receiver.view.local`
(the Cast page) → `receiver.launched` (`receiver-local-*`) → `receiver.tier` →
`receiver.load_view.received` → `receiver.view.loaded` → `receiver.fps` every minute.

## Read it live (Workers Logs)

```bash
cd ~/src/open-game-system/services/api && npx wrangler tail opengame-api --format json --search client_event
```

Each line's `logs[].message[0]` is the JSON line: `name`, `level`, `source`, `appId`, `launchId`,
`profileId`, `sessionId`, `deviceHash`, `build`, `data`, `error`.

## Read it afterwards (stored copy)

The key is the API secret `CLIENT_LOG_KEY` (`npx wrangler secret put CLIENT_LOG_KEY` in
`services/api`; unset, reading answers 403). Keep a copy outside the repo, e.g.
`~/.config/ogs/client-log-key`, and send it only as the `x-log-key` header (never in a URL).

```bash
export OGS_LOG_KEY="$(cat ~/.config/ogs/client-log-key)"
```

Recent launches, newest first (each: `bucket`, `source`, `appId`, `profileId`, `deviceHash`,
`sessionId`, `build`, `firstAt`, `lastAt`, `count`):

```bash
curl -s -H "x-log-key: $OGS_LOG_KEY" "https://opengame-api.jonathanrmumm.workers.dev/api/v1/client-events" | jq '.buckets[:10]'
```

Filter with `app=mobile|shell|receiver`, `appId=<appId>`, `profile=<profileId>`,
`device=<deviceHash>`, `session=<couch session id>`:

```bash
curl -s -H "x-log-key: $OGS_LOG_KEY" "https://opengame-api.jonathanrmumm.workers.dev/api/v1/client-events?app=mobile" | jq '.buckets[:5]'
```

One launch's events, oldest first (`limit` 1–500, default 200):

```bash
curl -s -H "x-log-key: $OGS_LOG_KEY" "https://opengame-api.jonathanrmumm.workers.dev/api/v1/client-events?launch=launch-<uuid>&limit=500" | jq -c '.events[] | [.at, .level, .name, .data]'
```

A receiver's or an old build's bucket: `?bucket=receiver:<session>` or `?bucket=profile:<id>`.
Answers: 403 `forbidden` (no or wrong key), 400 `invalid_query`, 503 `not_configured` (no store).

## On the device itself

Native events also go to os_log: subsystem = the app's bundle id (`org.opengame.app` for the OGS
app), category `airplay`. Simulator:

```bash
xcrun simctl spawn booted log stream --level info --predicate 'subsystem == "org.opengame.app" AND category == "airplay"'
```

A real iPhone: Console.app with the phone selected, search `category:airplay`, or Xcode's device
console.

## Tests

`services/api/test/client-log-read.test.ts` (store, read, filters, key), `client-events.test.ts`
(the log line), `test/integration/client-log.test.ts` (the real Durable Object);
`packages/shell/src/__tests__/native-log-forward.test.ts`, `airplay-shell.test.ts`; native
`NativeLogTests` (`pnpm --filter @open-game-system/shell test:native`).
