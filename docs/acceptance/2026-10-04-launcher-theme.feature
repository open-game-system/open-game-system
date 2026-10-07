# Spec: docs/product-specs/ogs-app-v3.html (Launcher · sound: Home plays the focused game's theme).
# Owner, 2026-10-04: PS5-style, the focused game card plays that game's music theme, quietly, looped.
# Unit: apps/tv/src/launcher/theme.test.ts (decision), apps/tv/src/ui/theme-player.test.ts (player).
# e2e: apps/tv/e2e/theme.e2e.ts.

Feature: The launcher plays the focused game's theme on Home

  Background:
    Given the TV launcher is on Home
    And Bake Shop, Story Nook, Rocket Crew, Peekaboo Garden and Night Flight each have an art.theme (an MP3 loop)
    And Hearthisle and Trivia Jam have no art.theme

  Scenario: The focused game plays its theme, quietly, looped
    Given the ring is on Bake Shop
    Then Bake Shop's theme is playing
    And it loops
    And its volume settles at 0.5

  Scenario: Moving the ring crossfades to the next game's theme
    Given the ring is on Bake Shop
    When the ring moves to Story Nook
    Then Bake Shop's theme fades out over about 600 ms
    And Story Nook's theme fades in over about 600 ms

  Scenario: A sitting card plays its game's theme
    When the ring moves to the Bake Shop sitting card
    Then Bake Shop's theme is playing

  Scenario: A game without a theme is silence
    When the ring moves to Hearthisle
    Then no theme is playing

  Scenario: Surprise me is silence (it doesn't give the pick away)
    When the ring moves to the Surprise me card
    Then no theme is playing

  Scenario: A game's page is silence
    When the family opens Bake Shop's page
    Then no theme is playing

  Scenario: Starting a game fades the theme out before the game's own sound
    Given Bake Shop's theme is playing
    When the family starts Bake Shop
    Then the theme fades out
    And no theme is playing while Getting ready and while the game runs

  Scenario: Back on Home the theme returns
    Given a game is running
    When the family goes Home
    Then the focused game's theme plays again

  Scenario: Connecting is silence
    Given the launcher is still connecting to the couch session
    Then no theme is playing

  Scenario: A browser that blocks autoplay stays silent and tries again on the next key press
    Given the browser refuses to play audio without a user gesture
    When the ring is on Bake Shop
    Then nothing errors and no theme is playing
    When someone presses a key
    Then Bake Shop's theme starts
