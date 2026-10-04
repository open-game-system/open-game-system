# OGS TV launcher: hill-climb toward a PS5-style home (2026-10-04)

**Target:** the one page the Chromecast shows all evening. A family of four (two grown-ups on
phones, a 5-year-old and an almost-3-year-old who can't read) picks, resumes and switches games
from the couch with a phone d-pad, and it should feel like a first-party console home (PS5 home,
Battle.net, Steam Big Picture), not a web page.

## Rubric (frozen for the run)

Each row is scored 0–10. Anchors: **10** = PS5 home / Apple TV home at their best.
**8** = a first-party platform design lead would sign off shipping it. **6** = competent but
generic or clumsy: works, but nobody would mistake it for a console home.

| # | Row | 6 | 8 | 10 |
|---|---|---|---|---|
| R1 | **Home model (PS5-style IA)** | Rows of thumbnails with a text hero; the art is a strip, not the room | A top row of square game icons; the focused game's art fills the room; its logo sits large in the left third; activity cards below | Instantly reads as a console home; every element has one job; nothing to learn |
| R2 | **Focus from 3 m** | The ring is visible but small; you have to look for it | The focused icon grows, shows its name, the room changes with it; you always know where you are | Focus is the loudest thing on screen, moves with weight, and the room responds in under a beat |
| R3 | **Visual craft** | Tidy, but flat type and art boxed in panels; mismatched scales | Full-bleed art with considered scrims, real logos, a clear type scale, consistent radii and depth | Polished like a platform launch: every pixel deliberate, the art sings |
| R4 | **Kids can use it** (5 and almost 3, no reading) | Needs reading to choose; small targets | Games are recognisable by picture alone; a no-reading way to "just play something" (Surprise me) | A toddler could point and get something fun every time |
| R5 | **Continue / resume** | Paused games exist but resume points are small or buried | Paused sittings come first; each shows its resume point and when; the game page offers Continue and Start game clearly | Picking up where you left off is the obvious first action, with no ambiguity about which sitting |
| R6 | **Room and people** | Couch, code and remote holder are present but compete with the games | Who joined, who has the remote and the join code are visible, quiet, in corners, out of the focal area; the title reads "<TV> · <host>'s games" | The social context feels warm and alive without stealing attention |
| R7 | **TV rules** | Some text near 24 px or near the edges; UI over the art's subject | All text ≥ 24 px inside title-safe; nothing covers the focal subject of the scene; contrast holds on every game's art | Effortlessly legible at 3 m on every game |
| R8 | **States** (connecting, empty, game page, starting, framed, failed, reconnecting) | States exist but feel like different products | Every state is calm, specific and in the same visual language; the cut-over into the framed game reads as one motion | Every state is as considered as the home screen |

## Evidence command

`TV_E2E_PORT=5189 node scripts/hillclimb-shoot.ts <round>` (from `apps/tv`): `vite build` +
`vite preview` on 5189, the fake session at 1920×1080, a fixed list of scenarios (each must
acknowledge), `sheet.jpg`, `focus.mp4` (focus moving right ×5, down, right, up) and
`focus-strip.jpg`. Same fixture, same scenarios every round.

## Panel

Two fresh critics per round, blind to the author's reasoning and to each other: one Codex
(`codex exec -m gpt-5.6-sol -c model_reasoning_effort="medium" -i sheet.jpg -i focus-strip.jpg`),
one Claude critic subagent (reads the round's PNGs). Each returns a score per row with the shot it
is based on and the top 3 fixes.

## Gate

`pnpm --filter @open-game-system/tv typecheck`, `test`, `test:e2e` (TV_E2E_PORT=5191 while
5190 is taken by another server). Only apps/tv paths are committed.

## Stop rule

At least 3 rounds; stop when no row is below 8 (by the panel's minimum per row), or after 5
rounds, or when the minimum stays flat through a pivot round.
