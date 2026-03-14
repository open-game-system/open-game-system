Feature: Cast State Updates
  As a game running in the OGS WebView
  I want to push game state updates to the TV display
  So that the TV view stays in sync with the game

  Background:
    Given the game is running in the OGS mobile app WebView
    And the app-bridge cast store is registered
    And a cast session is active with:
      | session.status        | connected    |
      | session.sessionId     | session-123  |
      | session.streamSessionId | stream-456 |
      | session.deviceName    | Living Room TV |

  # Sending updates

  Scenario: Send a game state update while casting
    When the game dispatches:
      | type    | SEND_STATE_UPDATE                                      |
      | payload | { "question": "What year?", "round": 3, "timer": 30 } |
    Then the native app calls POST /api/v1/cast/sessions/session-123/state with the payload
    And the stream-kit container receives the state update
    And the headless browser re-renders the TV view
    And updated video frames stream to the TV via WebRTC

  Scenario: Send rapid consecutive state updates
    When the game dispatches SEND_STATE_UPDATE 5 times in 1 second
    Then each update is forwarded to the API
    And the headless browser re-renders after each update
    And the TV display reflects the final state

  Scenario: Send state update when no session is active
    Given the cast store state "session.status" is "disconnected"
    When the game dispatches { type: 'SEND_STATE_UPDATE', payload: { round: 1 } }
    Then no API call is made
    And the event is silently dropped

  Scenario: State update fails due to network error
    Given the API is unreachable
    When the game dispatches { type: 'SEND_STATE_UPDATE', payload: { round: 1 } }
    Then the cast store state "error" is "Failed to send state update"
    And the session remains connected (do not tear down on transient failures)

  Scenario: State update fails because session ended server-side
    Given the stream-kit container has crashed
    When the game dispatches { type: 'SEND_STATE_UPDATE', payload: { round: 1 } }
    And the API returns 404 "session_not_found"
    Then the cast store state "session.status" is "disconnected"
    And the cast store state "error" is "Stream ended unexpectedly"

  # TV view rendering

  Scenario: TV view receives initial game state on session start
    When a new cast session is created with viewUrl "https://triviajam.com/tv?code=ABCD"
    Then the headless browser loads the page with the game code in the URL
    And the TV view renders the initial state (e.g., lobby screen)
    And no explicit state update is needed for initial render

  Scenario: TV view re-renders on state update
    Given the TV view is showing round 2 question
    When a state update arrives with { "round": 3, "question": "New question" }
    Then the headless browser updates the page
    And the TV shows round 3 with the new question
    And the video stream reflects the change within 1 frame

  # Error recovery

  Scenario: Reset error
    Given the cast store state "error" is "Failed to send state update"
    When the game dispatches { type: 'RESET_ERROR' }
    Then the cast store state "error" is null
