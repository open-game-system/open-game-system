# Owner, 2026-10-05 (real iPhone, two Chromecasts): "when i tap the other device sometimes it works and
# sometimes it doesn't… sometimes it eventually works". Root cause: Google Cast ends a session
# asynchronously (the native endCurrentSession resolves as soon as the end is asked for) and
# GCKSessionManager.startSessionWithDevice: answers NO "if there is a session currently established",
# so starting the new TV right after asking the old one to end was refused, silently.
# Owner, 2026-10-06 (real iPhone, two Chromecasts): "if I hit Done it doesn't appear as if it is
# changing on the TV tab at the top hero graphic", and "when it's switching, the Cast to sheet seems
# unresponsive if I want to cancel and switch to a different one… should we just close the modal?"
# Root cause of the stale name: the couch session's TV name was set once when the session was
# created, and a switch keeps the same session. Now the phone names the new TV (tv.rename).
# Extends "Move the evening to another TV" in 2026-10-03-cast-first-app.feature.
# Tests: apps/mobile/services/__tests__/cast-switch.seam.test.ts (fake Cast with real end timing),
# cast-switch.test.ts, cast-flow-log.test.ts, components/ogs/remote/__tests__/remote-controls.test.ts;
# packages/ogs-protocol session.rules.test.ts (tv.rename); services/api couch-session.test.ts and
# integration/couch.test.ts; apps/tv data.test.ts and e2e/launcher.e2e.ts (header);
# Detox apps/mobile/e2e/tv-switch.test.ts.

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

  Scenario: Tapping a TV closes the sheet and the hero says what is happening
    When Jonathan taps "Bedroom TV" in the "Cast to" sheet
    Then the sheet closes at once
    And the TV tab's hero says "Switching to Bedroom TV…" until "Bedroom TV" is connected
    And the remote stays on screen while no TV is cast between the two sessions
    And then the hero names "Bedroom TV"
    And Done only closes the sheet

  Scenario: Every phone and the TV name the TV the cast moved to
    When Jonathan switches from "Living room TV" to "Bedroom TV"
    Then the couch session is named "Bedroom TV" for every client
    And the TV tab's hero, the "Cast to" sheet's casting-now row and the Playing tab's strip say "Bedroom TV"
    And a phone that joined the couch names "Bedroom TV"
    And the launcher's header on "Bedroom TV" reads "Bedroom TV · Jonathan's games"
    And a launcher that reloads, or a phone that joins later, reads "Bedroom TV" from the session

  Scenario: Only the caster's phone renames the couch's TV
    Given Juneau's iPad joined the couch
    When it sends a TV rename
    Then it is refused (host_only) and the TV keeps its name

  Scenario: Changing your mind mid-switch: the last TV tapped wins
    Given a switch to "Bedroom TV" is under way
    When Jonathan opens the "Cast to" sheet again
    Then "Bedroom TV" says "Switching to Bedroom TV…" and every other TV can still be tapped
    When he taps "Living room TV"
    Then the sheet closes and the hero says "Switching to Living room TV…"
    And the switch to "Bedroom TV" finishes first (never two switches at once)
    And then the cast moves to "Living room TV", the launcher is framed there and "Bedroom TV" is stopped
    And the hero names "Living room TV"

  Scenario: Several taps mid-switch: only the last runs next
    Given a switch to "Bedroom TV" is under way
    When Jonathan taps "Den TV" and then "Living room TV"
    Then "Den TV" is never cast to, and the evening ends on "Living room TV"
    And tapping "Bedroom TV" again instead (the TV being switched to) drops the pick in between

  Scenario: A switch that fails says so, with Try again
    Given "Bedroom TV" can't be reached
    When Jonathan picks it
    Then he sees "Couldn't switch to Bedroom TV. Is it on?" (or Cast's own reason, or "It didn't answer.")
    And on the Cast screen (the old TV is already stopped) the error has Try again, which switches again
    And while the remote is still up the error shows under the hero, with Try again

  Scenario: Picking the TV you're already on does nothing
    When Jonathan picks "Living room TV"
    Then nothing is stopped or started
