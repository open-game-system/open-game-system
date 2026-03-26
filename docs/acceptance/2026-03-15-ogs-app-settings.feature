Feature: OGS App Settings
  As an OGS user
  I want to configure notifications and developer tools
  So that I can control my experience and test games

  # --- Navigation ---

  Scenario: Opening settings from hamburger menu
    Given the user is on the home screen
    When the user taps the hamburger menu icon
    Then the Settings screen is displayed
    And a close button (X) is shown in the header

  Scenario: Closing settings returns to home
    Given the user is on the Settings screen
    When the user taps the close button
    Then the home screen is displayed

  # --- Notifications Section ---

  Scenario: Settings shows notification toggles
    Given the user is on the Settings screen
    Then a "Notifications" section is displayed
    And a "Push Notifications" toggle is shown
    And a "Sounds" toggle is shown

  Scenario: Push Notifications toggle reflects system permission
    Given the user has granted notification permission to OGS
    When the Settings screen is displayed
    Then the "Push Notifications" toggle is on

  Scenario: Push Notifications toggle reflects denied permission
    Given the user has denied notification permission to OGS
    When the Settings screen is displayed
    Then the "Push Notifications" toggle is off

  Scenario: Toggling Push Notifications off disables notifications
    Given "Push Notifications" is on
    When the user toggles "Push Notifications" off
    Then OGS stops receiving push notifications
    And the toggle shows the off state

  Scenario: Toggling Sounds off mutes notification sounds
    Given "Sounds" is on
    When the user toggles "Sounds" off
    Then notification sounds are muted
    And the toggle shows the off state

  # --- Developer Section ---

  Scenario: Developer mode is off by default
    When the Settings screen is displayed
    Then the "Developer Mode" toggle is off
    And the "Debug Overlay" toggle is off and disabled (dimmed)

  Scenario: Enabling Developer Mode unlocks Debug Overlay
    Given "Developer Mode" is off
    When the user toggles "Developer Mode" on
    Then the "Debug Overlay" toggle becomes enabled (not dimmed)

  Scenario: Disabling Developer Mode disables Debug Overlay
    Given "Developer Mode" is on and "Debug Overlay" is on
    When the user toggles "Developer Mode" off
    Then the "Debug Overlay" toggle is turned off and disabled (dimmed)

  # --- Developer Tools Screen ---

  Scenario: Developer Mode adds Developer Tools access
    Given "Developer Mode" is on
    When the user navigates to Developer Tools
    Then a "Load Custom Game" section is displayed with a URL input field
    And a "Launch" button is displayed
    And a "Bridge Inspector" section shows device info
    And a "Recent URLs" section shows previously entered URLs

  Scenario: Bridge Inspector shows device information
    Given the user is on the Developer Tools screen
    Then the Bridge Inspector shows:
      | Device ID      | the device's OGS ID      |
      | Push Token     | truncated push token      |
      | Bridge Status  | "Connected" or "Disconnected" |
      | Platform       | "ios" or "android"        |
      | Cast Devices   | count of discovered devices |

  Scenario: Entering a custom URL and tapping Launch opens the game
    Given the user is on the Developer Tools screen
    When the user enters "https://localhost:3000" in the URL field
    And the user taps "Launch"
    Then the game screen opens with URL "https://localhost:3000"
    And the URL is added to Recent URLs

  Scenario: Tapping a Recent URL fills the input field
    Given the Recent URLs section shows "localhost:3000"
    When the user taps "localhost:3000"
    Then the URL input field is populated with "localhost:3000"

  # --- Debug Overlay ---

  Scenario: Debug overlay appears on game screen when enabled
    Given "Developer Mode" is on and "Debug Overlay" is on
    When the user opens a game
    Then a debug overlay panel is displayed at the bottom of the game screen
    And the overlay shows:
      | bridge   | connection status          |
      | device   | device ID                  |
      | url      | current WebView URL        |
      | activity | activity status if present |
      | cast     | cast device status         |
      | push     | truncated push token       |

  Scenario: Debug overlay can be dismissed
    Given the debug overlay is displayed on the game screen
    When the user taps the close button on the overlay
    Then the overlay is dismissed
    And the game screen returns to normal

  Scenario: Debug overlay does not appear when disabled
    Given "Debug Overlay" is off
    When the user opens a game
    Then no debug overlay is displayed

  Scenario: Debug overlay updates URL in real-time
    Given the debug overlay is displayed
    When the game navigates to a new URL
    Then the "url" field in the overlay updates to reflect the new URL

  # --- About Section ---

  Scenario: About section shows app version
    When the Settings screen is displayed
    Then an "About" section shows the app version number

  Scenario: About section links to OGS website
    When the Settings screen is displayed
    Then the About section shows an "Open Game System" link
    And a "Privacy Policy" link
