| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 | 8 | 02–06, 13 | The intended PS5-style hierarchy is present, but the persistent activity cards and social metadata make the home feel busier than a first-party console shell. |
| R2 | 7 | focus strip; 03–06 | Focus is identifiable through enlargement, outline, name, and room change, but crossfades briefly produce muddy double imagery and the ring is not consistently the loudest element. |
| R3 | 7 | 02–10, 13–16 | Strong full-bleed art and distinctive logos, but inconsistent logo scales, dense overlays, and occasionally weak foreground/background separation keep it below platform-launch polish. |
| R4 | 7 | 02–06, 09, 16 | Games and Surprise me are picture-led, but the small dice card and text-dependent game-page actions still require adult guidance for the almost-3-year-old. |
| R5 | 8 | 03–08, 13 | Paused sittings lead the activity row and the game page clearly prioritizes Continue, but resume-point detail is visually subordinate and duplicated status labels add scanning effort. |
| R6 | 7 | 02–09, 13, 15 | Title, joined players, remote holder, and join code are consistently placed and quiet, but the upper-right cluster is cramped and visually fragmented. |
| R7 | 7 | 02–10, 13–16 | Automated checks confirm compliant text size and title-safe placement, but contrast varies across art and some UI overlaps visually important scene detail, especially on the home compositions. |
| R8 | 7 | 01, 07–12, 14–15 | All required states exist and messages are specific, but connecting is comparatively generic, the cut-over lacks a clearly legible continuous motion, and failure/reconnection feel less resolved than home. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Recompose every hero with per-game focal-point metadata and responsive scrim masks: reserve a clean left-third logo zone, keep subjects unobstructed, and guarantee foreground contrast without globally dimming the art. | R1, R3, R7 | 02–06, 13, 15–16 |
| 2 | Replace the home focus crossfade with a weighted transition: immediately snap the ring/name, spring the selected icon to roughly 1.3×, then crossfade only the hero layer without overlapping logos or UI. | R2, R3 | 02–06 and every frame in the focus strip |
| 3 | Make the primary actions icon-first and simplify state hierarchy: enlarge the Surprise card and its dice symbol, give Continue a dominant pictorial treatment, collapse duplicate pause labels, and carry the selected tile continuously through starting, framing, failure, and reconnection. | R4, R5, R8 | 03–10, 12–16 |
