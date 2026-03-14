Feature: Device Registration
  As the OGS mobile app
  I want to register my device and receive a signed device token
  So that game servers can send me push notifications via the token

  Scenario: Register a new device returns a device token
    Given no device exists with ID "device-abc"
    When I POST /api/v1/devices/register with:
      | ogsDeviceId | device-abc                    |
      | platform    | ios                           |
      | pushToken   | ExponentPushToken[token-123]  |
    Then the response status is 200
    And the response contains "deviceId" = "device-abc"
    And the response contains "registered" = true
    And the response contains "deviceToken" (a valid JWT)
    And the JWT payload "sub" = "device-abc"
    And the JWT payload "iss" = "ogs-api"

  Scenario: Re-register updates push token and returns new device token
    Given a device exists with ID "device-abc" and token "old-token"
    When I POST /api/v1/devices/register with:
      | ogsDeviceId | device-abc                    |
      | platform    | ios                           |
      | pushToken   | ExponentPushToken[new-token]  |
    Then the response status is 200
    And the response contains "deviceToken" (a valid JWT)
    And the device's push token in the database is "ExponentPushToken[new-token]"

  Scenario: Reject invalid platform
    When I POST /api/v1/devices/register with:
      | ogsDeviceId | device-abc |
      | platform    | windows    |
      | pushToken   | token-123  |
    Then the response status is 400
    And the error code is "invalid_platform"

  Scenario: Reject missing fields
    When I POST /api/v1/devices/register with:
      | ogsDeviceId | device-abc |
    Then the response status is 400
    And the error code is "missing_fields"

  Scenario: Reject invalid JSON
    When I POST /api/v1/devices/register with invalid JSON
    Then the response status is 400
    And the error code is "invalid_body"
