Feature: OGS App Continue Lifecycle
  As an OGS user
  I want my active games to be tracked and manageable
  So that I can resume games and clean up ones I'm done with

  # --- Adding Games to Continue ---

  Scenario: Launching a game from directory adds it to Continue
    Given "Trivia Jam" is not in the Continue list
    When the user launches "Trivia Jam" from the Game Directory
    Then "Trivia Jam" appears in the Continue list
    And the entry's last URL is the game's base URL
    And the entry's last played time is now

  Scenario: Launching a game that is already in Continue does not duplicate
    Given "Trivia Jam" is already in the Continue list
    When the user launches "Trivia Jam" from the Game Directory
    Then the Continue list still has exactly one "Trivia Jam" entry
    And the entry's last URL is updated to the game's base URL
    And the entry's last played time is updated to now

  Scenario: Opening a game from Continue updates its last played time
    Given "Chess Online" is in Continue with last played "yesterday"
    When the user taps the "Chess Online" Continue entry
    Then the entry's last played time is updated to now

  # --- URL Tracking ---

  Scenario: WebView navigation updates the Continue entry URL
    Given the user is playing "Trivia Jam" with entry URL "https://triviajam.tv"
    When the game navigates to "https://triviajam.tv/games/abc123"
    Then the Continue entry for "Trivia Jam" updates its last URL to "https://triviajam.tv/games/abc123"

  Scenario: Multiple in-game navigations track the latest URL
    Given the user is playing "Trivia Jam"
    When the game navigates to "https://triviajam.tv/lobby"
    And then navigates to "https://triviajam.tv/games/xyz789"
    Then the Continue entry's last URL is "https://triviajam.tv/games/xyz789"

  Scenario: Resuming a game opens the last tracked URL
    Given "Trivia Jam" is in Continue with last URL "https://triviajam.tv/games/abc123"
    When the user taps the "Trivia Jam" Continue entry
    Then the game screen loads "https://triviajam.tv/games/abc123"

  Scenario: Game redirecting to a different URL updates the entry
    Given the user opens "Trivia Jam" at "https://triviajam.tv/games/abc123"
    And the game redirects to "https://triviajam.tv/lobby"
    Then the Continue entry's last URL updates to "https://triviajam.tv/lobby"

  # --- Entry Name ---

  Scenario: Continue entry name defaults to page title
    Given the user launches a game that has page title "Trivia Jam - Play Now"
    Then the Continue entry name is "Trivia Jam - Play Now"

  Scenario: Continue entry name updates when page title changes
    Given the user is playing a game with title "Trivia Jam - Lobby"
    When the game navigates to a page with title "Trivia Jam - Round 3"
    Then the Continue entry name updates to "Trivia Jam - Round 3"

  Scenario: Game in directory uses directory name as fallback
    Given "Trivia Jam" is in the Game Directory
    And the game's page title is empty
    Then the Continue entry uses the directory name "Trivia Jam"

  # --- Removing Games (Swipe to Close) ---

  Scenario: Swiping a Continue entry left reveals Close action
    Given "Chess Online" is in the Continue list
    When the user swipes the "Chess Online" entry to the left
    Then a red "Close" action is revealed on the right side

  Scenario: Tapping Close removes the game from Continue
    Given the user has swiped "Chess Online" to reveal the Close action
    When the user taps "Close"
    Then "Chess Online" is removed from the Continue list
    And the remaining entries shift up

  Scenario: Cancelling swipe hides the Close action
    Given the user has partially swiped "Chess Online"
    When the user swipes back or taps elsewhere
    Then the Close action is hidden
    And "Chess Online" remains in the Continue list

  # --- Push Notification Routing ---

  Scenario: Push notification with matching URL opens existing Continue entry
    Given "Trivia Jam" is in Continue with last URL "https://triviajam.tv/games/abc123"
    And a push notification arrives with URL "https://triviajam.tv/games/abc123"
    When the user taps the notification
    Then the game screen opens "https://triviajam.tv/games/abc123"
    And the existing Continue entry is updated

  Scenario: Push notification URL matching ignores query parameters
    Given "Trivia Jam" is in Continue with last URL "https://triviajam.tv/games/abc123?turn=3"
    And a push notification arrives with URL "https://triviajam.tv/games/abc123?turn=5"
    When the user taps the notification
    Then the existing "Trivia Jam" Continue entry is matched
    And the entry's URL is updated to "https://triviajam.tv/games/abc123?turn=5"

  Scenario: Push notification with no matching URL creates new Continue entry
    Given no Continue entry matches "https://chessonline.io/game/xyz"
    And a push notification arrives with URL "https://chessonline.io/game/xyz"
    When the user taps the notification
    Then a new Continue entry is created
    And the game screen opens "https://chessonline.io/game/xyz"

  Scenario: Push notification matching uses origin + path
    Given "Trivia Jam" is in Continue with last URL "https://triviajam.tv/games/abc123"
    And a push notification arrives with URL "https://triviajam.tv/games/def456"
    When the user taps the notification
    Then a new Continue entry is created for "https://triviajam.tv/games/def456"
    And the original "Trivia Jam" entry at "/games/abc123" remains unchanged

  # --- No Auto-Aging ---

  Scenario: Old entries persist indefinitely
    Given "Block Puzzle" was last played 90 days ago
    When the home screen is displayed
    Then "Block Puzzle" still appears in the Continue list

  # --- Persistence ---

  Scenario: Continue list persists across app restarts
    Given the user has "Trivia Jam" and "Chess Online" in Continue
    When the user force-quits and relaunches the app
    Then "Trivia Jam" and "Chess Online" are still in the Continue list
    And their last URLs and last played times are preserved

  Scenario: Continue list persists through app updates
    Given the user has games in Continue
    When the app is updated to a new version
    Then the Continue list is preserved
