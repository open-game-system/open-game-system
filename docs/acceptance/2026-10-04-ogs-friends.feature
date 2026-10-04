# Spec: docs/product-specs/ogs-profiles.html (§2 Friends & Profile, §2 The couch). Slice 2: friends.
# Plan: docs/exec-plans/active/2026-10-04-friends-slice-2.md
# Friends are mutual. No automatic joining: a friend's cast is a Join card; others use the TV code.
# No push notifications yet (later trigger: "a friend starts a new game").

Feature: OGS friends

  Background:
    Given profiles "Jonathan" (@jonathan.m), "Mom" (@mom.m) and "Max" (@max.k), each on their own phone

  # --- Adding a friend ---

  Scenario: Add a friend screen shows my QR, a short code and a link
    When Jonathan opens Friends → Add a friend
    Then he sees a QR code, a code like "KITE-42" with "10 min", "Share invite link", "Scan their code" and "Find by @id"

  Scenario: A scan in person makes you friends at once
    Given Jonathan shows his Add a friend QR
    When Mom scans it
    Then Jonathan and Mom are friends
    And neither has a request to accept

  Scenario: Typing the code sends a request the inviter accepts
    Given Jonathan's invite code is "KITE-42"
    When Max types "kite42" in Add a friend
    Then Jonathan sees "Max" under Requests with Accept
    And Max sees the request as sent
    When Jonathan taps Accept
    Then Jonathan and Max are friends

  Scenario: Opening an invite link sends a request
    Given Jonathan shared his invite link
    When Max opens the link
    Then Jonathan sees "Max" under Requests

  Scenario: An invite works once and for 10 minutes
    Given Jonathan's invite was used by Mom
    When Max uses the same code
    Then Max is told the invite was used
    And a code older than 10 minutes is told it expired

  Scenario: Find by @id
    When Max finds "@jonathan.m"
    Then Jonathan sees "Max" under Requests
    And finding an @id nobody has says nobody has that @id

  Scenario: Asking someone who already asked you makes you friends
    Given Max asked Jonathan
    When Jonathan finds "@max.k"
    Then Jonathan and Max are friends

  Scenario: You can't add yourself
    When Jonathan uses his own code
    Then he is told he can't add himself

  Scenario: Decline a request
    Given Max asked Jonathan
    When Jonathan taps Decline
    Then the request is gone for both and they are not friends

  Scenario: Remove a friend
    Given Jonathan and Mom are friends
    When Jonathan removes Mom
    Then neither sees the other in Friends

  # --- The list and presence ---

  Scenario: Friends shows requests on top, then friends with presence
    Given Jonathan and Mom are friends and Max asked Jonathan
    When Jonathan opens Friends
    Then "Requests" lists Max with Accept and Decline above "Friends"
    And each friend shows their sticker, name and @id

  Scenario Outline: A friend's presence
    Given Jonathan and Mom are friends
    When Mom <does>
    Then Jonathan sees Mom as "<presence>"

    Examples:
      | does                                                  | presence                    |
      | used OGS in the last 5 minutes                        | Online                      |
      | casts to "Living room TV" (the TV is connected)       | Casting on Living room TV   |
      | is on a cast that is running Rocket Crew              | Playing Rocket Crew         |
      | has not used OGS for an hour and is not on a cast     | Offline                     |

  Scenario: Friends see only name, sticker, @id and presence
    Given Jonathan and Mom are friends
    Then what Jonathan gets about Mom is her id, @id, name, sticker, presence and since when they are friends

  # --- Joining a friend's cast ---

  Scenario: Friend sees Join while you cast
    Given Jonathan and Mom are friends
    When Mom casts to "Living room TV"
    Then Jonathan's Playing shows a Join card "Mom is casting on Living room TV"
    When Jonathan taps Join
    Then Jonathan is a member of Mom's session and the TV shows him

  Scenario: The Join card goes when the cast ends
    Given Jonathan sees Mom's Join card
    When Mom's TV disconnects
    Then the Join card is gone

  Scenario: A non-friend can't join through Join but can with the TV code
    Given Mom casts and Max is not her friend
    Then Max sees no Join card for Mom
    And joining Mom's session as a friend is refused with not_a_friend
    When Max types the TV code
    Then Max is a member of Mom's session
