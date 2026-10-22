# Exec plan: iOS Live Activities for the controller phone

**Status:** in progress (2026-10-21), branch `feat/live-activities`, ships dark.
Acceptance: [live-activities.feature](../../acceptance/2026-10-21-live-activities.feature).
ADR: [2026-10-21 Live Activities in the shell](../../adrs/2026-10-21-live-activities.md).

Inspiration: Netflix's game controller app puts a Live Activity on the lock screen ("Recently Played ·
LEGO Party! · Tap to return to your game controller"). When a phone is the controller for a game on the
TV, OGS shows the game on the lock screen and in the Dynamic Island, and a tap goes straight back to the
controller.

## What exists (explored 2026-10-21)

- **Apps.** `apps/mobile` is the OGS app (Expo SDK 55, managed; `ios/` is generated and off-limits).
  Per-game apps (`~/src/catancast/app`) use `["@open-game-system/shell", shell]`, the config plugin in
  `packages/shell/plugin`, and `<OgsShell />` from `packages/shell/src`. apps/mobile does not list
  the shell plugin; it imports shell modules through one-line shims in `apps/mobile/services`.
- **Sessions.** One CouchSession Durable Object per cast (`services/api/src/couch-session.ts`). Its
  state (`ogs-protocol/session.ts`) has `current` (appId, label, room), `cast`, `members`. The TV page's
  `ogs:instance` report becomes `game.resume-point` (the label). In the OGS app, `couchHub`
  (`apps/mobile/services/runtime.ts`) mirrors that state on the phone. A shell app has no couch socket.
  It knows the cast session from its `cast` store and the game's reports from the `ogs` store.
- **Bridge.** Game pages already send `INSTANCE_REPORT` (`{ status, title, detail, yourTurn }`)
  through the `ogs` app-bridge store (`OgsBridgeEventSchema`, Zod). That is the status channel; no new
  game contract.
- **Push.** The OGS app sends through Expo push. White-label apps send through APNs with their own sealed
  .p8 (`services/api/src/lib/native-push.ts`, `push-credentials.ts`). Expo push can't send
  `liveactivity` pushes, so the OGS app needs its own APNs key: secrets `APNS_KEY_ID`, `APNS_TEAM_ID`,
  `APNS_P8`.

## Plan (TDD, one commit per milestone)

1. **Protocol** (`ogs-protocol/live-activity.ts`): the Zod schemas for the activity's attributes,
   content state and token registration, plus pure mappings: an instance report becomes the status
   ("Round 3 · Your turn", "In lobby", "Waiting for players"), and the couch state becomes the content
   (the server uses this one too).
2. **Shell runtime** (`packages/shell/src/live-activity*.ts`): the native adapter
   (`requireOptionalNativeModule`, events parsed with Zod, a no-op when the module is missing), and the
   controller: start on join, throttled update, end on session end, stale after 4 h, end after 30 min
   idle, a no-op when the user disallows Live Activities or the flag is off, and push tokens sent to
   the API. Two drivers: the shell's (cast store plus `ogs` reports) and the OGS app's (couch state plus
   `ogs` reports).
3. **Native** (`packages/shell/ios`): an Expo module `OgsLiveActivity` with start, update and end, the
   enabled check, and update and push-to-start token events. The widget extension's Swift
   (`packages/shell/ios/widget`) has the lock screen plus compact, minimal and expanded Dynamic Island
   layouts, and `widgetURL` set to the deep link. The attributes struct is shared by both targets.
4. **Config plugin** `withShellLiveActivity`: copies the widget into `ios/OgsLiveActivity` at prebuild,
   adds the app-extension target, sets `NSSupportsLiveActivities` and the App Group used for key art,
   and declares the extension for EAS (`extra.eas.build.experimental.ios.appExtensions`). It is off
   unless `liveActivities: true` is in the shell config. apps/mobile turns it on at prebuild with
   `OGS_LIVE_ACTIVITIES=1`.
5. **API** (behind `LIVE_ACTIVITIES=on`): `POST/DELETE /api/v1/sessions/:sid/live-activities`, a D1
   table `live_activities`, and a CouchSession hook. When the couch state's activity content changes,
   it sends a `liveactivity` push (update, or end when the cast ends) to every token of the session.
   The APNs client is an interface, with a fake in tests. Credentials: env secrets for the OGS app, and
   the app's sealed .p8 for white-label apps.
6. **Deep link** `<scheme>://live-activity/<appId>`: the shell ignores it (the app comes forward on the
   controller as it was). The OGS app opens or rejoins that game's controller unless it is already
   open.
7. **Verify:** typecheck, lint and tests; Stryker on the new modules; `expo prebuild` plus a simulator
   build; start an activity; take lock screen and Dynamic Island screenshots.

## Flags (ships dark)

| Where | Flag | Default |
|---|---|---|
| Shell app build | shell config `liveActivities: true` | off: no extension, runtime off |
| OGS app build | `OGS_LIVE_ACTIVITIES=1` at prebuild/EAS build | off |
| API Worker | `LIVE_ACTIVITIES = "on"` (wrangler var) | off: routes 404, no pushes |

## For Jon (pending)

- APNs key (.p8) with the APNs service for team `34S957HD77`. Then
  `wrangler secret put APNS_KEY_ID`, `APNS_TEAM_ID` and `APNS_P8` (see `services/api/docs/live-activities.md`).
- App Group `group.org.opengame.app.ogs` and the extension bundle id `org.opengame.app.OgsLiveActivity`
  (EAS syncs capabilities on build; unverified).
- Real-device check: lock screen, Dynamic Island (iPhone 14 Pro or later), tap returns to the controller,
  remote update after the APNs key is in.
