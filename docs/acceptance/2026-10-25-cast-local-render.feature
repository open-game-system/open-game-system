# A Chromecast renders the OGS launcher itself (ADR 2026-10-25-cast-local-render).
# Proven by apps/tv/src/receiver/*.test.ts, apps/tv/e2e/receiver.e2e.ts (Chrome emulating a
# Chromecast with Google TV), e2e/tests/receiver-view.e2e.ts; on a device: docs/testing/chromecast-local-render.md.

Feature: Local rendering on a Chromecast, at the TV's render tier

  Scenario: The TV receiver measures the render tier once
    Given the OGS TV receiver starts on a Cast device
    Then it reads the device class from the user agent, the WebGL renderer and max texture size,
      a 720p frame-time probe, deviceMemory, the JS heap limit and CAF's 4K answer
    And it chooses the weakest tier any signal allows: no WebGL or software GL is minimal,
      a Chromecast with Google TV is lite (full only with 4 GB or more), an older Chromecast is minimal,
      a Chromecast Ultra or a Nest Hub is lite, a probe median over 20 ms is lite and over 40 ms minimal,
      1 GB of memory or a heap limit under 512 MB is lite, 0.5 GB is minimal
    And ?tier= on its URL overrides every signal
    And it logs receiver.tier with the tier, the reasons and the signals

  Scenario: A phone's cast frames the launcher with the tier
    When the phone sends LOAD_VIEW with the launcher URL (api, token) and its apiUrl
    Then the TV receiver frames the launcher from its own site with the same query and tier=<tier>
    And a repeated LOAD_VIEW, even while the tier is still being measured, loads it once
    And it logs receiver.view.loaded with the time since LOAD_VIEW, to the phone's API (apiUrl, else the launcher's api=)
    And a launcher that doesn't load in 30 s shows "The TV page didn't load. Try casting again." and logs receiver.view.timeout

  Scenario: Every game gets the tier in ogs:start
    Given the launcher was opened with tier=lite
    When it frames a game's TV page
    Then ogs:start carries tier "lite"
    And without tier= in its URL, ogs:start has no tier (a game draws for full)
    And profile-kit's useOgsSession() gives the tier

  Scenario: The registered Cast receiver page hands a phone's view to the TV receiver
    When a phone sends LOAD_VIEW to the receiver page registered for the Cast app
    Then it frames the TV receiver full screen and relays the view namespace to it
    And GET_STATE while it shows is answered by the TV receiver (tier, probe, fps, what loaded)
    And a laptop's PEER_OFFER takes the TV receiver down and plays the laptop's picture as before

  Scenario: The receiver reports how the cast is going
    While a view is up
    Then it logs receiver.fps each minute (fps, p50, p90, worst frame, frames over 50 ms, tier)
    And uncaught errors as receiver.error, senders leaving as receiver.sender, and why the cast ended
    And it ends the cast 20 minutes after the last phone left, and after 3 hours
