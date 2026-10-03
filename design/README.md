# OGS design prototype

A clickable, multi-device prototype of the OGS app (fake data, no backend), built to be graded by
the `design-hillclimb` loop (`~/src/skills/design-hillclimb`). Not the Expo app: speed of
iteration beats shippability here. Self-contained: nothing outside `design/` is touched.

```sh
pnpm install --ignore-workspace
pnpm dev                                  # http://localhost:4316 — index of concepts, scenarios, flows
pnpm shoot --concept <id> [--only swap.]  # screen sheet + checks → critic/shots/<id>/
pnpm flows --concept <id> [--flow swap]   # bot-played flow videos → critic/shots/<id>/flows/
scripts/round.sh NN                       # a full round of evidence → critic/rounds/NN/
```

## Surfaces

| device | size | who | rules |
|---|---|---|---|
| `phone` | 390×844 | grown-up | thumbs, one hand, 44 pt targets, reads |
| `ipad` | 1180×820 **landscape** (held in two hands, thumbs at the bottom edge) | Juneau (5, reads a handful of words) or Ava (almost 3, mashes) | **no words** (checked), huge juicy targets, nothing an almost-3-year-old can derail |
| `tv` | 1920×1080 | everyone, from 3 m | a cast stream nobody can touch; text ≥ 24 px (checked); nothing covers the focal area of the game |

## URLs (the scenario switcher)

`?concept=<id>&scenario=<scenario-id>&device=<phone|ipad|tv|stage>[&shot=1][&flow=<flow-id>]`

- The app writes `data-scenario-ack="<concept>/<scenario>/<device>"` on `<html>` once it rendered
  exactly that; the shooter refuses a shot without it. Unknown ids render an error and set
  `data-scenario-error`.
- `shot=1` freezes all CSS animation/transition (shots are never mid-fade). Write entrance
  animations with `animation-fill-mode: both` so the frozen frame is the end state.
- `seat=<person>` tells the surface whose device it is (`seat=ava` = Ava's iPad). The stage shows
  both kids' iPads (`seat=juneau`, `seat=ava`); flow steps can target one with `seat`.
- `device=stage` shows TV | phone | both iPads side by side sharing **one session** (one store), so a tap
  on the phone visibly changes the TV and the iPad. Flow recordings use it.

## Writing a concept

One folder, `src/concepts/<id>/`, whose `index.tsx` exports `concept = defineConcept<S>({...})`
(`src/harness/types.ts`):

- `S` is your session state (whatever shape you like). `Surface({ device, store, shot })` renders
  one device from it; `useStore(store)` subscribes; `store.update(s => next)` changes it. Every
  device in the stage shares the store, so cross-device cause and effect is just state.
- `scenarios`: every screen × state you want graded. Id `<flow>.<NN>-<slug>`
  (`swap.03-tv-cutover`), a label, the flow (`FlowId`), the state kind (`default | empty |
  loading | partial | success | error | interrupted | undone`), the devices that take part, and
  `build()` returning the state.
- `flows`: bot scripts. `start` is a scenario id; each step taps the element with
  `data-bot="<name>"` on a device, with an optional caption (`mark`) and `wait` (ms). Taps per flow
  are counted from these steps, so a flow's steps are its real taps.
- Mark grown-up-only text that legitimately appears on an iPad (e.g. a grown-up pairing screen)
  with `data-grownup` on its container; everything else on `ipad` counts as kid-facing.
- Put fonts/tokens in `concept.css` (a Google Fonts `@import` is fine). Concepts must not share
  CSS with each other.
- `pnpm typecheck` covers every folder; errors outside your folder aren't yours.

## Fake world (`src/world/`)

Read it before designing; use it, don't invent parallel data.

- `games.ts` — the library as Tier 0 manifests (id, name, shape couch/live/async, tier, roles,
  palette and art from each game's own repo, its look in one line).
- `family.ts` — households (the Mumms: Jonathan, Mom, Juneau 5, Ava 2 + devices incl. Ava's iPad at
  9% battery; the Okafors in Seattle; Nana & Pop in Boise with no TV), `NOW` (Fri 3 Oct, 7:10 pm).
- `instances.ts` — what games report: Rocket Crew mission 6 at Navigator rank (active), Bake Shop
  day 4 (suspended Tuesday), Story Nook "Juneau's character is ready", Peekaboo + Night Flight,
  Hearthisle game night paused at turn 14 across three homes, seven Word Duel games (two your
  turn, one finished, one expired), and world-clock events (grown-ups only).

## Art (`public/art/`)

Real captures from each game's trailer and assets: `<game>/tv.jpg` (clean 1920×1080 gameplay),
`alt.jpg`, plus extras (Story Nook painted characters as cut-outs `char-*.webp`, Bake Shop
customers). The manifest's `art` field points at them. Word Duel has no art (design-only game).
Never stand in initials-in-squares or lorem for game art.
