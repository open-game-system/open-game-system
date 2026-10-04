| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 | 8 | 02-home-fresh, 03-home-evening, 04-home-focus-right2 | The core PS5 model is present, but the dense persistent cards and utility chrome keep the room from feeling as effortless as a first-party console home. |
| R2 | 7 | 04-home-focus-right2, 05-home-focus-down, 06-home-focus-down-right; focus strip | Focus growth and background response work, but card focus is comparatively weak and the recorded transitions show overlapping/cross-faded destinations that briefly obscure location. |
| R3 | 7 | 02-home-fresh, 06-home-focus-down-right, 13-home-after-play | Strong full-bleed art and bespoke logos, but tiny clustered metadata, inconsistent visual weight, and busy scrims/cards prevent launch-grade polish. |
| R4 | 8 | 02-home-fresh, 06-home-focus-down-right, 16-surprise | Games and Surprise me are picture-led, but the dice card is less immediately identifiable than the game icons and selection feedback is still fairly subtle for a toddler. |
| R5 | 7 | 03-home-evening, 05-home-focus-down, 07-game-page-paused, 08-game-page-start | Continue is correctly primary on the game page, but home cards make resume point and recency secondary, repetitive, and difficult to scan quickly. |
| R6 | 8 | 02-home-fresh, 03-home-evening, 15-reconnecting | Joined players, remote holder, code, TV, and host are consistently present and restrained; the top-right social cluster is cramped and visually mechanical rather than warm. |
| R7 | 8 | 03-home-evening, 06-home-focus-down-right, 09-game-page-new | DOM checks confirm compliant size and title safety, and focal subjects remain largely clear; contrast and readability still vary over the busiest art and smallest metadata clusters. |
| R8 | 7 | 01-connecting, 07-game-page-paused, 10-starting, 11-cutover-grow, 12-framed, 14-frame-failed, 15-reconnecting | Coverage is excellent, but connecting uses skeletal placeholders, failure becomes a separate poster-like composition, and the cut-over lacks the seamless continuity of one platform motion. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Rebuild focus motion as a single spatial transition: enlarge the destination immediately, dim nonfocused items, animate one weighted ring without cross-faded duplicate states, and give activity cards the same unmistakable selected treatment. | R2, R3, R4 | 03–06, 13, 16; entire focus strip |
| 2 | Redesign paused activity cards around one large resume label—game image, “Continue · Day/Mission,” and relative time—remove repeated badges, and make the most recent sitting the dominant first card. | R1, R3, R5, R7 | 03–06, 13, 15 |
| 3 | Unify the transition-state system around the selected game artwork: preserve its icon/logo and spatial origin through connecting, starting, cut-over, reconnecting, and failure; replace skeletons and the disconnected failure poster with calm shared-state components. | R3, R8 | 01, 10–12, 14, 15 |
