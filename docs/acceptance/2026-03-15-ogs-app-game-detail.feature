Feature: OGS App Game Detail
  As an OGS user
  I want to see information about a game before launching it
  So that I can decide whether to play

  Scenario: Game detail screen shows game information
    Given the user taps a game in the Game Directory
    Then the game detail screen is displayed
    And a "Back" navigation link is shown
    And the game hero area shows the game icon
    And the game name is displayed in large text
    And the game origin domain is shown (e.g. "by triviajam.tv")
    And category tags are displayed (e.g. "Multiplayer", "Trivia", "Live", "Castable")
    And a text description of the game is shown
    And an "OGS Features" section shows which features the game supports
    And a "Play [Game Name]" button is displayed

  Scenario: Tapping Play launches the game
    Given the user is on the game detail screen for "Trivia Jam"
    When the user taps "Play Trivia Jam"
    Then the game loading screen is displayed
    And the game's base URL is loaded in a WebView

  Scenario: Tapping Back returns to home screen
    Given the user is on the game detail screen
    When the user taps "Back"
    Then the home screen is displayed

  Scenario: OGS Features section reflects game capabilities
    Given "Trivia Jam" supports push notifications, TV casting, and activity-kit
    When the game detail screen for "Trivia Jam" is displayed
    Then the OGS Features section shows "Push Alerts", "TV Cast", and "Activity"

  Scenario: Game without all features shows only supported ones
    Given "Block Puzzle" supports only push notifications
    When the game detail screen for "Block Puzzle" is displayed
    Then the OGS Features section shows only "Push Alerts"

  Scenario: Launching from detail creates a Continue entry
    Given "Chess Online" is not in the Continue list
    When the user launches "Chess Online" from the game detail screen
    Then "Chess Online" is added to the Continue list
    And the Continue entry's URL is the game's base URL
