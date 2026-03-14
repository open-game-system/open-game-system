Feature: Cast UI Components
  As a game developer using cast-kit-react
  I want pre-built React components for casting
  So that I can add TV casting to my game with minimal code

  Background:
    Given the game is wrapped in a BridgeContext.Provider
    And the app-bridge cast store is registered

  # CastButton

  Scenario: CastButton hidden when no devices available
    Given the cast store state "isAvailable" is false
    Then the CastButton renders nothing

  Scenario: CastButton shown when devices available
    Given the cast store state "isAvailable" is true
    And the cast store state "session.status" is "disconnected"
    Then the CastButton renders a "Cast" button
    And the button is enabled

  Scenario: CastButton tap dispatches SHOW_CAST_PICKER when multiple devices
    Given the cast store has 2+ devices
    And the cast store state "session.status" is "disconnected"
    When the user taps the CastButton
    Then { type: 'SHOW_CAST_PICKER' } is dispatched to the cast store

  Scenario: CastButton tap dispatches START_CASTING when single device
    Given the cast store has exactly 1 device with ID "living-room-tv"
    And the cast store state "session.status" is "disconnected"
    When the user taps the CastButton
    Then { type: 'START_CASTING', deviceId: 'living-room-tv' } is dispatched

  Scenario: CastButton shows connecting state
    Given the cast store state "session.status" is "connecting"
    Then the CastButton shows a loading indicator
    And the button is disabled

  Scenario: CastButton shows connected state
    Given the cast store state "session.status" is "connected"
    And the cast store state "session.deviceName" is "Living Room TV"
    Then the CastButton shows "Living Room TV" as connected
    And the button is enabled (tapping will stop casting)

  Scenario: CastButton tap while connected dispatches STOP_CASTING
    Given the cast store state "session.status" is "connected"
    When the user taps the CastButton
    Then { type: 'STOP_CASTING' } is dispatched to the cast store

  # DeviceList

  Scenario: DeviceList renders available devices
    Given the cast store state "devices" contains:
      | id              | name           | type       |
      | living-room-tv  | Living Room TV | chromecast |
      | bedroom-tv      | Bedroom TV     | airplay    |
    Then the DeviceList renders 2 device items
    And each item shows the device name and type

  Scenario: DeviceList tap dispatches START_CASTING
    Given the DeviceList is rendered with devices
    When the user taps "Living Room TV"
    Then { type: 'START_CASTING', deviceId: 'living-room-tv' } is dispatched

  Scenario: DeviceList shows empty state
    Given the cast store state "devices" is empty
    Then the DeviceList shows "No devices found"

  Scenario: DeviceList highlights connected device
    Given device "living-room-tv" is in the list
    And the cast store state "session.deviceId" is "living-room-tv"
    Then "Living Room TV" is visually highlighted as the active device

  # CastStatus

  Scenario: CastStatus hidden when not casting
    Given the cast store state "session.status" is "disconnected"
    Then the CastStatus renders nothing

  Scenario: CastStatus shows connected device
    Given the cast store state "session.status" is "connected"
    And the cast store state "session.deviceName" is "Living Room TV"
    Then the CastStatus shows "Casting to Living Room TV"

  Scenario: CastStatus shows connecting state
    Given the cast store state "session.status" is "connecting"
    Then the CastStatus shows "Connecting..."

  Scenario: CastStatus shows error
    Given the cast store state "error" is "Stream ended unexpectedly"
    Then the CastStatus shows the error message

  # Hooks

  Scenario: useCastState returns full state
    When a component calls useCastState()
    Then it receives the complete CastState object
    And it re-renders when any cast state changes

  Scenario: useCastSession returns only session
    When a component calls useCastSession()
    Then it receives only the session object { status, deviceId, deviceName, sessionId, streamSessionId }
    And it does NOT re-render when devices change (only session changes)

  Scenario: useCastDevices returns only devices
    When a component calls useCastDevices()
    Then it receives the devices array
    And it does NOT re-render when session changes (only device list changes)

  Scenario: useCastAvailable returns availability boolean
    When a component calls useCastAvailable()
    Then it receives a boolean
    And it only re-renders when isAvailable changes

  Scenario: useCastDispatch returns stable dispatch function
    When a component calls useCastDispatch()
    Then it receives a dispatch function
    And the function reference is stable across re-renders
