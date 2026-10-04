| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 — Home model (PS5-style IA) | 5 | 02–06, 13 | The home is still a text hero plus rows of small rectangular thumbnails; it lacks the defining square-icon rail and activity-card layer. |
| R2 — Focus from 3 m | 5 | 03–06; focus strip | Focus is a thin yellow outline with little scale change; during transitions the destination becomes visually subdued, so focus never feels dominant or weighty. |
| R3 — Visual craft | 6 | 02–09, 13 | Strong artwork and scrims, but generic typeset titles substitute for game logos, thumbnail density is uneven, and the couch UI feels stylistically separate. |
| R4 — Kids can use it | 4 | 02–06, 09 | Artwork helps recognition, but selection and actions still depend on reading; there is no visible picture-led “Surprise me” action. |
| R5 — Continue / resume | 7 | 03–08, 13 | Paused games lead and the game page clearly offers Continue/New game, but resume points and recency are too small to understand reliably from the couch. |
| R6 — Room and people | 7 | 02–08, 13, 15 | Joined players, remote holder, code, TV, and host are all present, but the large centered couch competes with navigation instead of behaving like quiet ambient status. |
| R7 — TV rules | 4 | 02–09, 13–15 | Numerous labels, metadata, instructions, names, and status pills appear below 24 px; several are illegible at 3 m despite generally safe positioning. |
| R8 — States | 7 | 01, 07–12, 14–15 | Coverage and language are consistent, but connecting is skeletal, game pages feel like a separate layout, and the cut-over reads as blur/zoom rather than one polished spatial motion. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Rebuild home around one title-safe top rail of square game icons: enlarge the focused icon by roughly 25–35%, reveal its logo/name beneath it, fill the room with its artwork, and place paused-sitting activity cards below. | R1, R2, R3, R5 | 02–06, 13; focus strip |
| 2 | Add a large picture-only “Surprise me” tile with a distinctive non-text symbol and make every game/action identifiable by artwork before text. | R1, R4 | 02–06, 09, 13 |
| 3 | Enforce a 24 px minimum rendered type token, enlarge resume metadata and action labels, then reduce and move couch/code/remote status into quiet title-safe corners. | R3, R5, R6, R7, R8 | 01–09, 13–15 |
