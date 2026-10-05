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

  Scenario: Friends lists your friends (detail in 2026-10-04-ogs-friends.feature)
    When Jonathan opens the Friends tab
    Then he sees his friends with their presence, any requests, and "Add a friend"

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
    Then the first game is a hero: its clean key art with its logo and one button
    And below it "All Games" shows every game as its 2:3 cover, three across, in library order
    And no tile has a tagline
    And nothing reads "Needs a TV"
    And there is no "+ Add games" row and no household chip

  Scenario: First run: the hero is the first game, ready to start
    Given Jonathan has never played anything
    When Jonathan opens the Library tab
    Then the hero is the first game in his library and its button reads "Play", cast or not
    And All Games lists every game in library order

  Scenario: The hero is the game you played last, one tap to rejoin
    Given Jonathan played Rocket Crew, then Bake Shop, then Night Flight
    When Jonathan opens the Library tab
    Then the hero is Night Flight
    And its button reads "Rejoin" and rejoins Night Flight's newest sitting
    And All Games keeps library order, whatever was played

  Scenario: The hero's button uses the game page's verb
    Given the TV is not cast and Jonathan has never played anything
    When Jonathan opens the Library tab
    Then the hero's button reads "Play", as the game's page does, never "Cast to play"
    And once a game was played the hero reads "Last played" and its button reads "Rejoin"
    And tapping the hero's art opens its game's page

  Scenario: The game on the TV is the hero
    Given Story Nook is on the TV now
    When Jonathan opens the Library tab
    Then the hero is Story Nook reading "On the TV now"

  Scenario: A tap in Library opens the game's page, with the tabs still there
    Given Jonathan has never played Bake Shop
    When Jonathan taps Bake Shop in Library
    Then Bake Shop's page shows its key art with its logo, its players, minutes and ages, and its tagline
    And the tab bar is still there
    And it lists no sittings
    And "Play" is pinned at the bottom of the page
    And tapping the Library tab returns to the Library list

  Scenario: The game's page lists your sittings as cards, each with Rejoin
    Given Rocket Crew is paused at "Mission 6"
    When Jonathan opens Rocket Crew's page
    Then it lists one sitting under "In progress" headed "Mission 6" with when it was last played and its own "Rejoin"
    # Owner, 2026-10-04: "Start game" is the one filled button; every Rejoin is outlined.
    And "Start game" at the bottom is the page's one filled button, and that Rejoin is outlined
    And Rejoin opens that sitting's own room

  Scenario: A sitting with no resume point is named by when it started
    Given Rocket Crew reported no resume point for a sitting started at 7:42 PM
    When Jonathan opens Rocket Crew's page
    Then that sitting is headed "Started 7:42 PM", never "In progress" again
    And its second line says when it was last played, or "On the TV now"
    And two sittings started the same minute read "Game 1" and "Game 2" with the time on the second line

  Scenario: Two sittings last played at the same time still read apart
    Given Bake Shop has "Day 3" started at 1:42 PM and an unnamed sitting started at 4:42 PM
    And both were last played just now
    When Jonathan opens Bake Shop's page
    Then the unnamed one reads "Started 4:42 PM" over "Played just now"
    And "Day 3" reads "Started 1:42 PM · just now" on its second line

  Scenario: Several sittings of one game
    Given Jonathan started Rocket Crew and swiped back
    When he starts a new game of Rocket Crew from its page and swipes back
    Then he is back on Rocket Crew's page
    And it lists two sittings, most recent first, each with its own outlined Rejoin
    And "Start game" at the bottom is the page's one filled button
    And Playing lists both, each as its own row with Rejoin

  Scenario: Play a game without a TV
    Given the TV is not cast
    When Jonathan taps Play on a game whose manifest says tv "none"
    Then the game opens on the phone in full screen, with no cast prompt
    And a tv "optional" game opens on the phone the same way once he picks "Play on this phone"
    And swiping from the left edge returns to the game's page

  # Owner, 2026-10-04: "I don't like how 'Cast to play' is the CTA... it should just be Play, and
  # then if they are not already casting, we prompt them to cast." Owner copy rule, 2026-10-04: a
  # button says Play or Cast, never both ("Cast and play" is out).
  Scenario: Play, then cast if not casting
    Given the TV is not cast
    When Jonathan opens Rocket Crew's page from Library
    Then its button reads "Play", never "Cast to play"
    When he taps Play
    Then a sheet asks "Play Rocket Crew on the TV" and lists the TVs it finds, the first one chosen
    When he picks "Living room TV" and taps "Cast"
    Then the sheet shows it is connecting to Living room TV
    And once the TV shows the launcher, Rocket Crew starts by itself and the launcher frames it
    And the session counts exactly 1 cast

  Scenario: Not now closes the cast prompt
    Given the TV is not cast
    When Jonathan taps Play on Rocket Crew's page, then "Not now"
    Then the sheet closes on Rocket Crew's page and nothing is cast

  Scenario: Rejoin asks to cast the same way
    Given the TV is not cast and Rocket Crew is paused at "Mission 6"
    When Jonathan taps Rejoin on that sitting, in Library, on its page or in Playing
    Then the same sheet asks to cast, and once cast it opens that sitting's own room
    And no row in Playing reads "Casts to the TV first": a TV game's row reads "On the TV"

  Scenario: Already casting, Play starts at once
    Given the launcher is on the TV
    When Jonathan taps Play on Bake Shop's page
    Then Bake Shop starts on the TV with no sheet, and the TV is not recast

  Scenario: The cast prompt finds no TV
    Given the TV is not cast and no Chromecast is visible
    When Jonathan taps Play on Rocket Crew's page
    Then the sheet says "Looking for TVs…", then "No TV found" with the likely causes, Try again and Open Settings

  Scenario: A game that also plays on the phone offers it
    Given the TV is not cast and a game's manifest says tv "optional"
    When Jonathan taps Play on its page
    Then the sheet offers "Cast" and "Play on this phone"
    When he taps "Play on this phone"
    Then the game opens on the phone in full screen

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

  Scenario: The remote mirrors what's on the TV and says what OK will do
    Given the launcher is on the TV with Rocket Crew paused and focused
    When Jonathan opens the TV tab
    Then the remote's "On the TV" card shows Rocket Crew's art and logo, "Paused just now" and "OK continues Rocket Crew"
    And it shows which TV is cast to and that he has the remote

  Scenario: The remote keeps Surprise me a surprise
    Given the launcher's focus is on the Surprise me card
    Then the remote shows "Surprise me" with the kids' games and "OK picks a game for the kids", never the pick

  Scenario: Stop casting asks first
    Given the launcher is on the TV
    When Jonathan taps Stop casting on the remote
    Then he is asked to confirm, and the TV is still cast
    When he confirms
    Then the session ends, the cast stops and the TV tab says "Stopped casting on Living room TV"
    And the TV tab says it the moment he confirms, without waiting for the TV's reply
    And one tap on Cast again casts to "Living room TV"

  Scenario: A Stop casting that fails brings the remote back
    Given Jonathan confirmed Stop casting and the TV tab says "Stopped casting on Living room TV"
    When the stop fails and the TV is still cast
    Then the TV tab shows the remote again

  Scenario: A phone that joined someone else's TV leaves it, never stops it
    Given Jonathan joined Mom's "Den TV" with the code on the TV
    When he opens the TV tab
    Then the remote offers "Leave Mom's TV", not Stop casting, and no Change TV
    When he taps it and confirms Leave
    Then he leaves Mom's couch and Mom's TV keeps playing

  Scenario: The TV picker searches, lists every TV, and says when there's no other
    Given the launcher is on "Living room TV"
    When Jonathan opens the TV picker
    Then it shows "Living room TV" as casting now and "Looking for TVs…" while it searches
    And "Bedroom TV" appears when it is found
    And in a house with one TV it ends with "No other TVs nearby" and Look again

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

  Scenario: A game that never opens on the TV says so, and Home comes back
    Given the launcher is on the TV
    When Jonathan starts Bake Shop and its phone page never sends the TV its view
    Then the TV shows "Getting ready · Starting Bake Shop on Jonathan's phone"
    And after 20 seconds it shows "Couldn't open · Bake Shop didn't open on the TV" with "Press Home on Jonathan's phone to come back", in the lower left, clear of the focal area
    And if the view still arrives, the launcher frames the game
    When Jonathan presses Home on the remote
    Then the TV shows the launcher home with Bake Shop paused

  Scenario: Swipe back pauses the game on the TV
    Given Rocket Crew is live and reported its resume point "Mission 6"
    When Jonathan swipes back from the left edge of the game screen
    Then the TV shows the launcher with Rocket Crew paused at "Mission 6"
    # Owner, 2026-10-04: the pill shows on TV, Friends and Profile only (supersedes "every tab").
    And a "Rejoin" pill shows on the TV, Friends and Profile tabs
    And no pill shows on Library or Playing, which already offer Rejoin
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

  Scenario: A cast left on with nobody around ends after 20 minutes
    Given the launcher is cast and streamed from the cloud GPU
    And Jonathan's phone, Mom's phone and Juneau's iPad are on the couch session
    When every phone and tablet leaves the couch session
    And nothing changes in the session and nobody presses the remote for 20 minutes
    Then the stream server ends the stream at the next heartbeat (window.__ogsActivityAt is over 20 minutes old)
    But while any phone or tablet stays on the couch session, the stream keeps running (up to the 3-hour cap)

  Scenario: The game's loading card says what the game is, not where it's served from
    Given Rocket Crew is in the catalogue with its tagline
    When Jonathan opens Rocket Crew
    Then the loading card shows "Rocket Crew" and its tagline, never its host
