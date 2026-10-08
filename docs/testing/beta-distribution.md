# Beta distribution: setup and day-to-day

How testers get the OGS app (ADR: [2026-10-07-beta-distribution](../adrs/2026-10-07-beta-distribution.md)).
After setup, merging to `main` is the whole release process:

| Change | What CI does | What testers see |
|---|---|---|
| JavaScript only (native fingerprint unchanged) | `eas update --channel beta` | The update loads at the next launch (up to 3 s wait) or when they come back to the app (not mid-cast) |
| Native (new module, SDK bump, app.json/eas.json native fields) | Build on a GitHub runner → TestFlight / Firebase → record the release | Older apps show **Update OGS** → TestFlight / App Tester |

Watch it: GitHub → Actions → **Mobile Beta Release**. Run it by hand with **Run workflow**
(`workflow_dispatch`), e.g. to rebuild before TestFlight's 90-day expiry.

## One-time setup

Done (2026-10-07): Firebase project `opengame-35033` (Android app `org.opengame.app`, group
`testers`, service account `ogs-app-distribution`), `RELEASE_TOKEN` (GitHub + Worker),
`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_ANDROID_APP_ID`, `ANDROID_UPDATE_URL`, the Android
`beta` keystore on EAS. Open: iOS credentials, `EXPO_TOKEN`, App Store Connect (app, API key,
TestFlight group, `ASC_*`, `IOS_UPDATE_URL`).

Steps marked **(you)** need an Apple, Google or Expo login.

### 1. Expo

1. **(you)** `cd apps/mobile && npx eas-cli login` (account with access to `open-game-system`).
2. **(you)** Create an access token: expo.dev → Account settings → Access tokens → GitHub secret
   `EXPO_TOKEN`.
3. **(you)** Store the build credentials on EAS (signing happens on GitHub's runners with them):
   `npx eas-cli credentials -p ios` → profile **beta** → set up a distribution certificate and an
   App Store provisioning profile for `org.opengame.app`; `npx eas-cli credentials -p android` →
   **beta** → generate a keystore.

### 2. App Store Connect (TestFlight)

1. **(you)** App Store Connect → Apps → **+** → New App, bundle ID `org.opengame.app`. Nothing is
   published; this is only where TestFlight builds live. Copy the **Apple ID** (a number, App
   Information page) → GitHub **variable** `ASC_APP_ID`.
2. **(you)** Users and Access → Integrations → App Store Connect API → generate a key with role
   **App Manager**. Download the `.p8` once.
   - GitHub secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the file's contents).
   - EAS (for `eas submit`): `npx eas-cli credentials -p ios` → App Store Connect API Key → add the
     same key.
3. **(you)** TestFlight → Internal Testing → **+** a group (e.g. "Family"), turn on automatic
   distribution, add testers (they need App Store Connect users). For friends: External Testing → a
   group → enable the **public link**.
4. GitHub **variable** `IOS_UPDATE_URL`: the public link (`https://testflight.apple.com/join/…`).
   With internal testers only, use `https://testflight.apple.com/` (opens the TestFlight app).

### 3. Firebase App Distribution (Android)

1. **(you)** console.firebase.google.com → Add project (Analytics off) → Add app → Android, package
   `org.opengame.app`. Copy the **App ID** (`1:…:android:…`) → GitHub **variable**
   `FIREBASE_ANDROID_APP_ID`.
2. **(you)** App Distribution → Get started → Testers & Groups → a group with alias **`testers`**,
   add emails. GitHub **variable** `ANDROID_UPDATE_URL`: `https://appdistribution.firebase.google.com/testerapps`
   (the tester's list of apps and their latest builds).
3. **(you)** Google Cloud console (same project) → IAM → Service accounts → create one with role
   **Firebase App Distribution Admin** → Keys → JSON → GitHub secret
   `FIREBASE_SERVICE_ACCOUNT_JSON` (the file's contents).

### 4. The API's release token

```bash
openssl rand -hex 32
```

Put the value in both places:

- GitHub secret `RELEASE_TOKEN`
- the Worker: `cd services/api && npx wrangler secret put RELEASE_TOKEN`

Until `EXPO_TOKEN` and `RELEASE_TOKEN` exist the workflow only prints a notice.

## Testers

- **iPhone/iPad:** install TestFlight, open the invite (or public link), Install. In TestFlight →
  OGS → turn on **Automatic Updates**.
- **Android:** open the Firebase invite email → App Tester → Download. Allow installs from App
  Tester when asked.
- Existing Diawi/ad-hoc installs have the same bundle ID: installing from TestFlight replaces them.

## Troubleshooting

- **"The build's runtime version … is not the planned fingerprint"**: the fingerprint CI computed
  on Ubuntu differs from the one the build embedded. Compare
  `pnpm exec expo-updates runtimeversion:resolve --platform ios --debug` on both and add the
  differing source to `.fingerprintignore`.
- **409 `stale_build`**: a newer build is already recorded; the older run lost the race. Nothing to do.
- **The app says Update OGS but TestFlight has nothing new**: the tester isn't in the TestFlight
  group the build went to, or the external build is waiting for beta review.
- Clear the gate (e.g. a bad record): `wrangler d1 execute opengame-api-db --remote --command "DELETE FROM app_releases WHERE platform='ios'"`.
