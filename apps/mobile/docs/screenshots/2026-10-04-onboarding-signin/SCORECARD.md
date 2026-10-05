# Onboarding hill-climb: scorecard (frozen 2026-10-04)

Target: the OGS app's first run (welcome, notifications, profile step, done) reads as a first-party
product in 3 seconds: what OGS is now (cast once, your TV is the console, play with family and
friends), two clear paths (new profile / already have one), and the app's own dusk identity.

Evidence: `round.sh NN` (Detox walk on iPhone 17 Pro 402 pt and iPhone SE 375 pt, Release build):
1 welcome, 2 notifications, 3 profile (empty), 4 profile (typing, keyboard up), 5 done. One sheet
per device. Judges see the sheets only, never code or the author's notes.

| Row | 6 | 8 | 10 |
|---|---|---|---|
| A. First impression (what OGS is in 3 s) | Copy says it, the picture doesn't | Picture and line together say "phone casts, TV plays, family together" at a glance | Nintendo Switch first-run / Apple TV app welcome: you know the product before reading |
| B. Identity (ownable look) | On-palette but generic shapes / placeholder mark | Recognisably the same app as the Library (dusk, Fraunces, painted art) with one ownable motif | Could only be OGS: its own art and motif, carried across all pages |
| C. Hierarchy of the two paths | Both present, one reads as an afterthought | Primary and secondary are clearly both buttons, primary obvious, both in thumb reach | Apple sign-in-or-create screens: zero hesitation which to tap |
| D. Craft (type, spacing, alignment, rendering) | Visible defects (clipping, banding, odd gaps) | No defects; consistent rhythm, type scale and margins on every page | Apple HIG-level polish |
| E. Fits 375 and 402 pt | Something crowded or floating on one size | Both sizes balanced, nothing clipped or cramped, keyboard never covers actions | Each size looks designed for itself |
| F. Copy | Clear but clunky or generic | Short, plain, warm; every line earns its place | A line a family remembers |
| G. Consistency across the four pages | Pages look like different apps | One system: same header, type, buttons, art language | Pages feel like one continuous story |

Stop: every row >= 8 after >= 3 rounds, or min flat two rounds after one pivot.
Keep/revert: blind pairwise before/after (A/B random), majority prefers after, no row drops >= 2.

## Result (rounds 00-05, all kept; log in log.tsv, sheets in rNN/)

| Judge | r00 min | r05 rows (A B C D E F G) | r05 min |
|---|---|---|---|
| Codex (gpt-5.6-sol) | 6 | 7 7 9 8 8 8 8 | 7 |
| Claude critic (fresh each round) | 6 | 7.5 7 8 6.5 7 7 6.5 | 6.5 |

Round 01 was judged twice: the first Codex verdict preferred r00 partly because the rig's shared
API took the typed @id mid-run (another agent's tests). The rig now types a unique name and taps
Next again on "taken"; both rounds were reshot and rejudged.

Stuck rows and why:
- B Identity / A first impression (Codex): Rocket Crew's art dominates the TV, so the welcome can
  read as one game's onboarding. Structural: the hero shows one game at a time (frozen for shots;
  live it cycles five games every 3.6 s).
- D Craft / G Consistency (Claude): the hero is a different size on every page, and tall phones
  leave loose vertical bands. Structural: each page is laid out on its own.

Next directions (recommendation first):
1. One shared page grid for all four pages: a fixed-height hero zone (same TV size, only the
   sitter and chip change), the title block under it, actions pinned to the bottom.
2. Make the TV say "a library", not "one game": a launcher-like row of covers on the TV, or the
   cycling games with a visible "5 games" cue, with OGS's wordmark on the TV bezel.
3. Copy pass the judges asked for that touches the spec/acceptance: "free" -> "available",
   "Let's go" -> "Start playing", "Turn alerts for board games" -> "Your turn in board games".
