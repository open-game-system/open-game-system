| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 | 8 | 02–06, 13, 16 | The structure strongly matches PS5 home, but the activity rail is visually dense enough to compete with the focused hero instead of feeling subordinate. |
| R2 | 7 | focus-strip, 03–06 | Icon growth, label, ring, and room response work, but focus is not consistently the loudest element; the crossfade produces muddy intermediate frames and card focus is comparatively subtle. |
| R3 | 7 | 02–09, 13 | Excellent bespoke art and logos, but crowded metadata pills, uneven card hierarchy, and several competing decorative treatments keep it below first-party polish. |
| R4 | 7 | 02–06, 09, 16 | Games are picture-recognisable and Surprise is prominent, but its collage-and-die symbol does not communicate “random game” unambiguously to a non-reading toddler. |
| R5 | 8 | 03–08, 13 | Paused sittings lead and Continue is clearly primary; the remaining weakness is small, pill-heavy resume metadata that takes effort to parse from the couch. |
| R6 | 8 | 02–09, 13, 15 | People, remote holder, title, and code stay quiet and peripheral; the tiny clustered portraits/status text feel more informational than warm or alive. |
| R7 | 7 | 03–09, 13, 15; 05 | Text meets the 24 px rule, but two runs escape title-safe in 05, and contrast/readability varies across the busier hero art and dense lower cards. |
| R8 | 7 | 01, 07–12, 14–15 | All required states exist and are specific, but connecting feels skeletal, failure feels like a separate splash screen, and the frozen cut-over does not yet demonstrate one seamless, authored motion. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Strengthen focus choreography: enlarge the selected icon and card further, dim/de-emphasize siblings, use a crisp 250–350 ms hero crossfade with no double-exposed subject, and give card focus the same luminous depth as icon focus. | R2, R3, R4 | 03–06, 13, 16, focus-strip |
| 2 | Simplify the activity rail into fewer, larger cards with one dominant resume line; replace stacked metadata pills with a consistent “when · resume point” line and guarantee all bounds remain inside 5% title-safe. | R1, R3, R5, R7 | 03–06, 13, 15 |
| 3 | Unify transitional states around the selected hero: retain its art, logo, room chrome, and spatial origin through connecting, starting, cut-over, and failure; animate the selected tile continuously into and out of the framed game. | R3, R8 | 01, 10–12, 14–15 |
