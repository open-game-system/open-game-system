# Chromecast local render: device test (Jon's steps)

What it proves: the Chromecast (with Google TV) renders the OGS launcher itself, picks a render
tier, and logs load time, tier and frame rate. Status 2026-10-25: **emulated only** (Chrome with a
Google TV user agent, `apps/tv/e2e/receiver.e2e.ts`, the hosted previews below); not yet run on a
device. The Chromecast with Google TV was not on the LAN at 15:05 (mDNS browse and a `:8008`
probe of 192.168.68.100–140 found only the LG OLED and the Nest Mini).

Previews (branch `feat/cast-local-render`, redeployed by `wrangler pages deploy … --branch feat-cast-local-render`):

- TV receiver + launcher: https://feat-cast-local-render.ogs-tv.pages.dev/receiver
- Registered-receiver page (CAF, laptop path) framing it:
  https://feat-cast-local-render.opengame-org.pages.dev/receiver?tvReceiver=https://feat-cast-local-render.ogs-tv.pages.dev/receiver

## 1. Register a dev receiver (once, in the Google Cast SDK Developer Console)

The OGS app's receiver (807AD5E9) is published and points at production; a preview needs its own
app ID. Unpublished apps only launch on devices registered to the same console account.

1. Open https://cast.google.com/publish and sign in with the account that owns 807AD5E9.
2. **Add New Application → Custom Receiver.**
   - Name: `OGS local render (preview)`
   - Receiver Application URL (the whole chain, as production will run it):
     `https://feat-cast-local-render.opengame-org.pages.dev/receiver?tvReceiver=https://feat-cast-local-render.ogs-tv.pages.dev/receiver`
   - Save. Copy the 8-character **Application ID**.
3. **Add New Device**: the Chromecast with Google TV's serial number (on the TV: Settings →
   System → About; also printed on the device and its box), description `living room`. Save.
4. Wait about 15 minutes, then restart the Chromecast (Settings → System → Restart, or unplug it).
   The console shows the device as Ready when it is registered.

## 2. Cast the preview to it (from this Mac, no phone needed)

```bash
RIG=~/src/skills/game-rig/bin/game-rig.mjs
$RIG cast list                                   # the Chromecast's name, e.g. "Living Room TV"
$RIG cast launch --device "Living Room TV" --app-id <APP ID> \
  --view "https://ogs-tv.pages.dev/?fake=1" --api https://opengame-api.jonathanrmumm.workers.dev \
  --minutes 10
```

- Free: the device renders the page (no stream server). Stops itself after 10 minutes.
- `fake=1` is the launcher's fake couch (no login): the TV shows the OGS home with Bake Shop,
  Story Nook and the join card, as on https://feat-cast-local-render.ogs-tv.pages.dev/?fake=1.
- The helper asks GET_STATE every 10 s and prints the answer. Expect within ~5 s:
  `"tier": "lite", "reasons": ["device:google-tv"], "deviceClass": "google-tv", "gpu": "Mali-G31…"`,
  `"probe": {"p50Ms": …}`, `"loaded": true`. After a minute, `"fps": {"fps": …, "p90Ms": …}`.
- Look at the TV: the home is drawn, the focus ring moves smoothly (no remote: it idles).

## 3. Read the device's log

```bash
export OGS_LOG_KEY="$(cat ~/.config/ogs/client-log-key)"
curl -s -H "x-log-key: $OGS_LOG_KEY" "https://opengame-api.jonathanrmumm.workers.dev/api/v1/client-events?app=receiver" | jq '.buckets[:3]'
curl -s -H "x-log-key: $OGS_LOG_KEY" "https://opengame-api.jonathanrmumm.workers.dev/api/v1/client-events?bucket=receiver:<sessionId or bucket from above>&limit=500" \
  | jq -c '.events[] | select(.name|test("tier|view.loaded|fps|error")) | [.name, .durationMs, .data]'
```

Send back (or paste here): the `receiver.tier` line (tier, reasons, gpu, probeP50Ms, memoryGb),
`receiver.view.loaded` (durationMs) and two `receiver.fps` lines. Those calibrate the thresholds in
`apps/tv/src/receiver/tier.ts`.

## 4. A real cast from the OGS app (after merge, needs Jon's yes)

The app's receiver ID is built in (807AD5E9). After PR #55 and this PR merge and apps/web +
apps/tv deploy, the published receiver page frames the production TV receiver: no console change.
Then: OGS app → TV tab → Cast → the Chromecast; start Rocket Crew. Expected: the launcher appears in
a few seconds, the game's TV page gets `tier: "lite"` in `ogs:start` (a game that ignores it still
runs), Home parks it silent, Continue resumes it. Logs as in step 3, joined to the phone's
`cast.*` lines by `phoneAttemptId`.
