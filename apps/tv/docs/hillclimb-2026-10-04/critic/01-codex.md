| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 | 8 | 02–06, 13, 16 | The console-home model is clear, but the activity row is visually dense and the fresh state feels comparatively empty. |
| R2 | 7 | 03–06; focus strip | Growth, ring, name, and room response work, but crossfades produce prolonged ghosted scenes that weaken positional certainty and motion weight. |
| R3 | 8 | 02–09, 13 | Strong full-bleed artwork, logos, scrims, and depth; small metadata and crowded card treatments keep it below platform-launch polish. |
| R4 | 8 | 02–06, 09, 16 | Games are picture-recognisable and Surprise me is prominent, but its card still resembles another game tile rather than an unmistakable no-reading action. |
| R5 | 8 | 03–08, 13 | Paused sittings lead and the game page clearly separates Continue from Start; resume-point metadata is less visually dominant than it should be. |
| R6 | 8 | 02–09, 13, 15 | People, remote holder, room title, and join code stay quiet and peripheral; the tiny sticker cluster conveys presence more than warmth or activity. |
| R7 | 8 | 02–09, 13–16 | DOM checks confirm compliant size and title safety, with subjects generally unobstructed; contrast and scene clarity dip during layered focus transitions. |
| R8 | 7 | 01, 07–12, 14–15 | All required states exist and are specific, but connecting is skeletal, reconnecting is easy to miss, and the cut-over lacks one convincingly continuous visual motion. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Replace long whole-scene crossfades with a fast staged transition: move/scale the focus icon first, fade the old hero out before revealing the new hero, and settle within 300–400 ms without overlapping focal subjects. | R2, R3, R7 | Focus strip; 03–06 |
| 2 | Make the first activity card a larger, unmistakable resume action: enlarge its artwork and resume point, combine “when” and progress into one strong badge, and visually subordinate the remaining cards. | R1, R3, R5 | 03–08, 13 |
| 3 | Unify transitional states around the selected game’s icon/logo and one persistent launch surface; animate that surface into the framed game, and give reconnecting the same prominent centered status treatment. | R3, R8 | 01, 10–12, 14–15 |
