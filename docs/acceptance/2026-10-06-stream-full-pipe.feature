# The cloud stream end to end, on one machine: the real renderer (services/api/container/src/server.ts,
# local Chrome via Puppeteer, no GPU, no Cloud Run) captures a page and publishes it over WebRTC to the
# real TV receiver (apps/web/public/receiver.html, Cast SDK stubbed). Proven by
# e2e/tests/stream-pipe.e2e.ts. The SFU leg is a loopback stand-in by default; OGS_E2E_SFU=1 puts
# Cloudflare Realtime + TURN in the middle instead (credentials from the environment only).
# Complements 2026-10-04-cast-receiver-e2e.feature, whose stream server and SFU are all faked.

Feature: Stream full pipe (renderer to receiver)

  Background:
    Given the renderer runs locally with Chrome and its capture extension
    And a local view page animates and keeps window.__ogsActivityAt fresh while a player is active
    And the receiver is open on a stubbed Cast device

  Scenario: The renderer's picture reaches the TV and moves
    When a phone sends LOAD_VIEW with that view page
    Then the renderer opens the page and publishes its tab capture
    And the receiver plays real video frames from it
    And the decoded frame count keeps increasing
    And two frames a moment apart differ in their pixels and are not black

  Scenario: Player activity keeps the stream; no activity ends it (renderer idle stop)
    Given the stream is playing on the TV
    When the receiver's heartbeat reaches the renderer while a player is active
    Then the renderer answers it and keeps streaming
    When the page stops reporting activity for longer than the renderer's idle limit
    And the receiver's next heartbeat reaches the renderer
    Then the renderer answers 410 (idle) and closes its browser
    And the TV says the session has ended and stops the Cast app

  # Bug found here (2026-10-06): a relaunched Chrome loaded the extension's page without
  # chrome.tabs / chrome.tabCapture on ~30% of relaunches, and that cast failed.
  Scenario: A warm renderer serves every next cast after a stop
    Given the renderer stopped a stream (idle or lifetime) and closed its browser
    When the next cast asks it to prepare a publisher, eight times in a row
    Then each one relaunches Chrome and gets an offer
    And an extension page that loaded without its APIs is reloaded until it has them

  Scenario: Nothing is left running
    When a run ends, passed or failed
    Then the renderer, its Chrome and the view page server are stopped

  # Opt-in, never by default: Cloudflare Realtime SFU + TURN (billable; needs credentials in env).
  Scenario: Through Cloudflare Realtime (OGS_E2E_SFU=1)
    Given CLOUDFLARE_REALTIME_APP_ID, CLOUDFLARE_REALTIME_APP_SECRET, CLOUDFLARE_TURN_API_TOKEN and CLOUDFLARE_TURN_KEY_ID are set
    When the API's own stream routes run start-stream, subscribe and the answer against Realtime
    Then the receiver plays moving frames from the renderer through the SFU
    And without those credentials the test is skipped and says which are missing
