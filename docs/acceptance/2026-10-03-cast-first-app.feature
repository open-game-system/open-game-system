# Spec: docs/product-specs/ogs-app-v3.html (cast first, Playing · TV · Library, games in one stream)
# Supersedes the home screen in 2026-03-15-ogs-app-home-screen.feature (Continue section + Game Directory).

Feature: Cast-first OGS app with games inside one stream

  Background:
    Given a household "The Mumms" with Jonathan (grown-up), Juneau (kid) and Ava (little)
    And Jonathan's phone is registered to the household

  # --- M1: Library, Playing, instances ---

  Scenario: The app opens on Library when nothing is live
    Given no game Jonathan was playing is live
    When Jonathan opens the app from cold
    Then the Library tab is selected
    And the tabs read "Playing", "TV", "Library" in that order

  Scenario: The app opens on Playing when a game is live
    Given Rocket Crew is live on the living room TV
    When Jonathan opens the app from cold
    Then the Playing tab is selected
    And the first card reads "Now playing" with "Rocket Crew"

  Scenario: Play a game without a TV
    Given the TV is not cast
    When Jonathan taps a game whose manifest says tv "none" or "optional" in Library
    Then the game opens on the phone in full screen
    And swiping from the left edge returns to Library

  Scenario: A TV-required game offers casting when not cast
    Given the TV is not cast
    When Jonathan taps Rocket Crew in Library
    Then he sees "Cast to play" instead of the game

  Scenario: Add a game from the catalogue
    When Jonathan taps "+ Add games" in Library and adds Night Flight
    Then Night Flight appears in Library

  Scenario: Finished and old games leave Playing on their own
    Given an instance reported "completed" two days ago
    And an instance silent for longer than its game's instanceTtl
    And three visits to a game that reports nothing
    Then Playing shows neither of the first two
    And the unreported game appears once, not three times

  Scenario: A game reports its instance over the bridge
    When the game page calls the OGS bridge with status "suspended" and title "Day 4"
    Then the household's instances include it with title "Day 4"
    And an update without a valid household token is rejected

  # --- M2: cast first, the launcher ---

  Scenario: Cast from the TV tab before any game
    Given the TV is not cast
    When Jonathan opens the TV tab and taps Cast and picks "Living room TV"
    Then the TV shows the OGS launcher with the household's games
    And the TV tab becomes the remote
    And the session counts exactly 1 cast

  Scenario: The remote moves the TV's focus ring
    Given the launcher is on the TV
    When Jonathan presses right on the remote
    Then the focus ring on the TV moves to the next game

  Scenario: The remote says what's on the TV and what OK will do
    Given the launcher is on the TV with Rocket Crew paused and focused
    When Jonathan opens the TV tab
    Then the remote shows "Home" and "OK continues Rocket Crew"
    And it shows which TV is cast to and that he has the remote

  Scenario: Stop casting asks first
    Given the launcher is on the TV
    When Jonathan taps Stop casting on the remote
    Then he is asked to confirm, and the TV is still cast
    When he confirms
    Then the session ends, the cast stops and the TV tab offers Cast again

  Scenario: Move the evening to another TV
    Given the launcher is on "Living room TV" with Rocket Crew paused
    When Jonathan taps the TV chip on the remote and picks "Den TV"
    Then the cast stops on "Living room TV" and the launcher loads on "Den TV"
    And Rocket Crew is still paused with its resume point
    And picking the TV he's already on does nothing

  Scenario: No TV found
    Given no Chromecast is visible
    When Jonathan taps Cast
    Then he sees the likely causes and "Other ways to play"

  # --- M3: games inside the stream ---

  Scenario: Launch from the phone while cast
    Given the launcher is on the TV
    When Jonathan taps Rocket Crew in Library
    Then the phone opens Rocket Crew's start page as the controller
    And when the game asks for its TV view, the launcher frames it
    And the session still counts exactly 1 cast

  Scenario: Launch from the TV with the remote
    Given the launcher is on the TV
    When Jonathan focuses Rocket Crew with the remote and presses OK twice
    Then Jonathan's phone opens Rocket Crew's start page
    And the launcher frames the game's TV view

  Scenario: Swipe back pauses the game on the TV
    Given Rocket Crew is live and reported its resume point "Mission 6"
    When Jonathan swipes back from the left edge of the game screen
    Then the TV shows the launcher with Rocket Crew paused at "Mission 6"
    And a "Rejoin" pill shows on every tab
    And the Library row for Rocket Crew says "In progress · Mission 6"

  Scenario: Rejoin returns to the same room
    Given Jonathan hosted Rocket Crew in room "PQWS" and swiped back
    When Jonathan taps Rejoin
    Then his phone opens room "PQWS" with his Captain seat, without asking his name
    And the launcher frames the same room's TV page
    And the TV is not recast

  Scenario: Switch games without recasting
    Given Rocket Crew is paused at "Mission 6"
    When Jonathan starts Bake Shop
    Then the launcher frames Bake Shop
    And Rocket Crew stays paused with its resume point
    And the session still counts exactly 1 cast

  Scenario: Continue resumes the same sitting
    Given Rocket Crew is paused at "Mission 6"
    When Jonathan continues Rocket Crew
    Then the same instance resumes with "Mission 6"

  Scenario: The remote phone goes dark
    Given Jonathan's phone holds the remote
    And Mom's phone is connected
    When Jonathan's phone disconnects
    Then Mom's phone is offered the remote
