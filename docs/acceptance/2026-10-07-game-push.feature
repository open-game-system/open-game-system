# Status: PLANNED, not built (2026-10-07).
# Spec: docs/product-specs/push-notifications.md. ADR: docs/adrs/2026-10-07-game-push-and-app-links.md.
# Supersedes the device-token scenarios of the March 2026 push design (POST /api/v1/notifications/send).

Feature: Games notify players through OGS

  Background:
    Given "codebreakers" is in the catalogue with startUrl "https://codebreakers.example/"
    And Codebreakers' server holds an API key for "codebreakers"

  # --- Opting in ---

  Scenario: Opting in inside the OGS app
    Given Sam plays Codebreakers in the OGS app
    When Sam taps "Ping me when it's my turn again" and the page calls requestOgsNotifications()
    Then the app shows "Let Codebreakers notify you?"
    And when Sam taps Allow the page gets status "granted" and a push handle
    And the handle does not contain Sam's profile id, a device id or a push token

  Scenario: Saying no inside the app
    Given Sam plays Codebreakers in the OGS app
    When Sam taps Not now on the consent sheet
    Then the page gets status "denied" and no handle

  Scenario: Opting in from the game's PWA
    Given Alex has Codebreakers on the Home Screen of an iPad
    When Alex taps "Ping me when it's my turn again" and the page calls subscribeOgsPush()
    Then the browser asks for permission
    And the service worker subscribes with Codebreakers' VAPID public key from OGS
    And the page gets status "granted" and a push handle

  Scenario: A Safari tab on iOS cannot subscribe
    Given Alex opens Codebreakers in a Safari tab on an iPhone
    When the page calls subscribeOgsPush()
    Then it returns status "unsupported" with reason "add-to-home-screen"

  Scenario: Only the game's own site can subscribe for it
    When a page on "https://elsewhere.example" posts a subscription for "codebreakers"
    Then OGS answers 403 and stores nothing

  Scenario: Plain browser without OGS
    Given Codebreakers runs in a desktop browser with no OGS app bridge
    When the page calls requestOgsNotifications()
    Then it returns null

  Scenario: The second surface joins the same handle
    Given Jordan opted in from the PWA and the seat holds handle "ph_J"
    When Jordan opens Codebreakers in the OGS app and the page calls requestOgsNotifications({ handle: "ph_J" })
    Then the result is handle "ph_J" with an "ogs" surface added

  # --- Sending ---

  Scenario: One call, delivered to the app
    Given Sam's handle "ph_S" has only an "ogs" surface
    When Codebreakers' server sends to ["ph_S"] title "Your clue, Keyholder"
    Then Sam's phone shows "Your clue, Keyholder" from OGS
    And the response lists "ph_S" as "sent"

  Scenario: One call, delivered to the PWA
    Given Alex's handle "ph_A" has only a "web" surface
    When Codebreakers' server sends to ["ph_A"] title "Clue: RIVER · 2"
    Then Alex's iPad shows "Clue: RIVER · 2" from Codebreakers
    And the response lists "ph_A" as "sent"

  Scenario: Both surfaces, the last active one gets it
    Given Jordan's handle "ph_J" has an "ogs" surface last active yesterday and a "web" surface last active today
    When Codebreakers' server sends to ["ph_J"]
    Then only the PWA shows it

  Scenario: A dead surface falls through to the next
    Given Jordan's "web" surface is last active but the push service reports it gone
    When Codebreakers' server sends to ["ph_J"]
    Then the "web" surface is removed
    And the OGS app shows it
    And the response lists "ph_J" as "sent"

  Scenario: Nothing left to deliver to
    Given handle "ph_X" has one "web" surface and the push service reports it gone
    When Codebreakers' server sends to ["ph_X"]
    Then the response lists "ph_X" as "gone"

  Scenario: Consent turned off in the app's Settings
    Given Sam turned Codebreakers off in the OGS app's Settings
    When Codebreakers' server sends to ["ph_S"]
    Then nothing is shown on Sam's devices
    And the response lists "ph_S" as "not_permitted"

  Scenario: Never a kid
    Given June's profile is a kid's profile
    When June's iPad page calls requestOgsNotifications()
    Then it returns status "denied" and no handle
    And no handle anywhere gains a surface for June's profile

  Scenario: A key for another game
    When Rocket Crew's API key sends to "/api/v1/games/codebreakers/notifications"
    Then OGS answers 403 "wrong_game"

  Scenario: A handle from another game
    Given "ph_R" is a Rocket Crew handle
    When Codebreakers' server sends to ["ph_R"]
    Then the response lists "ph_R" as "not_permitted"

  Scenario: A url on another origin is refused
    When Codebreakers' server sends with url "https://elsewhere.example/x"
    Then OGS answers 400 "invalid_body"

  Scenario: The same tag replaces the earlier push
    When Codebreakers' server sends two pushes to ["ph_S"] with tag "codebreakers-KQTP"
    Then Sam's phone shows only the second

  # --- Arriving while the game is open ---

  Scenario: Open in the app: no banner, the page hears it
    Given Sam has Codebreakers open and in front in the OGS app
    And the page registered onOgsNotification
    When Codebreakers' server sends to ["ph_S"] title "Your clue, Keyholder"
    Then no system banner shows
    And the page's handler receives title "Your clue, Keyholder"

  Scenario: Elsewhere in the app: the app's own banner
    Given Sam is on the OGS app's Library screen
    When Codebreakers' server sends to ["ph_S"]
    Then the app shows its own banner
    And tapping it opens Codebreakers at the push's url

  Scenario: Open in the PWA: the worker swallows it
    Given Alex has the Codebreakers PWA open and focused
    And the page registered onOgsNotification
    When Codebreakers' server sends to ["ph_A"]
    Then no system notification shows
    And the page's handler receives it

  Scenario: No handler means a banner
    Given Sam has Codebreakers open in the OGS app and the page registered no handler
    When Codebreakers' server sends to ["ph_S"]
    Then the system banner shows

  Scenario: whenOpen banner always shows
    Given Sam has Codebreakers open in the OGS app with a handler
    When Codebreakers' server sends to ["ph_S"] with whenOpen "banner"
    Then the system banner shows

  Scenario: Taps open the push's url
    Given Sam's phone shows a push with url "https://codebreakers.example/room/KQTP"
    When Sam taps it
    Then the OGS app opens Codebreakers' WebView at "https://codebreakers.example/room/KQTP"

  # --- Removed ---

  Scenario: The device-token endpoint is gone
    When anything posts to "/api/v1/notifications/send"
    Then OGS answers 404
    And device registration returns no device token
