Feature: Send Push Notification
  As a game server
  I want to send push notifications to players using their device tokens
  So that they know when games start or new questions are ready

  Background:
    Given an API key "valid-key" exists for game "trivia-jam"
    And a device "device-abc" exists with platform "ios" and push token "ExponentPushToken[token-123]"
    And a valid device token JWT exists for device "device-abc"

  # Auth

  Scenario: Reject request without auth
    When I POST /api/v1/notifications/send without Authorization header
    Then the response status is 401
    And the error code is "missing_auth"

  Scenario: Reject request with invalid API key
    When I POST /api/v1/notifications/send with Authorization "Bearer invalid-key"
    Then the response status is 401
    And the error code is "invalid_api_key"

  # Device token validation

  Scenario: Reject invalid device token (bad signature)
    When I send a notification with a tampered device token
    Then the response status is 401
    And the error code is "invalid_device_token"

  Scenario: Reject malformed device token (not a JWT)
    When I send a notification with deviceToken "not-a-jwt"
    Then the response status is 401
    And the error code is "invalid_device_token"

  # Validation

  Scenario: Reject missing notification fields
    When I POST /api/v1/notifications/send with auth and body:
      | deviceToken | <valid-jwt> |
    Then the response status is 400
    And the error code is "missing_fields"

  Scenario: Reject missing device token
    When I POST /api/v1/notifications/send with auth and body:
      | notification.title | Hello |
      | notification.body  | World |
    Then the response status is 400
    And the error code is "missing_fields"

  Scenario: Reject invalid JSON body
    When I POST /api/v1/notifications/send with auth and invalid JSON
    Then the response status is 400
    And the error code is "invalid_body"

  # Device lookup

  Scenario: Return 404 when device token references deleted device
    Given device "device-abc" has been deleted from the database
    When I send a notification with the original device token
    Then the response status is 404
    And the error code is "device_not_found"

  # Successful delivery

  Scenario: Send notification successfully
    Given the Expo Push API will accept the push
    When I send a notification with:
      | deviceToken | <valid-jwt-for-device-abc>      |
      | title       | Your turn!                      |
      | body        | Alex just played a question     |
    Then the response status is 200
    And the response contains "id" (a UUID)
    And the response contains "status" = "sent"
    And the response contains "deviceActive" = true
    And the Expo Push API received a request with:
      | to    | ExponentPushToken[token-123]   |
      | title | Your turn!                     |
      | body  | Alex just played a question    |

  Scenario: Send notification with data payload
    Given the Expo Push API will accept the push
    When I send a notification with:
      | deviceToken | <valid-jwt-for-device-abc>                     |
      | title       | Game started                                   |
      | body        | Join now!                                      |
      | data        | {"gameId": "game-xyz", "action": "join"}       |
    Then the response status is 200
    And the Expo Push API received data:
      | gameId | game-xyz |
      | action | join     |

  # Push failures and device lifecycle

  Scenario: Device not registered — cleanup and flag inactive
    Given the Expo Push API will return "DeviceNotRegistered" error
    When I send a notification with the device token
    Then the response status is 502
    And the error code is "push_failed"
    And the response contains "deviceActive" = false
    And device "device-abc" is deleted from the database

  Scenario: Message too big — flag active, keep device
    Given the Expo Push API will return "MessageTooBig" error
    When I send a notification with the device token
    Then the response status is 502
    And the error code is "push_failed"
    And the response contains "deviceActive" = true
    And device "device-abc" still exists in the database

  Scenario: Network error to Expo — flag active, keep device
    Given the Expo Push API is unreachable
    When I send a notification with the device token
    Then the response status is 502
    And the error code is "push_failed"
    And the response contains "deviceActive" = true
    And device "device-abc" still exists in the database
