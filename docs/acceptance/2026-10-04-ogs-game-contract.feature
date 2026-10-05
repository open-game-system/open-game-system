# Spec: docs/specification.md (The OGS game contract, §2 The TV page and §5 Rules).
# Schemas: packages/ogs-protocol/src/frame.ts. Helpers: packages/profile-kit (onOgsPause,
# getOgsSessionSource / useOgsSession, reportOgsSitting). Launcher side: apps/tv/src/launcher/frames.ts.
# Game-side seam tests: ~/src/rocket-crew/e2e/ogs-pause.seam.test.ts,
# ~/src/night-flight-owls/e2e/ogs-pause.seam.test.ts.

Feature: A game's TV page inside the OGS launcher

  Background:
    Given Jonathan is casting and the TV launcher frames Rocket Crew's TV page

  Scenario: The game gets the couch when it loads
    When the frame loads
    Then the launcher posts ogs:start with the sitting, its mode, the couch players and a game token for "rocket-crew"

  Scenario: A page that starts listening late still gets the start
    Given the TV page attached its listener after the frame's load
    When it posts ogs:ready
    Then the launcher posts ogs:start again for the current sitting

  Scenario: A parked game goes silent
    Given Rocket Crew's TV page is playing music
    When Jonathan presses Home
    Then the launcher posts ogs:suspend and keeps the frame loaded
    And every AudioContext of the page is suspended

  Scenario: Continue brings the same frame back with its sound
    Given Rocket Crew is parked
    When Jonathan continues the same sitting
    Then the launcher posts ogs:resume to the same frame, without a reload
    And the page's sound plays again

  Scenario: The game names its sitting on the TV
    When the TV page reports its sitting with title "Mission 6"
    Then the launcher records "Mission 6" as the sitting's resume point

  Scenario: Messages from another origin are ignored
    When a page on another origin posts ogs:resume-point to the launcher
    Then the launcher ignores it

  Scenario: The same page in a plain browser
    Given Rocket Crew's TV page is opened directly in a browser, not framed
    Then it never pauses, has no OGS session, and reports nowhere
    And the game still plays

  Scenario: No cast or join UI on an OGS TV
    When Rocket Crew's TV page runs inside the launcher
    Then it shows no cast button, no room code and no join QR
    And nothing covers the TV's focal area
