Feature: Beta distribution: every merge reaches testers, old apps are made to update
  The OGS app is not on the App Store. Testers get it through TestFlight (iOS) and Firebase App
  Distribution (Android). CI ships every merge to main: JavaScript-only changes as an over-the-air
  update (EAS Update, channel "beta"), native changes as a new build. The API keeps one release
  record per platform; an app older than the record's build shows "Update OGS" and nothing else.
  ADR: docs/adrs/2026-10-07-beta-distribution.md

  # --- The release record (API) ---

  Scenario: No release recorded yet
    Given no release has been recorded for "ios"
    When anyone asks GET /api/v1/app-release/ios
    Then the answer is 404 with code "not_found"

  Scenario: CI records a release
    Given the API's RELEASE_TOKEN is "t0k"
    When CI sends PUT /api/v1/app-release/ios with "Bearer t0k" and build 12, fingerprint "abc", update URL "https://testflight.apple.com/join/XYZ"
    Then GET /api/v1/app-release/ios answers build 12, fingerprint "abc" and that update URL
    And the record says when it was updated

  Scenario: Only CI can record a release
    When a request sends PUT /api/v1/app-release/ios without the release token, or with the wrong one
    Then the answer is 401 with code "unauthorized" and nothing changes

  Scenario: Releases never go backwards
    Given build 12 is recorded for "ios"
    When CI records build 11 for "ios"
    Then the answer is 409 with code "stale_build" and build 12 stays recorded
    But recording build 12 again (a re-run) succeeds

  Scenario: Platforms are separate
    Given build 12 is recorded for "ios"
    Then GET /api/v1/app-release/android still answers 404
    And GET /api/v1/app-release/web answers 400 with code "invalid_platform"

  Scenario: A malformed release is refused
    When CI records a build that is not a positive whole number, an empty fingerprint or an update URL that is not https
    Then the answer is 400 with code "invalid_body"

  # --- The forced update (app) ---

  Scenario: An old build must update
    Given the app is build 11 on iOS
    And the recorded iOS release is build 12 with update URL "https://testflight.apple.com/join/XYZ"
    When the app opens, or comes back to the foreground
    Then it shows "Update OGS" over everything, with one button "Update"
    And "Update" opens the update URL (TestFlight on iOS, Firebase App Tester on Android)
    And there is no way past it until the app is updated

  Scenario: The current build plays on
    Given the app is build 12 and the recorded release is build 12
    Then the app opens normally

  Scenario: A newer build plays on
    Given the app is build 13 and the recorded release is build 12 (CI is still recording 13)
    Then the app opens normally

  Scenario: Never blocked by the check itself
    Given the release check fails (offline, API down, 404, an answer that does not parse)
    Then the app opens normally

  Scenario: Builds without a build number are never blocked
    Given the app runs in development (Expo dev client, simulator, Detox) with no native build number
    Then the app opens normally

  # --- Over-the-air updates (app) ---

  Scenario: A new JavaScript update loads at launch
    Given an update was published to the "beta" channel for this build's runtime
    When the app starts cold
    Then it waits up to 3 seconds for the update and opens on it
    And if the download takes longer, it opens on the update at the next launch

  Scenario: Coming back to the app picks up a waiting update
    Given the app was in the background
    And an update for this runtime has been published since it started
    When the app comes to the foreground and no TV cast is connected
    Then it downloads the update and restarts on it
    But while a cast is connected it keeps the update for the next launch

  Scenario: Updates only reach builds they can run on
    Given the runtime version is the native fingerprint
    Then an update made after a native change never reaches older builds; they get "Update OGS" instead

  # --- CI (.github/workflows/mobile-release.yml) ---

  Scenario: A JavaScript-only merge ships over the air
    Given a merge to main changes apps/mobile without changing the native fingerprint
    And the platform's recorded fingerprint equals the new fingerprint
    Then CI publishes "eas update" to the "beta" channel and does not build

  Scenario: A native change ships a build and forces the update
    Given a merge to main changes the native fingerprint for a platform
    Then CI builds that platform on a GitHub runner (eas build --local, profile "beta")
    And iOS uploads to TestFlight and waits until App Store Connect has finished processing it
    And Android uploads the APK to Firebase App Distribution, group "testers"
    And only then records the new build, fingerprint and update URL with the API

  Scenario: Nothing recorded yet means build
    Given the API has no release for a platform
    Then CI builds that platform
