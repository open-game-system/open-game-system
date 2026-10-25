# 2026-10-25: A Chromecast renders the launcher itself, at a render tier it measures

## Status

Accepted (draft PR, branch `feat/cast-local-render`, based on PR #55 `chore/remove-cloud-render`).
Emulated in Chrome only; not yet run on a real Chromecast (docs/testing/chromecast-local-render.md).

## Context

- ADR 2026-10-25-local-rendering-only (PR #55) removed the cloud GPU renderer: TVs render locally.
  Until this ADR a phone's cast to a Chromecast showed "This TV can't show games from the OGS app
  yet" (`receiver.view.unsupported`).
- The AirPlay path (ADR 2026-10-23) already renders the OGS TV launcher on the device that shows it,
  loading the cast's LOAD_VIEW `viewUrl` (the launcher URL with its launcher token). The launcher
  does the rest: couch session, `ogs:start` / `ogs:suspend` / `ogs:resume`, sitting labels.
- A Chromecast is weak: a Chromecast with Google TV has a Mali-G31 MP2 and 1.5–2 GB; the 2015–2018
  dongles have 512 MB and an older GPU. A game drawn for a laptop GPU will not hold its frame rate.
- The Cast app registered for the OGS app (807AD5E9) points at `apps/web/public/receiver.html`
  (unverified: from `~/src/skills/game-rig/scripts/cast/castlib.py`; confirm in the Developer
  Console). That page also carries the laptop path (PEER_OFFER), which PR #55 keeps.

## Decision

- **The OGS TV receiver** is a second page of the launcher's own deploy: `apps/tv/receiver.html`
  (`apps/tv/src/receiver/`). It
  1. measures the TV's **render tier** once (`tier.ts`, `probe.ts`): the device class from the user
     agent (`DeviceType/AndroidTV` → Google TV, `DeviceType/Chromecast` → the older dongles and the
     Ultra, `DeviceType/SmartDisplay`), the WebGL renderer (none or software GL → `minimal`), max
     texture size, a 1.5 s frame-time probe (a fixed 1280×720 shader with a 1-pixel readPixels per
     frame), `navigator.deviceMemory`, the JS heap limit and CAF's 4K answer. The weakest signal
     wins: Google TV → at most `lite` (unless it has ≥ 4 GB: the Google TV Streamer), older
     Chromecasts → `minimal`, the Ultra → `lite`. `?tier=` on its URL overrides (testing);
  2. frames the launcher. An OGS launcher URL (`/?api=…&token=…`, or `fake=1`) is served **from the
     receiver's own site** with `tier=<tier>` added, so receiver and launcher are always one build,
     and a dev phone's `localhost` launcher still loads on the TV. Other pages are framed as sent;
  3. logs through the client-log pipeline (#53): `receiver.tier`, `view.loaded` (load time),
     `fps` (each minute), `error`, `view.timeout`, `sender`, `cast.ended`.
- **Protocol, additive only:** `ogs:start` gains `tier?: "full" | "lite" | "minimal"`
  (`RenderTierSchema`, packages/ogs-protocol); the launcher reads `tier=` from its URL and passes it
  to every framed game; profile-kit's `useOgsSession()` gives `tier`. Absent = the TV didn't say:
  draw for `full`. What a game does at each tier: docs/specification.md "Render tiers".
- **Where it runs:** the registered receiver page keeps CAF and the laptop path; for a phone's
  LOAD_VIEW (PR #55's `{viewUrl, apiUrl}` shape) it frames the TV receiver full screen
  (`https://ogs-tv.pages.dev/receiver?host=parent&uhd=0|1`; `?tvReceiver=` on its own URL
  points at another deploy) and relays the view namespace both ways (`{ogsRx: "in" | "out" |
  "ready" | "stop"}`, `parentHost` in `cast-host.ts`). So shipping needs **no Developer Console
  change**: deploying apps/web and apps/tv switches the published app to local rendering. The TV
  receiver also runs as the Cast app's page itself (`cafHost`), which a dev registration uses.
- CAF starts with `skipPlayersLoad` (no media player on a small device) and `disableIdleTimeout`;
  the TV receiver keeps the screen awake (wake lock, else the keep-awake clip), stops 20 minutes
  after the last phone left and after 3 hours, like the old receiver.

## Consequences

- No cloud cost for a Chromecast cast; the TV's GPU is the budget. Games must honour `tier`
  (docs/specification.md); a game that ignores it runs at whatever the Chromecast manages.
- One more frame level on the device (receiver page → TV receiver → launcher → game). The TV
  receiver page is ~13 KB of JS (gzip ~6 KB) plus the shared chunk.
- The tier thresholds are estimates until real devices report `receiver.tier` and `receiver.fps`;
  calibrate them from the client log (docs/agents/client-log.md).
- The laptop path (PEER_OFFER) is unchanged and replaces a phone's view (the TV receiver's frame
  goes), as before.
- Merge with PR #55 or right after it: this branch is based on it.
