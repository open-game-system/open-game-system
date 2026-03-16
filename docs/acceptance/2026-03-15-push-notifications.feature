Feature: Push Notifications
  As a game server
  I want to send push notifications to players via the OGS API
  So that players receive timely alerts about game events

  Background:
    Given the OGS API is running
    And a valid API key exists for game "trivia-jam"

  # === Device Registration ===

  Scenario: Mobile app registers a device
    Given a user opens the OGS app for the first time
    When the app generates a stable device ID
    And requests push notification permission from the OS
    And receives an Expo push token
    Then the app calls POST /api/v1/devices/register with platform, push token, and device ID
    And the API returns a signed JWT device token
    And the device is stored in the database

  Scenario: Device re-registers with new push token
    Given a device was previously registered
    When the OS rotates the push token
    Then the app calls POST /api/v1/devices/register with the same device ID but new push token
    And the API updates the push token in the database
    And returns a new signed JWT device token

  # === Sending Notifications ===

  Scenario: Game server sends a push notification
    Given a device is registered with a valid push token
    When the game server calls POST /api/v1/notifications/send
    With a valid API key, device token JWT, title, and body
    Then the API looks up the device by ID from the JWT
    And sends the notification via Expo Push Service
    And returns { status: "sent" }

  Scenario: Notification includes game URL for deep linking
    Given a device is registered
    When the game server sends a notification with data.url field
    Then the notification payload includes the URL
    And tapping the notification in the OGS app opens the game

  # === Error Handling ===

  Scenario: Notification rejected — missing auth
    When a request is sent without an Authorization header
    Then the API returns 401 with code "missing_auth"

  Scenario: Notification rejected — invalid API key
    When a request is sent with an invalid API key
    Then the API returns 401 with code "invalid_api_key"

  Scenario: Notification rejected — tampered device token
    Given the device token JWT has been tampered with
    When the game server sends a notification
    Then the API returns 401 with code "invalid_device_token"

  Scenario: Notification rejected — device not found
    Given the device token JWT references a device not in the database
    When the game server sends a notification
    Then the API returns 404 with code "device_not_found"

  # === Device Cleanup ===

  Scenario: Device auto-deleted when push token is invalid
    Given a device is registered but the push token is expired
    When the game server sends a notification
    And Expo returns "DeviceNotRegistered"
    Then the API deletes the device from the database
    And returns { status: "sent" } (best-effort delivery)

  Scenario: Device auto-deleted on invalid credentials
    Given a device is registered but credentials are invalid
    When the game server sends a notification
    And Expo returns "InvalidCredentials"
    Then the API deletes the device from the database

  # === Token Lifecycle ===

  Scenario: Device token JWT is validated on every notification
    Given a notification request includes a device token JWT
    When the API validates the JWT
    Then it verifies the signature using OGS_JWT_SECRET
    And extracts the device ID from the JWT claims
    And rejects expired or malformed tokens

  Scenario: Stable device ID persists across app reinstalls
    Given the user reinstalls the OGS app
    When the app starts
    Then it retrieves the existing device ID from SecureStore
    And re-registers with the same device ID
    And the API updates the existing device record
