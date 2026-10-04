# Scorecard: OGS app, TV tab remote (phone, iPhone 17 Pro)

The surface: the TV tab of the OGS companion app once the phone has cast the OGS launcher to the
TV. It is the household's TV remote for the evening: a d-pad drives the launcher's focus ring on
the TV, OK selects, Back and Home navigate, and the grown-up can change which TV is cast to or stop
casting. Used one-handed on the couch, eyes mostly on the TV.

Brand: OGS dusk palette (deep violet dusk backgrounds, cream text, peach/lamp/ember accents),
Fraunces display for titles, painted animal stickers for people (never initials), the dotted path
motif. No emoji, no faces on objects.

10 = Apple's iOS Apple TV Remote (Control Center) and Google TV app remote, Nintendo Switch system
UI craft. 8 = a first-party design lead would sign off shipping it. 6 = works, but reads like a
generic form / template.

| Row | 6 | 8 | 10 |
|---|---|---|---|
| Hierarchy & context (what's on the TV, which TV, who has the remote) | plain status text line | one glance tells TV, content, holder; order matches importance | the screen feels "connected" to the TV like Apple's remote header |
| Control ergonomics (targets, thumb reach, one-handed use) | targets ≥ 44pt, cramped | d-pad zones ≥ 56pt, primary controls in thumb zone | effortless blind use; nothing important out of reach |
| Feedback (pressed states, visible response) | default opacity flicker | clear pressed state on every key | pressed states feel physical; cause→effect obvious |
| Identity (ownable OGS, not generic) | generic dark UI | recognisably OGS from a crop | could only be OGS; motif used with restraint |
| Typography | system defaults, weak scale | clear scale, Fraunces used with intent | refined rhythm, every label earns its size |
| Layout & use of space | dead zones, unbalanced | balanced, no awkward voids | composed like a physical object |
| Destructive action (stop casting) | competes with navigation | quiet, guarded, explained | quiet, guarded, reversible in feel |
| TV switching (picker) | absent or a bare list | clear current vs others; scales to many TVs | as good as iOS AirPlay picker |
| Iconography & craft (glyphs, edges, alignment) | unicode glyphs, misalignment | crisp consistent icons, aligned | pixel-perfect |

## Log (round 2 run; A/B blind pairwise, absolute scores per row)

Judges: Codex `gpt-5.6-sol` (reasoning medium) and a fresh Claude Opus critic subagent each round; both see only the brief, this scorecard and the two sheets.

| Round | Judge | Hier | Ergo | Feedback | Identity | Type | Layout | Destructive | Switching | Icons | Min | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| r10 (before) | Codex | 5 | 8 | 6 | 7 | 7 | 6 | 3 | 5 | 7 | 3 | |
| r10 (before) | Claude | 6 | 6 | 5 | 6 | 6 | 6 | 3 | 5 | 6 | 3 | |
| r11 | Codex | 9 | 8 | 8 | 9 | 8 | 8 | 8 | 9 | 8 | 8 | B (r11) decisively better; kept |
| r11 | Claude | 8 | 7 | 7 | 7 | 7 | 6 | 8 | 8 | 7 | 6 | B (r11) clearly better; kept |
| r12 vs r11 | Codex | 9 | 8 | 8 | 9 | 8 | 8 | 9 | 8 | 7 | 7 | A (r12) better (pressed model, vertical fit); kept |
| r12 vs r11 | Claude | 8 | 7.5 | 7 | 7.5 | 7 | 7.5 | 8 | 8 | 7.5 | 7 | A (r12) better (tighter composition, progressive picker); kept |
| r13 vs r12 | Codex | 7 | 7 | 8 | 8 | 7 | 6 | 9 | 7 | 8 | 6 | prefers r12 (chips under Cast too small, lower void) |
| r13 vs r12 | Claude | 8 | 7 | 7 | 8 | 8 | 7 | 8 | 7 | 7 | 7 | prefers r13 (no orphan, Join visible); split vote, reverted as a whole, uncontested parts carried into r14 |
| r14 vs r12 | Codex | 8 | 8 | 8 | 9 | 8 | 8 | 8 | 8 | 8 | 8 | A (r14) better; every row at 8+; kept |
| r14 vs r12 | Claude | 7 | 7 | 7 | 7 | 7 | 7 | 8 | 7 | 7 | 7 | A (r14) better (Join visible, no orphan, rows with glyph + check); kept |
| r15 pivot vs r14 | Codex | 9 | 8 | 9 | 9 | 7 | 9 | 9 | 9 | 8 | 7 | prefers r15 (holder + TV as one header) but flags the member footer truncating "You have the…" |
| r15 pivot vs r14 | Claude | 7.5 | 7 | 7 | 7 | 6.5 | 6.5 | 8 | 7 | 6.5 | 6.5 | prefers r14 narrowly (r15 leaves a ~60pt band above the pad, truncates in 13); split vote, reverted. Plateau after the pivot: stop. |

Final kept state: r14 (commit e630879d). Codex min 8 (every row at 8 or more); Claude min 7.
