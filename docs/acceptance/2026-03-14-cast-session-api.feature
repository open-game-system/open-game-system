Feature: Cast Session API
  As the OGS native app
  I want to manage cast sessions via the API
  So that stream-kit containers are provisioned and torn down for TV casting

  Background:
    Given an API key "valid-key" exists for game "trivia-jam"

  # Create session

  Scenario: Create a cast session
    When I POST /api/v1/cast/sessions with auth and body:
      | deviceId | living-room-tv                      |
      | viewUrl  | https://triviajam.com/tv?code=ABCD  |
    Then the response status is 201
    And the response contains "sessionId" (a UUID)
    And the response contains "streamSessionId" (a UUID)
    And the response contains "streamUrl" (a WebSocket URL)
    And a stream-kit container is running with:
      | url      | https://triviajam.com/tv?code=ABCD  |
      | status   | rendering                           |

  Scenario: Reject create session without auth
    When I POST /api/v1/cast/sessions without Authorization header
    Then the response status is 401
    And the error code is "missing_auth"

  Scenario: Reject create session with invalid API key
    When I POST /api/v1/cast/sessions with Authorization "Bearer invalid-key"
    Then the response status is 401
    And the error code is "invalid_api_key"

  Scenario: Reject create session with missing viewUrl
    When I POST /api/v1/cast/sessions with auth and body:
      | deviceId | living-room-tv |
    Then the response status is 400
    And the error code is "missing_fields"

  Scenario: Reject create session with missing deviceId
    When I POST /api/v1/cast/sessions with auth and body:
      | viewUrl | https://triviajam.com/tv?code=ABCD |
    Then the response status is 400
    And the error code is "missing_fields"

  Scenario: Reject create session with invalid viewUrl (not HTTPS)
    When I POST /api/v1/cast/sessions with auth and body:
      | deviceId | living-room-tv                     |
      | viewUrl  | http://triviajam.com/tv?code=ABCD  |
    Then the response status is 400
    And the error code is "invalid_view_url"

  Scenario: Reject create session with invalid JSON body
    When I POST /api/v1/cast/sessions with auth and invalid JSON
    Then the response status is 400
    And the error code is "invalid_body"

  Scenario: Container provisioning fails
    Given stream-kit container provisioning will fail
    When I POST /api/v1/cast/sessions with auth and body:
      | deviceId | living-room-tv                      |
      | viewUrl  | https://triviajam.com/tv?code=ABCD  |
    Then the response status is 502
    And the error code is "stream_provisioning_failed"

  # Get session status

  Scenario: Get active session status
    Given a cast session "session-123" exists and is active
    When I GET /api/v1/cast/sessions/session-123 with auth
    Then the response status is 200
    And the response contains "sessionId" = "session-123"
    And the response contains "status" = "active"
    And the response contains "streamSessionId"
    And the response contains "streamUrl"

  Scenario: Get ended session status
    Given a cast session "session-123" existed but has been terminated
    When I GET /api/v1/cast/sessions/session-123 with auth
    Then the response status is 200
    And the response contains "status" = "ended"

  Scenario: Get nonexistent session
    When I GET /api/v1/cast/sessions/does-not-exist with auth
    Then the response status is 404
    And the error code is "session_not_found"

  # Push state update

  Scenario: Push game state update to active session
    Given a cast session "session-123" exists and is active
    When I POST /api/v1/cast/sessions/session-123/state with auth and body:
      | question   | What year was JavaScript created? |
      | round      | 3                                |
      | timeLeft   | 30                               |
    Then the response status is 200
    And the stream-kit container receives the state update
    And the headless browser re-renders the TV view

  Scenario: Push state update to ended session
    Given a cast session "session-123" has ended
    When I POST /api/v1/cast/sessions/session-123/state with auth and body:
      | question | What year? |
    Then the response status is 404
    And the error code is "session_not_found"

  Scenario: Push state update without auth
    When I POST /api/v1/cast/sessions/session-123/state without Authorization header
    Then the response status is 401
    And the error code is "missing_auth"

  Scenario: Push state update with empty body
    Given a cast session "session-123" exists and is active
    When I POST /api/v1/cast/sessions/session-123/state with auth and empty body
    Then the response status is 400
    And the error code is "missing_fields"

  # Delete session

  Scenario: Delete an active session
    Given a cast session "session-123" exists and is active
    When I DELETE /api/v1/cast/sessions/session-123 with auth
    Then the response status is 200
    And the response contains "status" = "ended"
    And the stream-kit container is torn down

  Scenario: Delete an already-ended session (idempotent)
    Given a cast session "session-123" has already ended
    When I DELETE /api/v1/cast/sessions/session-123 with auth
    Then the response status is 200
    And the response contains "status" = "ended"

  Scenario: Delete nonexistent session
    When I DELETE /api/v1/cast/sessions/does-not-exist with auth
    Then the response status is 404
    And the error code is "session_not_found"

  Scenario: Delete session without auth
    When I DELETE /api/v1/cast/sessions/session-123 without Authorization header
    Then the response status is 401
    And the error code is "missing_auth"

  # Session isolation

  Scenario: API key can only access its own sessions
    Given an API key "other-key" exists for game "other-game"
    And a cast session "session-123" was created by "valid-key"
    When I GET /api/v1/cast/sessions/session-123 with Authorization "Bearer other-key"
    Then the response status is 404
    And the error code is "session_not_found"

  # Cleanup

  Scenario: Session auto-expires after inactivity
    Given a cast session "session-123" exists and is active
    And no state updates have been sent for 30 minutes
    Then the API terminates the session
    And the stream-kit container is torn down
    And GET /api/v1/cast/sessions/session-123 returns status "ended"
