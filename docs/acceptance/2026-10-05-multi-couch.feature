# Spec: docs/specification.md §7 (Several couches, one room). ADR: docs/adrs/2026-10-05-couches-join-the-games-room.md
# Design canvas: https://claude.ai/artifact/5CoghVnLznn5pSdENvazJM (Sequence board).
# Each living room keeps its own couch session, TV launcher and phones. The couches join the game's
# room; the game groups players by couch. Proven end to end with Night Flight (appId night-flight) in
# e2e/multi-couch.mjs.

Feature: Several households play one game

  Background:
    Given profiles "Jonathan" (the Mumms), "Sam" (the Smiths) and "Kim" (the Parks), all friends
    And each of them casts their own TV: three couch sessions, three TV launchers
    And Night Flight's manifest says multiCouch: true

  # --- The game makes the room ---

  Scenario: The game reports its room and the sitting keeps it
    Given Jonathan starts Night Flight on the Mumm TV
    When Night Flight's TV page says ogs:room "KQTP"
    Then the Mumm couch's current sitting has room "KQTP"
    And Jonathan's presence says he is casting Night Flight in room "KQTP"

  Scenario: A game that never names a room starts as before
    Given Jonathan starts Rocket Crew on the Mumm TV
    Then ogs:start carries no room
    And Rocket Crew makes its own room

  # --- Game tokens name the couch ---

  Scenario: The TV's game token names its couch
    When the Mumm launcher asks for Night Flight's game token
    Then the token has couch { sid: the Mumm session, label: "Jonathan" }

  Scenario: A phone's game token names its couch when it asks with its session
    Given Mom's phone is on the Mumm couch
    When the app asks for Night Flight's token with the Mumm session id
    Then the token has couch { sid: the Mumm session, label: "Jonathan" }

  Scenario: A phone that is not on that couch gets no couch claim
    Given Kim is not on the Mumm couch
    When Kim's app asks for Night Flight's token with the Mumm session id
    Then the answer is 403 not_a_member

  Scenario: A phone with no couch gets a token without couch
    When the app asks for Night Flight's token with no session id
    Then the token has no couch claim

  # --- Invite friends to this game ---

  Scenario: Invite friends from the phone
    Given Night Flight is live on the Mumm TV in room "KQTP"
    When Jonathan taps "Invite friends to this game" and picks Sam
    Then OGS sends Sam a push "Jonathan invites you to Night Flight"
    And the link is "https://opengame.org/play/night-flight?room=KQTP"

  Scenario: Only friends can be invited
    When Jonathan invites a profile that is not his friend
    Then the answer is 403 not_a_friend

  Scenario: Only multi-couch games take invites
    When Jonathan invites Sam to Rocket Crew's room
    Then the answer is 409 not_multi_couch

  # --- Joining the room ---

  Scenario: The invite link starts the game in that room on your own TV
    Given the Smith TV is cast
    When Sam opens "opengame.org/play/night-flight?room=KQTP"
    Then the Smith couch sends game.start { appId: "night-flight", room: "KQTP" }
    And the Smith launcher sends ogs:start with room "KQTP"
    And Sam's phone opens Night Flight's start page with ogsRoom=KQTP

  Scenario: The invite link asks to cast first
    Given the Smith TV is not cast
    When Sam opens the invite link
    Then the app asks Sam to cast to the TV
    And once the TV is cast, the game starts in room "KQTP"

  Scenario: The link without the app
    When someone opens "https://opengame.org/play/night-flight?room=KQTP" in a browser
    Then the page offers "Open in the OGS app" (opengame://play/night-flight?room=KQTP)

  Scenario: Join with your couch from Playing
    Given the Mumm and Smith TVs are in Night Flight room "KQTP"
    When Kim opens Playing
    Then a card says "Jonathan and Sam are playing Night Flight"
    When Kim taps "Join with your couch"
    Then the Park couch starts Night Flight in room "KQTP"

  Scenario: Join a friend's cast still sits you on their couch
    Given Sam is casting on "Smith TV"
    When Kim taps Join on "Sam is casting on Smith TV"
    Then Kim is a member of the Smith couch session
    And no game is started on the Park couch

  # --- In the room ---

  Scenario: Every TV shows the room
    Given the Mumm, Smith and Park couches are in Night Flight room "KQTP"
    Then all three TVs show room "KQTP"
    And the game sees three couches: Jonathan, Sam and Kim

  Scenario: A card played on one couch moves the board on every TV
    Given the Mumm, Smith and Park couches are in room "KQTP"
    When Sam plays a card on his phone on his turn
    Then the Smith owl moves on all three TVs

  Scenario: Home parks only that couch
    Given the three couches are in room "KQTP"
    When the Smith remote presses Home
    Then only the Smith TV parks Night Flight (ogs:suspend)
    And the game marks the Smiths away and skips their turns
    And the Mumm and Park TVs keep playing

  Scenario: Continue goes back into the same room
    Given the Smith TV parked Night Flight in room "KQTP"
    When the Smith remote presses Continue
    Then the same frame resumes (ogs:resume) in room "KQTP"
    And the game marks the Smiths back

  Scenario: Each couch keeps a sitting for the room
    Given the three couches played in room "KQTP"
    Then each couch has a Night Flight sitting labelled "Room KQTP"
    And Continue on any of them goes back into room "KQTP"

  # --- Night Flight, one couch ---

  Scenario: One couch plays exactly as before
    Given only the Mumm couch is in a Night Flight room
    Then the turn order, owls and screens are the same as before multi-couch
