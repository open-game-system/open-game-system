# Library + game page hill-climb (2026-10-04)

Method: `~/src/skills/design-hillclimb`. Each round shot real Release builds on an iPhone 17 Pro
(402 pt) and an iPhone 13 mini (375 pt) against the local OGS API, a fake Chromecast and the
real catalogue. Every round had two fresh critics who saw only the screenshots, a brief and the
rubric, never the code or each other. From round 01 on, one of the two was Codex
(`gpt-5.6-sol`, medium reasoning) and the other a Claude (Opus) subagent.

The rubric rows are IA/model, getting back in, scan and find (5 to 30 games), owner fit,
states, art treatment, hierarchy, typography, spacing, pressed/touch, identity, game page (added
in round 01) and small phone. 8 means a first-party lead would sign off.

## Scores (minimum row, then the lowest rows)

| Round | Critic | Min | Lowest rows | Note |
|---|---|---|---|---|
| 00 (before) | Claude visual | 2 | Owner fit 2, Scan 3, States 3, Hier 3, Ident 3 | The old list: "Needs a TV" on every card, truncated taglines |
| 00 (before) | Claude product | 2 | Owner fit 2, States 2, Scan 3 | Library identical in every state |
| 01 | Codex visual | 5 | IA, States, Art, Space, Press, Game page, 375 at 5 | HUD-heavy captures, hero duplicated a grid tile |
| 01 | Claude product | 4 | Game page 4 | Library doing Playing's job; identical sittings |
| 02 | Codex product | 5 | IA, States, Press, Ident, Game page | "All Games" isn't all games; the hero launches while covers open pages |
| 02 | Claude visual | 4 | Game page 4 | Second sitting hidden behind the action bar; voids |
| 03 | Codex visual | 4 | Press 4 | Hero duplicates a grid game; pressed state not visible |
| 03 | Claude product | 4 | Press 4 | Hero lost its action after a play; "Game 1/2" names |
| 04 (after) | Claude visual | 5 | Identity 5 | Game page has a hard art seam over a tinted void; stock pill/card chrome |
| 04 (after) | Codex product | 5 | IA, States, Press, Game page, 375 at 5 | Library mixes collection and resume; Rejoin shown up to three times with the pill |

Rows that reached 7–8 by round 04: owner fit (7, 8), scan and find (7, 7), art treatment (6, 8),
getting back in (7, 7), typography (6, 7).

## Sheets

- Before: `r00-before-library-402.jpg`, `r00-before-library-375.jpg`
- Per round: `r01-*`, `r02-*`, `r03-*` (Library and game page, 402 pt)
- After: `r04-after-library-402.jpg`, `r04-after-library-375.jpg`, `r04-after-gamepage-402.jpg`,
  `r04-after-gamepage-375.jpg`

## Why it stopped at 5

The minimum moved 2, 4, 4, 4, 5 and the critics kept circling the same structural question,
which is the owner's call:

1. **Who owns "resume" on Library?** The owner asked for a hero with Play/Rejoin. Every critic
   flags that the hero's Rejoin, the game page's Rejoin and the return pill above the tab bar
   (another team's) show the same action up to three times. Round 03 hid the hero's button when
   the pill pointed at the same game, and the next critic said the hero "lost its action". Round
   04 restored it.
2. **Is the hero a collection item or a session launcher?** Codex twice recommended dropping the
   hero and leading with All Games; Claude recommended keeping it with an always-on action.
3. **Pressed state is unproven.** Detox's long press produced only the simulator's touch circle,
   not the Pressable's ring and scale, so that row is graded from targets alone.

Not reached: a continuous art plane on the game page (no hard seam), and per-sitting visual cues
beyond a timestamp (needs resume points or player avatars from games).
