# Spec: docs/product-specs/ogs-profiles.html (§3 Games know who you are). Slice 3.
# Plan: docs/exec-plans/active/2026-10-04-games-know-you-slice-3.md
# A game gets your profile id, @id, name and avatar (and, on the TV, who's on the couch) in a signed
# ES256 token scoped to that one game. Never your friends, other games, device ids, push tokens, the
# app's own OGS token, or your age.

Feature: Games know who you are

  Background:
    Given profiles "Jonathan" (@jonathan.m, bear) and "Juneau" (@juneau, dragon)
    And Rocket Crew and Story Nook are in the catalogue

  # --- In the app (phone / iPad WebView) ---

  Scenario: A game gets the name, no form
    Given Juneau opens Rocket Crew from the OGS app on his iPad
    Then he does not see "Who's playing here?"
    And he joins the crew as "Juneau"

  Scenario: A game gets the profile id, @id and avatar
    When Rocket Crew asks for Juneau's profile in the OGS app
    Then it gets his profile id, "juneau", "Juneau", the dragon sticker's image URL and a token
    And the token's audience is "rocket-crew" and it expires within an hour

  Scenario: The token is refreshed before it expires
    Given Rocket Crew has been open for 55 minutes
    Then the app has given it a fresh token

  Scenario: A plain browser falls back to the NameGate
    Given Max opens Rocket Crew in Safari (not the OGS app)
    Then he sees "Who's playing here?"
    And can join by typing "Max"

  Scenario: An app that never answers falls back to the NameGate
    Given a WebView whose app has no profile store
    When 300 ms pass
    Then the game asks for a name

  # --- On the TV ---

  Scenario: The TV page gets the players
    Given Jonathan is casting and Juneau joined with the TV code
    When Jonathan starts Rocket Crew on the TV
    Then the TV page's ogs:start carries a token for "rocket-crew" naming the session
    And players Jonathan and Juneau with their @ids, names and avatars

  Scenario: The launcher's own token never reaches a game
    When the TV page receives ogs:start
    Then its token is a game token for that game, not the launcher token

  # --- Scoped and minimal ---

  Scenario: Game A's token is rejected by game B
    Given Juneau's token for Story Nook
    When Rocket Crew's server verifies it for "rocket-crew"
    Then it is rejected

  Scenario: The token never carries friends, age or device ids
    Given Juneau and Jonathan are friends
    When Rocket Crew gets Juneau's token
    Then its claims are exactly iss, aud, sub, handle, name, avatar, iat and exp

  Scenario: Games verify with OGS's public key
    When a game server fetches /.well-known/jwks.json
    Then it gets one ES256 (P-256) public key with a kid
    And a token signed by another key is rejected

  Scenario: An unknown game gets no token
    When the app asks for a token for "not-a-game"
    Then the API answers 404 game_not_found

  # --- Sittings ---

  Scenario Outline: Two sittings of <game> look different in the app
    Given two sittings of <game>
    When each reports itself through the OGS bridge
    Then Playing shows each with its own label like "<label>"

    Examples:
      | game            | label     |
      | Rocket Crew     | Mission 6 |
      | Bake Shop       | Day 4     |
      | Story Nook      | Page 3    |
      | Peekaboo Garden | Round 2   |
      | Night Flight    | Room KQTP |

  # --- Taste ---

  Scenario: No faces on Rocket Crew's stars and planet
    When the TV shows the collectible stars and the planet icon
    Then none of them has a face
