# Game page scorecard (frozen 2026-10-04)

The OGS app's page for one game, inside the Library tab (tab bar and Rejoin pill stay). It shows
the game's key art and logo, its facts (players, minutes, ages), its tagline, the sittings you
have in progress (each with Rejoin), and one main button: Play when nothing is in progress,
Start game when something is. Not casting, Play asks to cast first (the cast prompt). It should
feel like the same family as the Library hero (full-bleed art, Play over the art).

Owner copy rules: a button says Play or Cast, never both; "Start game" for a fresh sitting;
Rejoin; "In progress" never repeated as a row title; each fact once per screen.

References (the 10): Apple TV app show page, Nintendo eShop game page, PS5 game hub, Apple Arcade
game page, Steam Deck game page. 6 = a competent indie app. 8 = a first-party product or design
lead would sign off shipping it. Grade against the references, never against a previous round.

| Row | 6 | 8 (ship bar) | 10 |
|---|---|---|---|
| Hierarchy | art, title, facts and actions all present but compete or leave dead space | the eye goes art → name → what to do, with no dead bands; the page uses its height in every state | Apple TV show page |
| The one primary action | the main button works but floats, is detached, or competes | exactly one filled action per state, in thumb reach, visibly tied to the game; the secondary reads as secondary, not disabled | PS5 hub's one big button |
| Sittings legibility | sittings listed | each sitting reads apart at a glance (name, when), the newest's Rejoin outranks the rest, two sittings never look like duplicates | Switch "jump back in" |
| Art & brand | art is a header image with a hard edge | the art is the page: continuous into the page colour (no seam), logo and facts legible on it, same family as the Library hero | eShop / Arcade key-art pages |
| Craft | consistent but generic chrome; low-contrast controls | type scale, spacing, back button contrast, pressed states and scrims at first-party level; AA contrast everywhere | you'd screenshot it |
| Both sizes (375 / 402) | works on one, cramped or empty on the other | 375 and 402 both balanced: nothing truncated, nothing floating, primary in reach | exemplary |
| Copy | understandable | the owner's words exactly (Play, Start game, Rejoin, In progress once), each fact once, no filler | every line earns its place |

## Log

Per round: both judges' scores; the keep/revert call is a blind A/B (before vs after, random order).

| Round | Judge | Hier | Primary | Sittings | Art | Craft | Sizes | Copy | Min |
|---|---|---|---|---|---|---|---|---|---|
| 00 (before) | Claude (Opus) | 5 | 6 | 5 | 6 | 6 | 6 | 7 | 5 |
| 00 (before) | Codex (gpt-5.6-sol, medium) | 7 | 8 | 8 | 8 | 7 | 7 | 9 | 7 |
| 01 | Claude (Opus) | 7 | 7 | 6 | 7 | 6 | 5 | 8 | 5 |
| 01 | Codex (gpt-5.6-sol, medium) | 8 | 7 | 7 | 8 | 7 | 6 | 10 | 6 |
| 02 | Claude (Opus) | 7 | 6 | 7 | 7 | 6 | 7 | 8 | 6 |
| 02 | Codex (gpt-5.6-sol, medium) | 7 | 6 | 8 | 8 | 7 | 7 | 10 | 6 |
| 03 | Claude (Opus) | 7 | 7 | 7 | 7 | 6 | 7 | 8 | 6 |
| 03 | Codex (gpt-5.6-sol, medium) | 8 | 8 | 7 | 8 | 7 | 8 | 10 | 7 |
| 04 | Claude (Opus) | 7 | 7 | 7 | 7 | 7 | 7 | 8 | 7 |
| 04 | Codex (gpt-5.6-sol, medium) | 7 | 8 | 7 | 8 | 7 | 7 | 10 | 7 |
| 05 | Claude (Opus) | 7 | 7 | 7 | 8 | 7 | 7 | 7 | 7 |
| 05 | Codex (gpt-5.6-sol, medium) | 8 | 8 | 8 | 9 | 7 | 8 | 10 | 7 |
| 06 (reverted) | Claude (Opus) | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 06 (reverted) | Codex (gpt-5.6-sol, medium) | 7 | 7 | 7 | 8 | 7 | 7 | 9 | 7 |
| 07 pivot (reverted) | Claude (Opus) | 7 | 7 | 8 | 7 | 7 | 7 | 8 | 7 |
| 07 pivot (reverted) | Codex (gpt-5.6-sol, medium) | 8 | 8 | 8 | 9 | 7 | 8 | 10 | 7 |

Keep/revert (blind A/B, order counterbalanced between judges): r01–r05 both judges preferred
"after" and were kept; r06 (Start game sized to its words, centred) split 1–1 and was reverted;
r07, the pivot (the newest sitting as a "jump back in" tile on the game's own capture), split
1–1 and was reverted. Minimum per round (lower of the two judges): 5 → 5 → 6 → 6 → 7 → 7, then
flat through the pivot: stopped.

## Method

Release builds on a fresh iPhone 17 Pro (402 pt) and iPhone SE 3rd gen (375 pt) simulator, the
local API, a fake Chromecast and the real catalogue. A Detox script onboards, shoots Rocket Crew
with no sittings (Play), Play while not cast (the cast prompt), Peekaboo Garden (the longest
tagline), then casts, reports Bake Shop sittings through the API with the TV's launcher token
("Day 3", then an unnamed one), and shoots one, two and two-scrolled. Each round two fresh judges
(Codex gpt-5.6-sol medium, a Claude Opus subagent) saw only the sheets and the brief.

## Sheets

`r00-before-sheet.jpg` (baseline) · `r01`–`r05-sheet.jpg` (kept; r05 = after) ·
`r06-reverted-sheet.jpg` · `r07-pivot-reverted-sheet.jpg`.

## Where it's stuck and why

- **Primary (7)**: with sittings, the filled action is the newest sitting's Rejoin and Start game
  is an outline (the acceptance spec: "that Rejoin is the page's one filled button, with Start
  game as the secondary button"). Every judge, every round, asks which is the main action. Tonal
  read disabled, full-width outline reads loud, word-sized outline split the judges. Owner call.
- **Sittings (7–8)**: the seeded sittings are both "played just now" (the API stamps updatedAt on
  report), so the fixture itself makes them look alike; real evenings differ more.
- **Craft (7)**: judges want the secondary type (facts, sitting detail, tab labels) a step larger
  and the Bake Shop logo off the bear's body (needs a per-game focal point in the art kit).
