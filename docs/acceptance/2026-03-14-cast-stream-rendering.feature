Feature: Cast Stream Rendering
  As the OGS platform
  I want stream-kit to render game TV views and stream video to cast devices
  So that games look great on any TV regardless of its hardware

  # Container lifecycle

  Scenario: Stream-kit container starts and loads TV view
    Given the API receives a POST /api/v1/cast/sessions request
    When a CF Container is provisioned
    Then headless Chrome launches inside the container
    And it navigates to the provided viewUrl
    And the page finishes loading (DOMContentLoaded)
    And WebRTC signaling is initialized
    And the container reports "ready" to the API

  Scenario: Container reports ready with stream URL
    Given a container has loaded the TV view and initialized WebRTC
    Then the API returns the streamUrl to the native app
    And the streamUrl is a valid WebSocket URL for WebRTC signaling

  Scenario: Container fails to load TV view (invalid URL)
    Given the viewUrl returns a 404
    When the container tries to load it
    Then the container reports an error to the API
    And the API returns 502 "stream_provisioning_failed" to the native app

  Scenario: Container fails to load TV view (timeout)
    Given the viewUrl takes longer than 30 seconds to load
    When the container times out
    Then the container reports an error to the API
    And the API returns 502 "stream_provisioning_failed" to the native app

  # WebRTC connection

  Scenario: Chromecast receiver connects to WebRTC stream
    Given a container is running and ready
    When the Chromecast receiver page opens
    And it connects to the streamUrl via WebRTC signaling
    Then a peer connection is established
    And video frames begin flowing to the receiver
    And the TV displays the rendered game view

  Scenario: WebRTC connection drops and reconnects
    Given a WebRTC stream is active between container and Chromecast
    When the connection drops temporarily
    Then the receiver attempts reconnection via ICE restart
    And the stream resumes without a new container

  Scenario: WebRTC connection fails permanently
    Given a WebRTC stream is active
    When reconnection fails after 3 attempts
    Then the container reports the session as failed
    And the native app is notified
    And the cast store state "error" is "Stream connection lost"

  # Rendering quality

  Scenario: Container renders at appropriate resolution
    Given a cast session targets a Chromecast device
    Then the headless browser viewport is set to 1920x1080
    And video is encoded at 1080p

  Scenario: Container renders TV view updates within frame budget
    Given the TV view is loaded and streaming
    When a state update arrives
    Then the page re-renders
    And the next video frame includes the updated content
    And the update-to-display latency is under 200ms

  # Container teardown

  Scenario: Container tears down on session delete
    Given a container is running for session "session-123"
    When DELETE /api/v1/cast/sessions/session-123 is called
    Then the container process is terminated
    And the WebRTC connection is closed
    And container resources are released

  Scenario: Container tears down on inactivity timeout
    Given a container is running but has received no state updates for 30 minutes
    Then the container is automatically terminated
    And the session is marked as "ended"

  Scenario: Container cleans up on crash
    Given a container crashes (OOM, process exit)
    Then the platform detects the container is gone
    And the session is marked as "ended"
    And no orphaned resources remain
