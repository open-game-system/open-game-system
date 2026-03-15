Feature: OGS App Game Screen
  As an OGS user
  I want to play web games in a full-screen experience
  So that the game feels native and immersive

  # --- Full Bleed WebView ---

  Scenario: Game screen shows zero OGS chrome
    When a game is loaded in the game screen
    Then the WebView fills the entire screen
    And no OGS header, back button, or navigation bar is visible
    And only the iOS status bar is shown

  Scenario: Game content renders from the game's URL
    Given the user launches "Trivia Jam" with URL "https://triviajam.tv"
    When the game screen is displayed
    Then the WebView source is "https://triviajam.tv"

  # --- Loading State ---

  Scenario: Loading screen shows while game loads
    When the user launches a game
    Then a loading screen is displayed with:
      | game icon        |
      | game name        |
      | origin domain    |
      | progress bar     |
    And the loading screen is shown until the WebView finishes loading

  Scenario: Loading screen transitions to game content
    Given the loading screen is displayed for "Trivia Jam"
    When the WebView finishes loading
    Then the loading screen is dismissed
    And the game content is visible

  # --- Load Error ---

  Scenario: Error screen shows when game fails to load
    Given the WebView fails to load "https://triviajam.tv"
    When the load timeout or error occurs
    Then an error screen is displayed with:
      | error icon                                          |
      | heading "Couldn't load game"                        |
      | message mentioning the domain and suggesting retry  |
      | "Try Again" button                                  |
      | "Go Home" link                                      |

  Scenario: Tapping Try Again reloads the game URL
    Given the error screen is displayed
    When the user taps "Try Again"
    Then the loading screen is displayed again
    And the WebView attempts to reload the game URL

  Scenario: Tapping Go Home returns to the home screen
    Given the error screen is displayed
    When the user taps "Go Home"
    Then the home screen is displayed

  # --- Swipe Hint Overlay ---

  Scenario: Swipe hint overlay shows on first game entry in session 1
    Given this is the user's 1st app session
    And the user has not entered a game in this session
    When a game finishes loading in the game screen
    Then a swipe hint overlay appears on the left side of the screen
    And the overlay shows a left-pointing arrow
    And the overlay shows text "Swipe to go home"
    And the overlay shows text "Tap anywhere to dismiss"
    And the overlay covers approximately the left half of the screen
    And the overlay fades to transparent toward the right

  Scenario: Tapping the swipe hint overlay dismisses it
    Given the swipe hint overlay is displayed
    When the user taps anywhere on the screen
    Then the overlay is dismissed
    And the game content is fully interactive

  Scenario: Swipe hint overlay only shows once per session
    Given the user has already dismissed the swipe hint in this session
    When the user returns to home and opens another game
    Then the swipe hint overlay is not displayed

  Scenario: Swipe hint overlay shows for the first 5 sessions
    Given this is the user's 5th app session
    When the user enters a game for the first time in this session
    Then the swipe hint overlay is displayed

  Scenario: Swipe hint overlay stops after 5 sessions
    Given this is the user's 6th app session
    When the user enters a game for the first time in this session
    Then the swipe hint overlay is not displayed

  # --- Swipe Back Gesture ---

  Scenario: Swiping from left edge returns to home screen
    Given the user is in the game screen
    When the user drags from the far left edge of the screen toward the right
    Then the home screen peeks from underneath as the game slides right
    And releasing the drag past the threshold completes the transition
    And the home screen is fully displayed

  Scenario: Cancelling swipe back returns to game
    Given the user is in the game screen
    When the user drags from the left edge partway
    And drags back to the left before crossing the threshold
    Then the game screen snaps back to full screen
    And the game continues playing

  Scenario: Swipe back always goes to OGS home regardless of in-game navigation
    Given the user is in the game screen
    And the game has navigated to a sub-page within its own UI
    When the user swipes back from the left edge
    Then the home screen is displayed
    And the game's internal navigation state is not affected

  Scenario: Android back button returns to home screen
    Given the user is in the game screen on Android
    When the user presses the system back button or swipes the system back gesture
    Then the home screen is displayed

  # --- Push Notification While In Game ---

  Scenario: Push notification from another game shows as banner
    Given the user is playing "Trivia Jam"
    And a push notification arrives for "Chess Online" with message "It's your turn!"
    Then a notification banner appears at the top of the game screen
    And the banner shows the Chess Online icon, name, and message
    And the game content remains visible behind the banner

  Scenario: Tapping push notification banner switches to that game
    Given a push notification banner is displayed for "Chess Online"
    When the user taps the banner
    Then the game screen switches to "Chess Online"
    And "Chess Online" is loaded at the URL from the notification payload

  Scenario: Push notification banner auto-dismisses
    Given a push notification banner is displayed
    When the user does not interact with it
    Then the banner automatically dismisses after a few seconds
    And the game continues normally

  # --- No Internet While In Game ---

  Scenario: Game handles its own connectivity errors
    Given the user is playing a game
    When the device loses internet connectivity
    Then OGS does not show its own error overlay
    And the game's own error handling is responsible for the user experience
