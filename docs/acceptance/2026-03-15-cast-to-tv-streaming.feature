Feature: Cast to TV Streaming
  As a game host using the OGS companion app
  I want to cast my game to a TV via Chromecast
  So that all players can see the game on a big screen

  Background:
    Given the stream server is running (locally via Docker or Cloudflare Container)
    And the OGS API is running with STREAM_SERVER binding configured
    And the cast receiver app is hosted at a publicly accessible URL
    And the Chromecast device is on the same network

  # === Device Discovery ===

  Scenario: Cast devices are discovered
    Given the user opens a game in the OGS app
    When the native Google Cast SDK scans the local network
    Then discovered Chromecast devices appear in the cast store
    And the bridge sends STATE_INIT with isAvailable: true to the WebView
    And the CastButton renders in the game UI

  # === Cast Session Creation ===

  Scenario: User initiates casting
    Given cast devices are available
    When the user taps the CastButton in the game UI
    Then the native cast picker dialog opens
    And the user can select a Chromecast device

  Scenario: Cast session is created after device selection
    Given the user selects a Chromecast device
    When the native Google Cast SDK connects to the device
    Then sessionManager.onSessionStarted fires
    And the cast store dispatches START_CASTING with the deviceId
    And the web game receives the START_CASTING event via the bridge

  # === Stream Provisioning ===

  Scenario: Stream container is provisioned
    Given a START_CASTING event is received
    When the app calls POST /api/v1/cast/sessions with deviceId and viewUrl
    Then the API provisions a stream container via the Container binding
    And the container starts headless Chrome rendering the spectate URL
    And the API returns { sessionId, streamSessionId, streamUrl, status: "active" }

  Scenario: Stream container renders the spectate view
    Given a stream container is provisioned with a viewUrl
    When the container's headless Chrome navigates to the viewUrl
    Then the spectate view renders correctly in the headless browser
    And WebRTC signaling is available at the returned streamUrl

  # === Receiver Connection ===

  Scenario: Chromecast receiver loads and connects to stream
    Given a cast session is active with a streamUrl
    When the native app sends the receiver URL with streamUrl param to the Chromecast
    Then the Chromecast loads the receiver page
    And the receiver connects to the streamUrl via WebSocket
    And WebRTC negotiation completes (SDP offer/answer + ICE candidates)
    And the receiver displays the video stream full-screen

  Scenario: Video appears on TV
    Given the receiver is connected to the stream
    When the stream container captures the spectate view
    Then the video appears on the TV within 5 seconds
    And the video quality matches the configured render options

  # === Session Lifecycle ===

  Scenario: User stops casting
    Given casting is active
    When the user taps "Stop Casting" or disconnects
    Then the cast store dispatches STOP_CASTING
    And the app calls DELETE /api/v1/cast/sessions/:id
    And the stream container shuts down
    And the Chromecast receiver shows "Cast session ended"

  Scenario: Stream container auto-shuts down on idle
    Given a stream container is running
    When no WebRTC connections are active for 60 seconds
    Then the container gracefully shuts down
    And resources are freed

  # === Error Handling ===

  Scenario: Stream provisioning fails
    Given the stream server is unavailable
    When the app calls POST /api/v1/cast/sessions
    Then the API returns a 502 error
    And the cast store receives an error state
    And the CastButton shows an error indicator

  Scenario: WebRTC connection drops
    Given the receiver is streaming
    When the WebRTC connection is interrupted
    Then the receiver attempts ICE restart
    And if reconnection fails within 15 seconds, shows "Connection timed out"

  # === Local Development Testing ===

  Scenario: Full flow works with local Docker stream server
    Given Docker is running locally
    And the OGS API runs with wrangler dev (Container binding uses local Docker)
    And triviajam.tv is accessible (deployed or local)
    When a user creates a game in trivia-jam
    And opens it in the OGS app
    And taps the CastButton and selects a Chromecast
    Then the stream container starts in local Docker
    And the Chromecast receiver loads and displays the spectate view
    And the TV shows the live game view
