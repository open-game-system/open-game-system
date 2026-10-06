# Observability (2026-10-05): one wide event per unit of work in the API, uncaught app errors in the
# same pipeline, and sre-agent reading Workers Logs (docs/agents/observability.md).
# Tests: services/api/test/wide-event.test.ts, couch-session.test.ts, stream-container.test.ts,
# client-events.test.ts, client-error-seam.test.ts; apps/mobile/services/__tests__/js-errors.test.ts,
# apps/mobile/components/ogs/__tests__/AppErrorBoundary.test.tsx.

Feature: Errors reach the logs once, readable, without names

  Scenario: Every API request is one wide event
    When any request reaches opengame-api
    Then it writes one http.request line with the route pattern (never the path's ids or query),
      status, duration, request id, deployed version and the token's profile id
    And it is info for 1xx-4xx answers and an error for a throw or a 5xx answer

  Scenario: A failure is one error line sre-agent can group
    When a handler throws, or catches a failure and answers 5xx
    Then exactly one console.error line carries error.type and error.message (and the stack)
    And an unhandled error answers 500 internal_error in the error contract
    And emails, JWTs, token= values and bearer tokens are scrubbed from the error text

  Scenario: Couch sessions and stream containers log their own units of work
    Then each couch session frame is one couch.action line (action, session, device, profile ids)
    And the profile's name and sticker never appear in it
    And a stream route's trace id and steps ride on its request's line
    And a stream container's start, stop and error are container.* lines (a non-zero exit is an error)

  Scenario: An error the app didn't catch reaches the logs
    When the app throws outside a handler, rejects a promise nobody handles (release builds),
      or fails to render a screen
    Then the client log records app.js_error, app.unhandled_rejection or app.render_error
      with the error's type, message and stack
    And a render error shows "Something went wrong" with Try again instead of crashing
    And the API writes it once as console.error with errorType and error, and no names or tokens
    And one error repeating is reported at most 3 times a launch, and at most 20 errors a minute

  Scenario: Older app builds and the receiver are still readable
    When an error event arrives without errorType
    Then the API uses the event's name as its errorType
