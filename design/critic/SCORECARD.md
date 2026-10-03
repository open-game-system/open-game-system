# OGS app design scorecard

Graded like a first-party product + design review. **6 = a competent indie app. 8 = a
first-party product/design lead would sign off shipping it. 10 = reference-grade.** Grade every
row against the references, never against the previous round. Stop when every row ≥ 8.

**References (the "10"):** Nintendo Switch home and user picker · PlayStation 5 activity cards
and Game Base · Apple TV + iPhone continuity · Apple Arcade / Game Center · Jackbox (phones as
controllers, room joins) · Netflix Kids profiles · Words With Friends and NYT Games (async turn
lists) · Board Game Arena (multi-home play). Use their patterns, never their trade dress.

| Row | 6 | 8 (ship bar) | 10 |
|---|---|---|---|
| **Mental model & IA** | each screen makes sense alone; a grown-up can't say what "home", "tonight" and a game's status are | a grown-up explains "games, tonight, your turn" in one sentence after one use; couch, live and async games feel like one system | the model disappears: Switch-level "it's just how it works" |
| **Flow efficiency** | flows work but repeat QR scans, role picks or confirms | a game swap has zero QR scans and zero role picks on kid devices; taps per key flow counted (checks.json) and each one justified | the shortest possible path; nothing to undo |
| **State & continuity** | the current game keeps state; leaving loses some; statuses vague | nothing is lost by leaving; every game's status is legible at a glance (paused at, whose turn, waiting on) | resumes exactly, everywhere, like PS5 activities |
| **Multi-home & social** | inviting works but seats, households and visibility are unclear | inviting a household, picking seats (a person or a household), and who-sees-what are obvious and feel safe | Board Game Arena's clarity with a living room's warmth |
| **Async & notifications** | a list of games; pushes generic | "your turn" across games is effortless (NYT Games / WWF level); pushes go to grown-ups only, are useful, never nag kids | you look forward to the push |
| **Kid surfaces** | big buttons, some words, a toddler can leave the screen | no words (checks.json kidWords = 0); huge, juicy, impossible to break; an almost-3-year-old can't derail anything; the device "just follows" the game | Nintendo-grade kid UX; feels like a toy |
| **TV surfaces** | a web page on a TV; small text; dead lobbies | readable at 3 m (no text < 24 px); lobby and between-game screens feel like a console, not a web page; never covers the game's focal area | Apple TV / Switch-grade ambient presence |
| **Trust & family safety** | settings exist somewhere | who can join, what other homes see of our kids, and what each device is are visible at the moment of decision; reversible | trust is ambient; you never wonder |
| **Visual craft & brand** | consistent but generic (rounded dark cards, stock sans, initials) | a distinctive, cohesive identity across phone, iPad and TV that lets each game's art lead; type, spacing and colour at first-party level; no AI-slop tells | instantly recognisable from one cropped screen |
| **Motion & feel** | fades and slides | transitions explain what's happening (the cast cut-over, a device following, a turn arriving) | motion you'd show off in a keynote |
| **Edge & failure states** | generic error toasts | every failure in flow 9 is designed: calm, specific, one recovery action, nothing lost | failures feel handled before you notice |
| **Developer integration** | a docs page lists fields | a vibe-coded game reaches the library with only a manifest; the tiers are obvious and each one's payoff is visible in the library | Stripe-docs clarity |
| **Accessibility** | some labels | WCAG AA contrast, 44 pt targets, Dynamic Type survives, colour never carries meaning alone (graded mostly from checks.json) | exemplary |

Thresholds in `scripts/shoot.ts` (`THRESHOLDS`): targets 44 pt, contrast 4.5 (3.0 for ≥ 24 px or
≥ 18.66 px bold), TV text ≥ 24 px, kid words 0. Changing one is logged here as old → new + why.

## Log

| Round | IA | Flow | State | Multi | Async | Kid | TV | Trust | Visual | Motion | Edge | Dev | A11y | Min | what changed / largest gap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
