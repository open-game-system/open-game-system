# Spec: docs/product-specs/ogs-app-v3.html (cast first, Playing · TV · Library · Friends · Profile, games in one stream)
# Five tabs: owner decision, Oct 2026 (was three). Profiles and friends: docs/product-specs/ogs-profiles.html.
# Supersedes the home screen in 2026-03-15-ogs-app-home-screen.feature (Continue section + Game Directory).

Feature: Cast-first OGS app with games inside one stream

  Background:
    # Households are gone (docs/product-specs/ogs-profiles.html): everyone has a profile, one per device.
    Given profiles Jonathan (on his phone), Mom (on her phone) and Juneau (on his iPad)
    And Jonathan's phone has his profile token

  # --- M1: Library, Playing, instances ---

  Scenario: The app opens on Library when nothing is live
    Given no game Jonathan was playing is live
    When Jonathan opens the app from cold
    Then the Library tab is selected
    And the tabs read "Playing", "TV", "Library", "Friends", "Profile" in that order

  Scenario: Profile shows you and Settings
    When Jonathan opens the Profile tab
    Then it shows his sticker, the name "Jonathan" and his @id with Edit
    And there is no list of kids (a kid's iPad has the kid's own profile)
    When Jonathan taps Settings
    Then the Settings screen opens with Notifications, Developer and About
    And closing it returns to the Profile tab

  Scenario: Friends is honestly empty until the profiles backend exists
    When Jonathan opens the Friends tab
    Then it says friends can join each other's TV and see what you're playing
    And it lists no friends
    And there is no "Add a friend" button
    When Jonathan taps "Share my profile"
    Then the share sheet offers "Jonathan wants to be friends on OGS: https://opengame.org/add/<his profile id>"

  Scenario: The app opens on Playing when a game is live
    Given Rocket Crew is live on the living room TV
    When Jonathan opens the app from cold
    Then the Playing tab is selected
    And the first card reads "Now playing" with "Rocket Crew"

  # Owner, 2026-10-04: Library is the games you have, not their state; a game's sittings live on
  # its page ("you might have say multiple games of catan going"). "+ Add games" is gone for now.
  # Owner, 2026-10-04: no "Needs a TV" (every game uses the TV), less text, "more like a steam
  # library page": one hero, then All Games as art. The game page keeps the tab bar.
  Scenario: Library shows the games you have, art first
    When Jonathan opens the Library tab
    Then the first game is a hero: its art with its name set on it and one button
    And below it "All Games" shows every game once as art with its name, and no tagline
    And nothing reads "Needs a TV"
    And there is no "+ Add games" row and no household chip

  Scenario: First run: the hero is the first game, ready to start
    Given Jonathan has never played anything
    When Jonathan opens the Library tab
    Then the hero is the first game in his library and its button reads "Start game"
    And All Games lists the games in library order

  Scenario: The hero is the game you played last, one tap to rejoin
    Given Jonathan played Rocket Crew, then Bake Shop, then Night Flight
    When Jonathan opens the Library tab
    Then the hero is Night Flight, reading when he last played it
    And its button reads "Rejoin" and rejoins Night Flight's newest sitting
    And All Games lists Night Flight, Bake Shop, Rocket Crew first, then the games he hasn't played

  Scenario: The game on the TV is the hero
    Given Story Nook is on the TV now
    When Jonathan opens the Library tab
    Then the hero is Story Nook reading "On the TV now"

  Scenario: A tap in Library opens the game's page, with the tabs still there
    Given Jonathan has never played Bake Shop
    When Jonathan taps Bake Shop in Library
    Then Bake Shop's page shows its art with its name, its players, minutes and ages, and its tagline
    And the tab bar is still there
    And it lists no sittings
    And "Start game" is pinned at the bottom of the page
    And tapping the Library tab returns to the Library list

  Scenario: The game's page lists your sittings as cards, each with Rejoin
    Given Rocket Crew is paused at "Mission 6"
    When Jonathan opens Rocket Crew's page
    Then it lists one sitting under "In progress" headed "Mission 6" with when it was last played and "Rejoin"
    And "Start game" stays pinned at the bottom
    And Rejoin opens that sitting's own room

  Scenario: A sitting with no resume point is named by when it started
    Given Rocket Crew reported no resume point for a sitting started at 7:42 PM
    When Jonathan opens Rocket Crew's page
    Then that sitting is headed "Started 7:42 PM", never "In progress" again
    And its second line says when it was last played, or "On the TV now"

  Scenario: Several sittings of one game
    Given Jonathan started Rocket Crew and swiped back
    When he starts a new game of Rocket Crew from its page and swipes back
    Then he is back on Rocket Crew's page
    And it lists two sittings, most recent first, each with its own Rejoin
    And Playing lists both, each as its own row with Rejoin

  Scenario: Play a game without a TV
    Given the TV is not cast
    When Jonathan starts a game whose manifest says tv "none" or "optional"
    Then the game opens on the phone in full screen
    And swiping from the left edge returns to the game's page

  Scenario: A TV-required game offers casting when not cast
    Given the TV is not cast
    When Jonathan opens Rocket Crew's page from Library
    Then he sees "Cast to play" instead of "Start game"
    And a Rejoin on that page casts first, then opens the sitting

  Scenario: Finished and old games leave Playing on their own
    Given an instance reported "completed" two days ago
    And an instance silent for longer than its game's instanceTtl
    And three visits to the same sitting of a game that reports nothing
    Then Playing shows neither of the first two
    And the unreported sitting appears once, not three times

  Scenario: A game reports its instance over the bridge
    When the game page calls the OGS bridge with status "suspended" and title "Day 4"
    Then Jonathan's instances include it with title "Day 4"
    And an update without a valid profile token is rejected

  # --- M2: cast first, the launcher ---

  Scenario: Cast from the TV tab before any game
    Given the TV is not cast
    When Jonathan opens the TV tab and taps Cast and picks "Living room TV"
    Then the TV shows the OGS launcher titled "Living room TV · Jonathan's games" with Jonathan's games
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
    When Jonathan starts a new game of Rocket Crew from its page
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
    And Rocket Crew's page lists that sitting as "Mission 6" with Rejoin

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
