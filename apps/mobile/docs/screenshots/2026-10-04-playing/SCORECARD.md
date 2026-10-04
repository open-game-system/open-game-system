# Playing tab scorecard

The OGS app's first tab (iPhone, Expo). It opens on Playing only when a game you were playing is
live. It lists every sitting you're in (each with Rejoin), and suggests what to start when
nothing is in progress. Vocabulary (owner): Rejoin, In progress, Playing, Cast to TV, Stop casting.

References (the "10"): Apple TV app Up Next, PS5 activity cards, Nintendo Switch home,
Spotify Home "Jump back in", NYT Games home. 6 = a competent indie app. 8 = a first-party product
or design lead would sign off shipping it. 10 = reference-grade. Grade every row against the
references, never against the previous round.

| Row | 6 | 8 (ship bar) | 10 |
|---|---|---|---|
| Job & IA | the screen makes sense once you know the app | in every state a newcomer can say in one sentence what this tab is for and what is on it | it's just "what we're playing" |
| Primary action | the buttons work but compete or are missing in some states | exactly one obvious primary action per state; nothing is a dead end | the right thing to tap is the first thing you see, every time |
| Cast & where it plays | cast state is implied | whether the TV is on (and which), and where each game will play (TV or this phone), is legible before you tap | you never wonder where a tap will land |
| Sittings & Rejoin | rows list sittings | several sittings incl. two of one game read apart at a glance; the live one clearly outranks the rest; Rejoin is unmistakable | Switch/PS5-grade "jump back in" |
| Empty state | says nothing is going | invites you to start something with honest, relevant picks; uses the space; never promises what it doesn't show | you want to play something after looking at it |
| Edge states | errors are generic or blank | loading, offline, empty library, phone-only game each designed: calm, specific, one recovery action | handled before you notice |
| Visual craft | consistent but generic (dark cards, identical rows) | distinctive dusk + Fraunces identity; type scale, spacing, art cropping at first-party level; no AI-slop tells | you'd screenshot it |
| Thumb & a11y | most targets reachable | 44 pt targets, AA contrast, primary action in thumb reach on a 6.3" phone, labels read well in VoiceOver | exemplary |
| Copy | understandable | the owner's words (Rejoin, In progress, Cast to TV); no jargon ("in flight"), no colons promising lists that aren't there | every line earns its place |

## Log

Per round: both critics' scores, then the minimum per row.

| Round | Critic | Job | Primary | Cast | Sittings | Empty | Edge | Visual | A11y | Copy | Min |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 00 | product (Claude Opus) | 5 | 4 | 3 | 5 | 4 | 2 | 5 | 6 | 4 | 2 |
| 00 | visual (Claude Opus) | 4 | 4 | 3 | 5 | 4 | 2 | 5 | 5 | 4 | 2 |
| 00 | **min per row** | 4 | 4 | 3 | 5 | 4 | 2 | 5 | 5 | 4 | **2** |
| 01 | product (Codex gpt-5.6-sol, medium) | 6 | 5 | 4 | 7 | 7 | 4 | 6 | 5 | 6 | 4 |
| 01 | visual (Claude Opus) | 7 | 7 | 6 | 6 | 6 | 4 | 5 | 6 | 5 | 4 |
| 01 | **min per row** | 6 | 5 | 4 | 6 | 6 | 4 | 5 | 5 | 5 | **4** |
| 02 | product (Claude Opus) | 7 | 7 | 6 | 6 | 7 | 5 | 6 | 6 | 6 | 5 |
| 02 | visual (Codex gpt-5.6-sol, medium) | 7 | 6 | 6 | 7 | 6 | 5 | 6 | 6 | 6 | 5 |
| 02 | **min per row** | 7 | 6 | 6 | 6 | 6 | 5 | 6 | 6 | 6 | **5** |
