Feature: OGS App Lifecycle
  As an OGS user
  I want the app to handle backgrounding, foregrounding, and memory correctly
  So that my gaming experience is seamless

  # --- App Backgrounding / Foregrounding ---

  Scenario: Returning from background while in a game shows the game
    Given the user is playing "Trivia Jam"
    When the user switches to another app (backgrounds OGS)
    And the user returns to OGS
    Then the "Trivia Jam" game screen is displayed
    And the game content is still loaded

  Scenario: Returning from background while on home shows home
    Given the user is on the home screen
    When the user switches to another app
    And the user returns to OGS
    Then the home screen is displayed

  # --- Force Quit ---

  Scenario: Force quit and relaunch starts at home screen
    Given the user is playing "Chess Online"
    When the user force-quits the app
    And the user relaunches the app
    Then the home screen is displayed
    And "Chess Online" is still in the Continue list

  Scenario: Force quit preserves Continue list state
    Given the user has 3 games in Continue
    When the user force-quits and relaunches the app
    Then all 3 games are still in the Continue list
    With their correct last URLs and last played times

  # --- WebView Memory Management ---

  Scenario: Multiple games can be opened within a session
    Given the user opens "Trivia Jam" and swipes back to home
    And the user opens "Chess Online" and swipes back to home
    When the user taps "Trivia Jam" in Continue
    Then "Trivia Jam" loads (either from memory or fresh reload)

  Scenario: Recently used games may load faster from memory
    Given the user opened "Trivia Jam" moments ago and swiped back
    When the user taps "Trivia Jam" in Continue
    Then the game loads quickly (from cached WebView if still in memory)

  Scenario: Old games reload when evicted from memory
    Given the user has opened many games (more than the memory limit)
    And the first game has been evicted from memory
    When the user taps that game in Continue
    Then the loading screen is displayed
    And the game reloads from its last URL

  Scenario: Games handle reload gracefully
    Given a game was evicted from memory and must reload
    When the game reloads at its last URL
    Then the game is responsible for restoring its own state
    And OGS does not attempt to restore in-game state

  # --- No Internet ---

  Scenario: Home screen shows offline banner when no internet
    Given the device has no internet connection
    When the home screen is displayed
    Then a "No internet connection" banner is shown
    And Continue entries are dimmed with "Requires internet" subtitle
    And the Game Directory entries are dimmed

  Scenario: Offline banner disappears when connection restored
    Given the "No internet connection" banner is displayed
    When the device regains internet connectivity
    Then the banner is dismissed
    And Continue entries return to their normal interactive state

  Scenario: Attempting to launch a game offline shows error
    Given the device has no internet connection
    When the user taps a game in Continue
    Then the game load error screen is displayed
    And the error message mentions checking the connection

  # --- Deep Links ---

  Scenario: Deep link while app is closed launches game
    Given the app is not running
    When the user taps a deep link "https://opengame.org/open?url=https://triviajam.tv/games/abc123"
    Then the app launches
    And the game screen opens with URL "https://triviajam.tv/games/abc123"
    And a Continue entry is created for the game

  Scenario: Deep link while app is open navigates to game
    Given the user is on the home screen
    When a deep link is received for "https://triviajam.tv/games/abc123"
    Then the game screen opens with URL "https://triviajam.tv/games/abc123"

  Scenario: Deep link while playing a different game switches games
    Given the user is playing "Chess Online"
    When a deep link is received for "https://triviajam.tv/games/abc123"
    Then the game screen switches to "https://triviajam.tv/games/abc123"

  # --- Push Notification Launch ---

  Scenario: Tapping notification while app is closed launches game
    Given the app is not running
    When the user taps a push notification with URL "https://triviajam.tv/games/abc123"
    Then the app launches
    And the game screen opens with URL "https://triviajam.tv/games/abc123"

  Scenario: Tapping notification while on home screen opens game
    Given the user is on the home screen
    When the user taps a push notification with URL "https://chessonline.io/game/xyz"
    Then the game screen opens with URL "https://chessonline.io/game/xyz"
