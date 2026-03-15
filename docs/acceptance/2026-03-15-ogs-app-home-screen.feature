Feature: OGS App Home Screen
  As an OGS user
  I want to see my active games and browse the game directory
  So that I can quickly resume or start new games

  # --- Empty State ---

  Scenario: First-time user sees empty state with welcome message
    Given the user has completed onboarding
    And the user has no games in Continue
    When the home screen is displayed
    Then the OGS logo and "OGS" title are shown in the header
    And a hamburger menu icon is shown in the header
    And a welcome message reads "Welcome to OGS"
    And the body text reads "Play web games with native superpowers. Pick a game below to get started."
    And the Game Directory section is displayed below

  Scenario: Empty state does not show Continue section
    Given the user has no games in Continue
    When the home screen is displayed
    Then the "Continue" section heading is not displayed

  # --- Game Directory ---

  Scenario: Game Directory shows all registered games
    When the home screen is displayed
    Then the "Game Directory" section heading is displayed
    And each game entry shows:
      | game icon placeholder | game name | short description | Play button |

  Scenario: Game Directory is a static list shipped with the app
    Given the device has no internet connection
    When the home screen is displayed
    Then the Game Directory section still shows all games

  Scenario: Tapping Play on a directory entry opens the game detail screen
    Given the Game Directory shows "Trivia Jam"
    When the user taps "Play" on "Trivia Jam"
    Then the game detail screen for "Trivia Jam" is displayed

  # --- Continue Section ---

  Scenario: Continue section appears when user has active games
    Given the user has played "Trivia Jam" previously
    When the home screen is displayed
    Then the "Continue" section heading is displayed above the Game Directory
    And "Trivia Jam" appears in the Continue list

  Scenario: Continue entries show game name and recency
    Given the user has "Trivia Jam" in Continue with last played "2 hours ago"
    When the home screen is displayed
    Then the "Trivia Jam" entry shows the game icon, name, and "Played 2 hours ago"

  Scenario: Continue entries are ordered by most recently played
    Given the user has the following games in Continue:
      | game          | last_played     |
      | Chess Online  | 1 day ago       |
      | Trivia Jam    | 2 hours ago     |
      | Block Puzzle  | 3 days ago      |
    When the home screen is displayed
    Then the Continue list order is:
      | Trivia Jam   |
      | Chess Online |
      | Block Puzzle |

  Scenario: Tapping a Continue entry opens the game at its last URL
    Given "Trivia Jam" is in Continue with last URL "https://triviajam.tv/games/abc123"
    When the user taps the "Trivia Jam" Continue entry
    Then the game screen opens with URL "https://triviajam.tv/games/abc123"

  Scenario: Continue list does not age out entries automatically
    Given "Block Puzzle" was last played 30 days ago
    When the home screen is displayed
    Then "Block Puzzle" still appears in the Continue list

  # --- Single Game Edge Case ---

  Scenario: Home screen works with a single game in Continue
    Given the user has only "Trivia Jam" in Continue
    When the home screen is displayed
    Then the Continue section shows exactly one entry
    And the Game Directory section is displayed below

  # --- Layout ---

  Scenario: Home screen is a single scrollable view
    Given the user has 3 games in Continue and 4 games in the Directory
    When the home screen is displayed
    Then all content is in a single vertical scroll view
    And there are no tab bars or bottom navigation

  # --- Navigation ---

  Scenario: Tapping hamburger menu opens settings
    When the user taps the hamburger menu icon
    Then the Settings screen is displayed

  Scenario: Home screen shows on app cold start after onboarding
    Given the user has completed onboarding
    When the user force-quits and relaunches the app
    Then the home screen is displayed
