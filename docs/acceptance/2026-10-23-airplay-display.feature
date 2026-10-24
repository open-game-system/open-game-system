# ADR: docs/adrs/2026-10-23-airplay-display.md
# Code: packages/shell/src/airplay-*.ts, ShowOnTvSheet.tsx, ios/module/AirplayDisplay;
#       apps/mobile/services/runtime.ts; services/api/src/routes/client-events.ts
Feature: Show a game on an Apple TV through Screen Mirroring, rendered by the phone

  Background:
    Given an iPhone with the OGS app, or a game's own app with cast.airplay on
    And an Apple TV on the same Wi-Fi

  Scenario: The Apple TV is offered next to the Chromecasts
    When the TV picker searches for TVs
    And AVRouteDetector finds an AirPlay receiver
    Then "Apple TV / AirPlay" is one of the TVs
    And a home with no AirPlay receiver, no display and no Chromecast still sees "No TV found"

  Scenario: Show on TV with an Apple TV
    Given no external display is connected
    When I pick "Apple TV / AirPlay" and cast
    Then the Screen Mirroring steps open: Control Center, Screen Mirroring, my Apple TV
    And it says "Waiting for your TV…"
    When I pick my Apple TV in Control Center > Screen Mirroring
    Then the steps close by themselves
    And the TV shows the OGS TV launcher, rendered by the phone, for this couch session
    And the phone keeps showing its own screen (the game's controller), not a mirror
    And no stream server is asked for anything

  Scenario: Already mirroring
    Given the phone's display is mirrored to the Apple TV "Kitchen"
    Then the TV shows the idle card "Pick a game on your phone to show it here."
    And the picker offers "Kitchen"
    When I cast to it
    Then the launcher is on the TV at once, with no steps

  Scenario: Sound only
    Given the steps are open
    When I pick the Apple TV as the sound output instead of Screen Mirroring
    Then the steps say "That sent sound only." and "Use Screen Mirroring for the picture."

  Scenario: Not now
    Given the steps are open
    When I tap "Not now"
    Then the cast is off and nothing is on the TV

  Scenario: The launcher protocol works as on every TV
    Given the launcher is on the Apple TV
    When I start a game on the phone
    Then the launcher frames the game's TV page with ogs:start and the couch's names
    And Home on the phone parks the game (ogs:suspend) and Continue resumes it (ogs:resume)
    And the Playing tab shows the game's sitting label

  Scenario: A game's own app turns AirPlay on in its shell config
    Given the app's shell config has cast: { receiver: "ogs", airplay: true }
    Then extra.ogsShell.airplay is true and the runtime offers the Apple TV
    And casting to it shows the launcher with chrome=none&app=<appId>
    And without airplay: true nothing changes

  Scenario: While casting
    Given the launcher is on the Apple TV
    Then the phone does not auto-lock
    And neither WebView offers AirPlay media, and the Apple TV shows no "now playing" card
    When I leave the app
    Then the TV shows "Open <app> to keep the TV going" along its bottom edge
    And the phone shows the same as a notification, once per trip away
    When I come back
    Then the notice fades and the game carries on
    When I stop Screen Mirroring
    Then the cast ends on the phone
    When I tap Stop casting instead
    Then the TV shows the idle card

  Scenario: Everything the phone does for the TV is logged
    Then screen and scene connects and disconnects, display attach and resize, audio route changes,
      the sound-only check, the TV WebView's loads and failures, app state and keep-awake are
      native events in the client log, as native.<type>
    And the app's AirPlay steps are airplay.<step> events
    And no logged URL carries the launcher token

  Scenario: Claude reads a phone's log back
    Given the app posted its events under its launch id
    When an agent asks GET /api/v1/client-events?launch=<launchId> with the log key
    Then it gets that launch's last events, oldest first, redacted like Workers Logs
    And without the key it gets 403
