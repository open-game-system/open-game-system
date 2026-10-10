# The TV receiver (apps/web/public/receiver.html), proven by e2e/tests/receiver-*.e2e.ts.
# Supersedes nothing; complements 2026-03-14-cast-receiver.feature with the current
# LOAD_VIEW / PEER_OFFER protocol and the stops that keep a cloud GPU from billing an empty room.

Feature: Cast receiver

  Background:
    Given the receiver is open on a Cast device

  # Phone path (LOAD_VIEW)
  Scenario: The receiver asks for a view until one arrives
    When no sender has said what to show
    Then it sends REQUEST_VIEW with accepts ["view", "peer", "peer-canvas"] every 1.5 seconds
    And a sender that connects is asked at once
    And once LOAD_VIEW arrives it stops asking

  Scenario: A phone's view plays from the phone's stream server
    When a phone sends LOAD_VIEW with a viewUrl and a streamServerUrl
    Then the receiver starts that viewUrl on that stream server with its own stream session
    And subscribes to the publisher's video and audio and answers the SFU
    And the video plays and nothing covers it

  Scenario: URL parameters override the sender
    When the receiver is opened with viewUrl (and streamServerUrl, streamUrl or publisherSessionId)
    Then it starts at once on those and asks no sender

  # Owner, 2026-10-05: the old default view (Trivia Jam) opened on a real TV when the phone was slow.
  Scenario: No default view: the TV only shows what a sender asks for
    When no sender says anything for a minute
    Then it starts no stream
    And it still says "Waiting for the game..." and keeps asking for a view
    But any sender message, even GET_STATE, keeps the default from starting

  Scenario: A failed start shows an error, not a black screen
    When the stream server fails to start, fails to subscribe, or can't be reached
    Then the TV shows "Unable to connect to game stream" without a spinner and tells the sender
    And the heartbeat stops, so the stream server can scale to zero

  # Laptop path (PEER_OFFER)
  Scenario: A laptop streams its tab straight to the TV
    When a laptop sends PEER_OFFER
    Then the receiver answers it (PEER_ANSWER, to that laptop only) and plays its frames
    And no stream server is called

  Scenario: A laptop's canvas cast draws the game's HUD on the TV
    When the offer carries an http(s) hudUrl
    Then the receiver shows that page in an iframe over the picture
    And sends it the latest HUD_MESSAGE, again when it says HUD_READY
    And a hudUrl that isn't http(s) is ignored

  Scenario: No picture from the laptop in 20 seconds
    When the laptop's picture doesn't arrive within 20 seconds
    Then the TV says so and the laptop gets PEER_ERROR "no picture after 20s"

  Scenario: The laptop stops
    When the laptop sends PEER_STOP
    Then the picture and the HUD go and the TV says "The laptop stopped casting"

  # Stops
  Scenario: The heartbeat keeps the stream server up while casting
    Then the receiver pings the stream server every minute with its stream session

  Scenario: The renderer ends an idle or 3-hour stream
    Given the streamed launcher reports player activity in window.__ogsActivityAt
    When nobody does anything for 20 minutes (or the stream reaches 3 hours)
    Then the heartbeat answers 410
    And the receiver stops pinging, shows "This TV session has ended" and closes
    But activity before then resets the 20 minutes

  Scenario: No phone for 20 minutes
    When the last phone or tablet disconnects and none returns for 20 minutes
    Then the receiver ends the cast: heartbeat stopped, "This TV session has ended", Cast closed
    But a phone that returns in time resets the 20 minutes

  Scenario: Three hours at most
    When a cast has run for 3 hours, phones connected or not
    Then the receiver ends the cast the same way

  # Keep the TV awake (owner, 2026-10-10: Google TV's screensaver came on a few minutes into a game).
  # A WebRTC picture in a plain <video> isn't media playing to the device. e2e/tests/receiver-awake.e2e.ts.
  Scenario: A playing stream keeps the TV awake
    When the phone's view or the laptop's picture starts playing
    Then the receiver takes a screen wake lock (not before anything plays)
    And it logs receiver.keepawake {method: "wakeLock", ok: true}

  Scenario: The wake lock is taken again
    When the system drops the wake lock while the page shows, or the page is hidden and shows again
    Then the receiver takes it again while the stream plays
    And logs receiver.keepawake {step: "lost"} and receiver.visibility {state} for each change

  Scenario: No wake lock: a keep-awake clip
    When the device has no Screen Wake Lock API, or refuses the request
    Then the receiver plays a tiny looping, muted, inline clip (keepawake.mp4, or .webm) out of sight
    And logs the wake lock's failure (warn, with the reason) and receiver.keepawake {method: "video", ok: true}

  Scenario: Nothing keeps the TV awake once the stream stops
    When the cast ends, the laptop stops, the stream fails, or a new page's start fails
    Then the wake lock is released and the clip paused, and neither is taken again until a stream plays
    And each release is logged as receiver.keepawake {step: "stop"}
