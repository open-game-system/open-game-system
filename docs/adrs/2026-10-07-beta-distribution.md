# Beta distribution: TestFlight + Firebase App Distribution, EAS Update, and a forced update

- **Date:** 2026-10-07
- **Status:** Accepted
- **Acceptance:** [2026-10-07-beta-distribution.feature](../acceptance/2026-10-07-beta-distribution.feature)
- **Setup:** [docs/testing/beta-distribution.md](../testing/beta-distribution.md)

## Context

The OGS app is not going on the App Store for a long time. Builds went out as ad-hoc IPAs (Diawi
links, or a cable): each new device's UDID had to be registered and the app re-signed, every build
meant a new link, and nothing made anyone update, so testers ran old builds against a changing API.
Android testers are coming.

## Decision

1. **iOS: TestFlight.** No App Store launch needed. Internal testers (up to 100, no review) get a
   build once Apple has processed it; the public link (external testers, up to 10,000) adds a light
   beta review for a new version. No UDIDs. Testers turn on Automatic Updates in TestFlight.
   - Rejected: the Apple Developer Enterprise Program ($299/yr, 100+ employee organisations, D-U-N-S,
     licensed for employees only; distributing to the public gets the certificate revoked and every
     install stops). Ad-hoc (Diawi, EAS internal): UDID registration, 100 devices per type per year.
2. **Android: Firebase App Distribution** (free): an APK per build, testers invited by email,
   the App Tester app. Rejected for now: Google Play internal testing ($25 once, Play auto-updates).
3. **JavaScript changes: EAS Update** on channel `beta` (free tier: 1,000 monthly active users).
   `runtimeVersion: { policy: "fingerprint" }`, so an update only reaches builds whose native code it
   runs on. The app waits up to 3 s at launch for a new update (`fallbackToCacheTimeout`) and on
   every return to the foreground downloads one and restarts on it, unless a cast is connected.
4. **Native changes: a forced update.** The API keeps one release per platform (`app_releases`:
   build, fingerprint, update URL). A build older than it shows "Update OGS" and only an Update
   button (TestFlight / Firebase App Tester link). A failed check, a 404, or a build without a native
   build number (development) never blocks.
5. **CI ships every merge** (`.github/workflows/mobile-release.yml`): compute each platform's
   fingerprint; if it equals the recorded release's, `eas update`; otherwise `eas build --local` on a
   GitHub runner (free for this public repo, no EAS build credits; macOS for iOS), upload (EAS
   Submit to TestFlight, waiting for App Store Connect's `VALID`; firebase-tools for Android), check
   that the build embeds the planned runtime version, then record the release. Recording happens only
   once testers can install the build, so nobody is asked to update to a build they cannot get.
   Build numbers come from EAS (`appVersionSource: remote`, `autoIncrement`).

## Consequences

- One merge to main reaches every tester with no cable and no link to send.
- Every native change forces every tester to update (an older build cannot run the new JavaScript).
- TestFlight builds expire after 90 days; a release more than 90 days old must be rebuilt
  (`workflow_dispatch` after bumping anything native, or a new native change).
- New secrets: `EXPO_TOKEN`, `RELEASE_TOKEN` (also the Worker secret), App Store Connect API key,
  Firebase service account. Without `EXPO_TOKEN` and `RELEASE_TOKEN` the workflow is a no-op notice.
- `eas.json` is part of the fingerprint: editing it ships a new build.
