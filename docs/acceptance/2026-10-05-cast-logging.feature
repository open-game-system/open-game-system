# Client wide events (2026-10-05): the app and the cast receiver report each cast step to the API, which
# writes one JSON line per event to Workers Logs (what the planned /sre-agent reads and fingerprints).
# Tests: services/api/test/client-events.test.ts; apps/mobile/services/__tests__/client-log.test.ts,
# cast-flow-log.test.ts, cast-sync-log.test.ts, google-cast-backend.test.ts;
# e2e/tests/receiver-events.e2e.ts.

Feature: Cast logs from the phone and the TV

  Scenario: The API writes each client event as one structured log line
    When the app POSTs a batch to /api/v1/client-events with its profile token
    Then the API answers 202 with the number accepted
    And writes each event as one JSON line: message, name, level, time, attempt id, duration, data,
      and the batch's app build, version, platform, couch session and hashed device
    And the profile id comes from the token, never from the body
    And error events go to console.error, the rest to console.log

  Scenario: Bad batches are refused with the error contract
    Then a batch that isn't JSON, has no events, more than 50, an unknown level or nested data is 400 invalid_body
    And a batch over 64 KB is 413 payload_too_large
    And the app without a token is 401 missing_auth, a bad token 401 invalid_token
    And more than 120 batches a minute from one profile (the receiver: one IP) is 429 rate_limited

  Scenario: No secret is ever logged
    Then token= values in URLs and JWT-looking strings are replaced by REDACTED, on the phone and again in the API
    And data keys named like token, secret, password, authorization or cookie are dropped
    And Chromecast and phone device ids are hashed

  Scenario: The cast lifecycle is logged with one id per attempt
    When Jonathan casts, switches TVs or stops casting
    Then the app logs discovery updates (how many TVs), start requested / resolved true|false / rejected with the error,
      end requested / resolved / rejected and how long the end took to arrive,
      Cast's own session events (starting, started, start failed with its error, ending, ended, suspended, resumed),
      LOAD_VIEW sent (the view's host, never its URL) and the receiver's REQUEST_VIEW
    And every event of one attempt carries the same attempt id
    And errors that the app used to swallow are still swallowed, but logged

  Scenario: Offline, events wait; on background they are sent
    Given the phone is offline or has no profile yet
    Then events are kept (at most 500, oldest dropped) and sent with the next flush
    And when the app goes to the background it flushes, and keeps what it could not send for the next launch

  Scenario: The TV receiver logs without credentials
    When the receiver gets LOAD_VIEW, starts or fails to start the stream, gets a heartbeat 410, or ends the cast
    Or it takes, loses or lets go of what keeps the TV awake (receiver.keepawake), or the page hides, shows or goes (receiver.visibility)
    Then it POSTs those events without a token to its stream server's API (/api/v1/client-events)
    And the API logs them as source "receiver", authenticated false
    And they carry one run id per receiver and only hosts, never the view URL

  # Owner, 2026-10-10: "didn't answer" while casting worked; the TV's lines could not be tied to
  # the phone's attempt. Tests: cast-view.test.ts, cast-flow-session.test.ts,
  # cast-prompt-outcomes.test.ts, client-events.test.ts, receiver-events.e2e.ts.
  Scenario: A cast attempt reads end to end, phone and TV joined
    When Jonathan taps Cast in the cast prompt
    Then the app logs cast.prompt.shown, confirmed and dismissed (how) under one prompt id,
      and cast.prompt.error with the reason and the copy shown when the prompt shows an error
    And cast.start.requested says the session's status, the TV it is on and the target TV (hashed)
      and what the cast does about it; cast.start.resolved says why when the start was refused
    And each LOAD_VIEW names the phone's attempt id and the couch session id
    And every receiver event after it carries them as phoneAttemptId and sessionId
    And the receiver logs receiver.launched (its version) once, receiver.sender (connected or
      disconnected, with the count), LOAD_VIEW received once per distinct view and
      receiver.load_view.ignored (why: duplicate) for a repeat, and whether a stream is playing on
      its keep-awake and visibility events
