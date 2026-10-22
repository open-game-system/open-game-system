# Live Activities: remote updates over APNs

The API's half of the controller phone's Live Activity
([acceptance](../../../docs/acceptance/2026-10-21-live-activities.feature)). The phone registers its
activity's push token under the couch session (`POST /api/v1/sessions/:sid/live-activities`). When the
couch session's game or label changes, or its cast ends, the CouchSession DO sends every token of that
session an APNs `liveactivity` push (`src/lib/live-activities.ts`). That keeps the lock screen in step
with the TV while the phone is locked and its JS is suspended.

It ships dark. Nothing happens until `LIVE_ACTIVITIES` is `"on"`: the routes answer 404
`feature_disabled`, and the DO sends nothing.

## What Jon has to set up (pending)

Expo push can't send `liveactivity` pushes, so the OGS app (`org.opengame.app`) needs its own APNs
auth key. White-label apps already have theirs (`ogs push credentials`), and the same code sends with
those.

1. **Make the key.** Go to developer.apple.com → Certificates, IDs & Profiles → Keys → **+**. Name it
   "OGS APNs" and tick **Apple Push Notifications service (APNs)**. Choose the environment
   **Sandbox & Production** and continue. Download the `AuthKey_<KEYID>.p8` (Apple lets you download it
   only once). Write down the **Key ID** (10 characters). The **Team ID** is `34S957HD77` (from
   `apps/mobile/app.json`).
2. **Store the secrets** in the Worker. Never commit or paste the .p8 anywhere else, and keep it out
   of `.dev.vars` in git. From `services/api`:

   ```bash
   pnpm exec wrangler secret put APNS_KEY_ID          # the 10-character Key ID
   pnpm exec wrangler secret put APNS_TEAM_ID         # 34S957HD77
   pnpm exec wrangler secret put APNS_P8 < ~/Downloads/AuthKey_XXXXXXXXXX.p8
   ```

   For a preview Worker, add `--name <that worker's name>` to each command. The default bundle id is
   `org.opengame.app`. A build with another bundle id sets `APNS_BUNDLE_ID` as a var.
3. **Turn it on** for that Worker by adding `"LIVE_ACTIVITIES": "on"` to `vars` in `wrangler.jsonc` (or
   to the preview's `vars`), then deploy. Merging and deploying need Jon's yes.
4. **Build the app with the extension:** set `OGS_LIVE_ACTIVITIES=1` in the EAS build profile's `env`
   (`apps/mobile/eas.json`). The first such build registers the new bundle id
   `org.opengame.app.OgsLiveActivity` and the app group `group.org.opengame.app.ogs`. EAS should
   create both when it syncs capabilities. **Unverified**: if it doesn't, add them in the developer
   portal.

Until all three secrets are set, a session with registered activities counts them as `unsendable` in
its `live_activity.push` wide event. Nothing is sent and nothing fails.

## How a push looks

```
POST https://api{.sandbox}.push.apple.com/3/device/<activity push token>
apns-push-type: liveactivity
apns-topic: org.opengame.app.push-type.liveactivity
apns-priority: 5 (update) | 10 (end)
authorization: bearer <ES256 provider token, reused 50 min>

{ "aps": { "timestamp": 1760000000, "event": "update",
           "content-state": { "phase": "playing", "status": "Mission 6", "yourTurn": false, "updatedAt": 1760000000000 } } }
```

An `end` carries `"content-state": { "phase": "ended", "status": "Game over", … }` and a
`dismissal-date` 2 minutes on. `content-state` must decode as the widget's Swift
`OgsGameActivityAttributes.ContentState` (packages/shell/ios/shared).

## Tokens

- Each activity has one row in `live_activities`. A new token for the same activity replaces the
  old one.
- A 410, `BadDeviceToken`, `Unregistered` or `ExpiredToken` deletes the row. Other refusals keep it
  (`failed` in the wide event).
- The cast ending deletes all of the session's rows after the `end` push.
- Push-to-start tokens (iOS 17.2+) reach the app's JS (`onPushToStartToken`) but aren't stored yet.
  Starting an activity from the server, for example when a game starts on the TV while the phone is
  locked, is a follow-up.
