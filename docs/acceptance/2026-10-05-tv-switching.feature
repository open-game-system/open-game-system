# Owner, 2026-10-05 (real iPhone, two Chromecasts): "when i tap the other device sometimes it works and
# sometimes it doesn't… sometimes it eventually works". Root cause: Google Cast ends a session
# asynchronously (the native endCurrentSession resolves as soon as the end is asked for) and
# GCKSessionManager.startSessionWithDevice: answers NO "if there is a session currently established",
# so starting the new TV right after asking the old one to end was refused, silently.
# Extends "Move the evening to another TV" in 2026-10-03-cast-first-app.feature.
# Tests: apps/mobile/services/__tests__/cast-switch.seam.test.ts (fake Cast with real end timing),
# cast-switch.test.ts, cast-flow-log.test.ts; Detox apps/mobile/e2e/tv-switch.test.ts.

Feature: Switching TVs works every time

  Background:
    Given two Chromecasts, "Living room TV" and "Bedroom TV"
    And Cast ends a session a moment after it is asked to, and refuses a new start until then
    And the launcher is on "Living room TV"

  Scenario: A switch waits for the old TV's session to end, then casts the new one
    When Jonathan picks "Bedroom TV" in the TV picker
    Then the app asks Cast to end the "Living room TV" session
    And starts "Bedroom TV" only once Cast says that session has ended (at most 8 s)
    And the launcher loads on "Bedroom TV" and "Living room TV" is stopped

  Scenario: Ten switches back and forth all land
    When Jonathan switches between "Bedroom TV" and "Living room TV" ten times
    Then every switch ends with the launcher on the TV he picked and the other TV stopped
    And the phone's cast session names the TV he picked

  Scenario: The phone says what it is doing until the new TV is cast
    When Jonathan picks "Bedroom TV"
    Then its row says "Switching to Bedroom TV…" and the other rows can't be tapped
    And the remote stays on screen while no TV is cast between the two sessions
    And the picker closes once "Bedroom TV" is connected

  Scenario: Taps during a switch don't start another
    Given a switch to "Bedroom TV" is under way
    When Jonathan taps "Living room TV" and "Bedroom TV" again
    Then nothing more happens: one switch, ending on "Bedroom TV"

  Scenario: A switch that fails says so, with Try again
    Given "Bedroom TV" can't be reached
    When Jonathan picks it
    Then he sees "Couldn't switch to Bedroom TV. Is it on?" (or Cast's own reason, or "It didn't answer.")
    And on the Cast screen (the old TV is already stopped) the error has Try again, which switches again

  Scenario: Picking the TV you're already on does nothing
    When Jonathan picks "Living room TV"
    Then nothing is stopped or started
