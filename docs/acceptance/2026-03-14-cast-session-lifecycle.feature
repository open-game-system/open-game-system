Feature: Cast Session Lifecycle
  As a game running in the OGS WebView
  I want to start and stop casting to a nearby TV
  So that players can see the game on a big screen

  Background:
    Given the game is running in the OGS mobile app WebView
    And the app-bridge cast store is registered
    And a Chromecast named "Living Room TV" with ID "living-room-tv" is available
    And an API key "valid-key" exists for game "trivia-jam"

  # Starting a session

  Scenario: Start casting successfully
    When the game dispatches { type: 'START_CASTING', deviceId: 'living-room-tv' }
    Then the cast store state "session.status" is "connecting"
    And the native app calls POST /api/v1/cast/sessions with:
      | deviceId | living-room-tv                      |
      | viewUrl  | https://triviajam.com/tv?code=ABCD  |
    And the API spins up a stream-kit container
    And the container loads "https://triviajam.com/tv?code=ABCD" in headless Chrome
    And the API returns:
      | sessionId       | session-123           |
      | streamSessionId | stream-456            |
      | streamUrl       | wss://stream.ogs.com/456 |
    And the native app sends the streamUrl to "Living Room TV" via Cast SDK
    And the Chromecast loads the receiver page
    And the receiver connects to the WebRTC stream
    And the cast store state is updated to:
      | session.status        | connected              |
      | session.deviceId      | living-room-tv         |
      | session.deviceName    | Living Room TV         |
      | session.sessionId     | session-123            |
      | session.streamSessionId | stream-456           |
    And the CastButton shows "Connected: Living Room TV"

  Scenario: Cast store reflects connecting state while session spins up
    When the game dispatches { type: 'START_CASTING', deviceId: 'living-room-tv' }
    Then the cast store state "session.status" is "connecting" immediately
    And the CastButton shows a loading indicator
    And the CastButton is disabled

  Scenario: Stop casting
    Given a cast session is active with sessionId "session-123"
    When the game dispatches { type: 'STOP_CASTING' }
    Then the native app calls DELETE /api/v1/cast/sessions/session-123
    And the API tears down the stream-kit container
    And the native app disconnects from "Living Room TV" via Cast SDK
    And the cast store state is updated to:
      | session.status          | disconnected |
      | session.deviceId        | <null>       |
      | session.deviceName      | <null>       |
      | session.sessionId       | <null>       |
      | session.streamSessionId | <null>       |
    And the CastButton shows "Cast" (ready state)

  Scenario: Stop casting when no active session
    Given no cast session is active
    When the game dispatches { type: 'STOP_CASTING' }
    Then nothing happens
    And no API call is made

  # Session interruptions

  Scenario: Chromecast disconnects unexpectedly (device turned off)
    Given a cast session is active
    When the Chromecast goes offline
    Then the native Cast SDK reports disconnection
    And the native app calls DELETE /api/v1/cast/sessions/:id to clean up
    And the cast store state "session.status" is "disconnected"
    And the cast store state "error" is "Device disconnected"

  Scenario: Stream-kit container crashes
    Given a cast session is active with streamSessionId "stream-456"
    When the CF Container terminates unexpectedly
    Then the API detects the container is gone
    And the native app receives a session error
    And the cast store state "session.status" is "disconnected"
    And the cast store state "error" is "Stream ended unexpectedly"

  Scenario: Network connectivity lost on phone
    Given a cast session is active
    When the phone loses network connectivity
    Then the cast store state "error" is "Network connection lost"
    And the session remains in "connected" status (optimistic)
    When the phone regains network connectivity
    Then the native app checks session status via GET /api/v1/cast/sessions/:id
    And if the session is still alive, the error is cleared
    And if the session has ended, the store updates to "disconnected"

  Scenario: User switches to a different device mid-session
    Given a cast session is active on "Living Room TV"
    And an AirPlay device "Bedroom Apple TV" is also available
    When the game dispatches { type: 'START_CASTING', deviceId: 'bedroom-apple-tv' }
    Then the existing session is stopped first (DELETE /api/v1/cast/sessions/:id)
    And a new session is started on "Bedroom Apple TV"
    And the cast store reflects the new device

  # Show cast picker (native UI)

  Scenario: Show native cast picker
    When the game dispatches { type: 'SHOW_CAST_PICKER' }
    Then the native app shows the platform cast device picker UI
    And if the user selects a device, START_CASTING is triggered automatically

  Scenario: User dismisses cast picker without selecting
    When the game dispatches { type: 'SHOW_CAST_PICKER' }
    And the user dismisses the picker
    Then the cast store state is unchanged
    And no session is created
