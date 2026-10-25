# The TV receiver (apps/web/public/receiver.html), proven by e2e/tests/receiver-*.e2e.ts.
# Supersedes nothing; complements 2026-03-14-cast-receiver.feature with the current
# LOAD_VIEW / PEER_OFFER protocol and the stops that end a cast left on in an empty room.
# 2026-10-25: no cloud renderer (ADR 2026-10-25-local-rendering-only). A phone's page is rendered on
# the Chromecast itself, by the OGS TV receiver this page frames (ADR 2026-10-25-cast-local-render,
# 2026-10-25-cast-local-render.feature); it replaced the not-yet state of PR #55.

Feature: Cast receiver

  Background:
    Given the receiver is open on a Cast device

  # Phone path (LOAD_VIEW)
  Scenario: The receiver asks for a view until one arrives
    When no sender has said what to show
    Then it sends REQUEST_VIEW with accepts ["view", "peer", "peer-canvas"] every 1.5 seconds
    And a sender that connects is asked at once
    And once LOAD_VIEW arrives it stops asking

  Scenario: A phone's view is rendered on the TV, and no renderer is asked
    When a phone sends LOAD_VIEW with a viewUrl and an apiUrl
    Then the page frames the OGS TV receiver "https://ogs-tv.pages.dev/receiver?host=parent" full screen
    And relays that LOAD_VIEW to it, as sent, with the sender's id
    And a repeat of the same view is not relayed again, a new view goes to the same frame
    And while it shows, GET_STATE is answered by the TV receiver to the sender that asked
    And the TV receiver asking to stop ends the cast and takes its frame down
    And the page makes no request to any renderer or stream server
    And an older app's LOAD_VIEW (streamServerUrl, no apiUrl) is treated the same way

  Scenario: A phone's view replaces a laptop's picture, and a laptop's offer replaces a phone's view
    Given a laptop's picture is playing
    When a phone sends LOAD_VIEW
    Then the picture goes and the TV receiver is framed
    When a laptop then sends PEER_OFFER
    Then the TV receiver's frame goes

  # Owner, 2026-10-05: the old default view (Trivia Jam) opened on a real TV when the phone was slow.
  Scenario: No default view: the TV only shows what a sender asks for
    When no sender says anything for a minute
    Then it shows nothing on its own and calls nothing
    And it still says "Waiting for the game..." and keeps asking for a view
    And a GET_STATE probe gets the state (started: false) and nothing starts

  # Laptop path (PEER_OFFER)
  Scenario: A laptop streams its tab straight to the TV
    When a laptop sends PEER_OFFER
    Then the receiver answers it (PEER_ANSWER, to that laptop only) and plays its frames
    And the page makes no other request

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
  Scenario: No phone for 20 minutes
    When the last phone or tablet disconnects and none returns for 20 minutes
    Then the receiver ends the cast: "This TV session has ended", Cast closed
    But a phone that returns in time resets the 20 minutes

  Scenario: Three hours at most
    When a cast has run for 3 hours, phones connected or not
    Then the receiver ends the cast the same way

  # Keep the TV awake (owner, 2026-10-10: Google TV's screensaver came on a few minutes into a game).
  # A WebRTC picture in a plain <video> isn't media playing to the device. e2e/tests/receiver-awake.e2e.ts.
  Scenario: A playing picture keeps the TV awake
    When the laptop's picture starts playing
    Then the receiver takes a screen wake lock (not before anything plays; a phone's view plays nothing yet)
    And it logs receiver.keepawake {method: "wakeLock", ok: true}

  Scenario: The wake lock is taken again
    When the system drops the wake lock while the page shows, or the page is hidden and shows again
    Then the receiver takes it again while the picture plays
    And logs receiver.keepawake {step: "lost"} and receiver.visibility {state} for each change

  Scenario: No wake lock: a keep-awake clip
    When the device has no Screen Wake Lock API, or refuses the request
    Then the receiver plays a tiny looping, muted, inline clip (keepawake.mp4, or .webm) out of sight
    And logs the wake lock's failure (warn, with the reason) and receiver.keepawake {method: "video", ok: true}

  Scenario: Nothing keeps the TV awake once the picture stops
    When the cast ends, the laptop stops, or a phone's view replaces the picture
    Then the wake lock is released and the clip paused, and neither is taken again until a picture plays
    And each release is logged as receiver.keepawake {step: "stop"}
