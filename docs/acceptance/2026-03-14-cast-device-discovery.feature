Feature: Cast Device Discovery
  As a game running in the OGS WebView
  I want to know when castable devices are nearby
  So that I can show a Cast button to the player

  Background:
    Given the game is running in the OGS mobile app WebView
    And the app-bridge cast store is registered

  # Availability

  Scenario: No cast devices on the network
    Given no Chromecast or AirPlay devices are on the local network
    Then the cast store state "isAvailable" is false
    And the cast store state "devices" is an empty array
    And the CastButton is not rendered

  Scenario: Chromecast device discovered
    Given a Chromecast named "Living Room TV" is on the local network
    When the native Cast SDK reports the device
    Then the cast store state "isAvailable" is true
    And the cast store state "devices" contains:
      | id              | name           | type       |
      | living-room-tv  | Living Room TV | chromecast |
    And the CastButton is rendered

  Scenario: AirPlay device discovered
    Given an AirPlay device named "Bedroom Apple TV" is on the local network
    When the native Cast SDK reports the device
    Then the cast store state "isAvailable" is true
    And the cast store state "devices" contains:
      | id                | name              | type    |
      | bedroom-apple-tv  | Bedroom Apple TV  | airplay |

  Scenario: Multiple devices discovered
    Given a Chromecast named "Living Room TV" is on the local network
    And an AirPlay device named "Bedroom Apple TV" is on the local network
    When the native Cast SDK reports both devices
    Then the cast store state "devices" has 2 entries

  Scenario: Device disappears from network
    Given the cast store contains device "Living Room TV"
    When "Living Room TV" goes offline
    Then the cast store state "devices" does not contain "Living Room TV"

  Scenario: Last device disappears
    Given the cast store contains only device "Living Room TV"
    When "Living Room TV" goes offline
    Then the cast store state "isAvailable" is false
    And the cast store state "devices" is an empty array
    And the CastButton is not rendered

  Scenario: Device reappears after disappearing
    Given "Living Room TV" previously disappeared from the network
    When "Living Room TV" comes back online
    Then the cast store state "isAvailable" is true
    And the cast store state "devices" contains "Living Room TV"

  # Scan request

  Scenario: Game requests device scan
    When the game dispatches { type: 'SCAN_DEVICES' }
    Then the native app triggers a Cast SDK device scan refresh

  # Not in OGS app

  Scenario: Game not running in OGS app
    Given the game is running in a regular browser (not OGS WebView)
    Then app-bridge is not supported
    And the CastButton is not rendered
