# Brief: the OGS app

**What it is.** The hub that launches web games, casts them to the TV, keeps each family's state,
and brings people back to games. A grown-up phone runs it; kid iPads follow it; the TV shows the
game as a cloud-rendered stream (each cast is a fresh cloud browser; nothing is stored on the TV,
and nobody can touch the TV).

**The family (the playtesters).** Two grown-ups; Juneau, 5, reads a handful of words; Ava, almost
3, mashes. Kids each have an iPad (held in thumbs, often landscape); grown-ups have phones; the
TV is a Chromecast. Every design must survive a 5-year-old holding an iPad and an almost-3-year-old
mashing one.

**The games.** Five family "cast party games" (Rocket Crew, Bake Shop, Story Nook, Peekaboo
Garden, Night Flight): a TV, a grown-up phone that reads, kid devices with no words, 5–15 minutes.
Plus Hearthisle (an original island-building board game: a live game night across 2–4
households, an hour or more, often over two nights) and Word Duel (an async two-player word
game, a move whenever, over days; design-only stand-in).

## The problems

1. **Switching games is where the evening dies.** Today: back out (progress lost), open the next
   game, cast again, a new QR on the TV, every kid device scans it and picks a role again, the host
   re-sends a save.
2. **Nobody knows who the family is.** Every game re-asks who's who.
3. **State is scattered** (one phone's WebView storage per game; a half-finished sitting is lost).
4. **Three shapes of game in one launcher:** couch co-op (one household, one save slot per game,
   together, 3–15 min) · live game night (2–4 households, one at a time, paused ones wait for next
   night, each home casts the same board to its own TV or plays on phones) · async duels (2 people
   anywhere, 3–5+ open at once, one per opponent, over days, on a phone).
5. **Players in other homes** join the same game; a seat is a whole household or one person; each
   home sees only its own hands.
6. **Non-negotiable: adding a game is config, not app code.** A game joins with a manifest, some
   URLs, and light auth for persistent state. Nothing in the app changes per game.

## Directions so far (hypotheses, not decisions)

- **Layers of state:** Household (forever: people, age bands, devices, TVs) → Couch session
  (tonight: the cast, who's here, current game; survives swaps) → Game room (one sitting) → Save
  slots (household × game + optional resume point) → World clock (between sittings: ticks, turns,
  pushes to grown-ups only).
- **Instance cards:** a game's server can report each instance (status, title, detail, seats,
  whose turn, a URL back in); OGS shows them on home, groups "Your turn" across games, sends the
  push. Statuses: lobby → active ⇄ suspended → completed / expired, plus waiting.
- **Integration tiers:** Tier 0 manifest (listed + castable) · Tier 1 signed identity token +
  OGS-hosted saves (persistent state without accounts) · Tier 2 one POST per instance change (home
  cards + pushes).
- **Swapping games:** the couch session suspends the old game (resume point → save slot), makes
  the new room with the roster, swaps the view URL inside the same cast session, and sends every
  paired device straight in by name. No QR, no picker.
- **Pairing:** a kid's iPad is paired once ("this iPad is Juneau's") and follows tonight's game.
- **Brand (open):** a family hub, an app per game, or a hub with spin-outs on one shell.

## Cast first (the family's direction after testing the real app, Oct 3)

Testing today's app: each game owns its own cast, so switching games tears the stream down and
recasts (unload, reload, wait). New model: **casting is the first thing you do in OGS,
independent of any game.** The TV then shows the OGS launcher (a PS5 / Switch / Netflix-style
home) in the cloud browser that streams to the Chromecast; games launch inside that same cast
session, so a switch never reloads the stream. The grown-up phone is the controller, either by
browsing on the phone (the TV follows) or as a Roku-like remote that moves a focus ring on the TV.
In a game the phone is that game's controller with an OGS Home button back to the launcher.
Architecture consequence: the launcher hosts each game's TV page (e.g. in a frame) inside one
long-lived cloud browser, so games need no cast code at all; a TV URL in the manifest is enough.

## Taste rules (the family's)

No emoji. No faces on objects (rockets, planets, props). Nothing covers the focal area of the TV
scene. Every game keeps its own art direction. No words on kid screens.
