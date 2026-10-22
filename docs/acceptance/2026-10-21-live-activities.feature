Feature: Live Activities for the controller phone
  While a phone is the controller for a game on the TV, iOS shows the game on the lock screen and in the
  Dynamic Island (name, key art or icon, a short status, the room code), and a tap returns to the
  controller. Every OGS app gets it from @open-game-system/shell: the OGS app and each game's own app.
  Ships dark: the shell config's `liveActivities`, the OGS app's OGS_LIVE_ACTIVITIES=1 build and the
  API's LIVE_ACTIVITIES var are all off until turned on.

  Background:
    Given an app built with Live Activities on
    And the user allows Live Activities for it

  Rule: Lifecycle on the phone

    Scenario: Joining a game as its controller starts the activity
      When the phone becomes the controller for "Rocket Crew" on the TV with code "KXTE42"
      Then a Live Activity starts with the game "Rocket Crew", its art, "Playing on the TV" and "KXTE42"
      And it is stale after 4 hours

    Scenario: The game's own report updates the status
      Given the activity is running
      When the game's phone page reports { status: "active", title: "Round 3", yourTurn: true }
      Then the activity says "Round 3 · Your turn"

    Scenario Outline: Status lines
      When the game reports status "<status>" with title "<title>"
      Then the activity says "<line>"

      Examples:
        | status    | title   | line                          |
        | lobby     |         | In lobby                      |
        | waiting   |         | Waiting for players           |
        | waiting   | Round 2 | Round 2 · Waiting for players |
        | active    | Round 3 | Round 3                       |
        | suspended |         | Paused                        |

    Scenario: Updates are throttled
      Given the activity was updated less than 5 seconds ago
      When the game reports three more changes within those seconds
      Then only the last one is sent, once the 5 seconds are up
      And a report that changes nothing on the lock screen sends nothing

    Scenario: The session ending ends the activity
      When the cast ends, or the game reports "completed"
      Then the activity ends showing "Game over" and leaves the lock screen soon after

    Scenario: An idle activity ends
      Given no report or session change for 30 minutes
      Then the activity ends

    Scenario: The user disallowed Live Activities
      Given the user turned Live Activities off for the app
      When the phone becomes the controller for a game
      Then nothing starts, nothing fails, and the controller works as before

    Scenario: The flag is off
      Given an app built without Live Activities
      Then there is no widget extension and the runtime never calls the native module

  Rule: Tap returns to the controller

    Scenario: A tap while the controller is open
      When the user taps the activity
      Then the app comes forward on the controller as it was, without reloading the page

    Scenario: A tap after the app was closed (OGS app)
      Given the OGS app is not running
      When the user taps the activity for "rocket-crew"
      Then the app opens that game's controller (its rejoin page)

  Rule: Remote updates through APNs (API, LIVE_ACTIVITIES=on)

    Scenario: The phone registers its activity's push token
      When the activity has a push token
      Then the app posts it to POST /api/v1/sessions/<sid>/live-activities
      And only the host, a member, or the session's launcher may register

    Scenario: The TV's state changes while the phone is locked
      Given a registered activity for session "s1"
      When the couch session's game label changes to "Mission 6"
      Then each token of "s1" gets a liveactivity push with event "update" and the status "Mission 6"

    Scenario: The cast ends
      When the couch session's cast ends
      Then each token gets event "end", and the rows are deleted

    Scenario: A dead token
      When APNs answers 410 or BadDeviceToken for a token
      Then that row is deleted and the others still get the push

    Scenario: No APNs key yet
      Given APNS_KEY_ID, APNS_TEAM_ID or APNS_P8 is missing
      Then nothing is sent, the couch session carries on, and the wide event says why

    Scenario: Feature flag off
      Given LIVE_ACTIVITIES is not "on"
      Then the routes answer 404 feature_disabled and the couch session sends no pushes
