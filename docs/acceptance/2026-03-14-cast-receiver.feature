Feature: Cast Receiver Page
  As the OGS platform
  I want a minimal receiver page that displays a WebRTC video stream
  So that Chromecast and AirPlay devices can show game content

  # Loading

  Scenario: Receiver page loads on Chromecast
    Given the native Cast SDK sends a receiver URL to the Chromecast
    When the Chromecast loads the receiver page
    Then the page displays a loading indicator
    And the page reads the streamUrl from its launch parameters

  Scenario: Receiver page loads on AirPlay
    Given the native app sends a receiver URL to the Apple TV
    When the Apple TV loads the receiver page
    Then the page displays a loading indicator
    And the page reads the streamUrl from its launch parameters

  # WebRTC connection

  Scenario: Receiver connects to stream
    Given the receiver page has loaded with a valid streamUrl
    When WebRTC signaling completes
    Then a <video> element displays the incoming video stream
    And the loading indicator is hidden
    And the video fills the full screen (no letterboxing unless aspect ratio differs)

  Scenario: Receiver shows error on invalid streamUrl
    Given the receiver page loads with an invalid or expired streamUrl
    When WebRTC signaling fails
    Then the receiver displays an error message: "Unable to connect to game stream"
    And no video element is shown

  Scenario: Receiver shows error on stream timeout
    Given the receiver page loads with a valid streamUrl
    When no WebRTC connection is established within 15 seconds
    Then the receiver displays an error message: "Connection timed out"

  # Stream lifecycle

  Scenario: Stream ends gracefully (host stops casting)
    Given the receiver is displaying a video stream
    When the WebRTC connection closes cleanly
    Then the receiver displays: "Cast session ended"
    And the video element is removed

  Scenario: Stream drops unexpectedly
    Given the receiver is displaying a video stream
    When the WebRTC connection drops
    Then the receiver displays: "Reconnecting..."
    And attempts to reconnect via ICE restart
    And if reconnection succeeds, video resumes
    And if reconnection fails after 10 seconds, shows: "Connection lost"

  # Display

  Scenario: Receiver page has no interactive elements
    Given the receiver page is loaded and streaming
    Then there are no buttons, links, or interactive elements
    And the page is purely a video display
    And no browser chrome, scrollbars, or UI overlays are visible

  Scenario: Receiver page handles aspect ratio mismatch
    Given the stream is 1920x1080 (16:9)
    And the display is 4:3
    Then the video is letterboxed with black bars
    And no content is cropped
