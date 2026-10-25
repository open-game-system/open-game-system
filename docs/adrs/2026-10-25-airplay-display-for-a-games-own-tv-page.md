# 2026-10-25: A game's own app may drive the AirPlay TV window with its own TV page

## Status

Accepted. Adds to [2026-10-23-airplay-display](2026-10-23-airplay-display.md); does not change it.

## Context

- The OGS path (`cast: { airplay: true }` + `castGameStores`) loads the cast's LOAD_VIEW URL, the OGS
  TV launcher, in the TV window. That needs the game in the OGS catalogue and a couch session.
- Crak & Bam's app (`~/src/crak-and-bam/app`) proved the module first with its own local copy: it
  shows the table's TV page (`/tv/<code>?k=<tvKey>&household=…`) directly, from its own TV
  controller, with no OGS couch. To drop that copy and use the shell's module, the shell's module
  needed three things the copy had:
  1. telling the phone page when the TV window comes and goes, so the page goes silent while the TV
     plays the table's sound;
  2. handing the app's log ids to both pages, so a device's app, phone page and TV page lines join
     up in the client log;
  3. the app's own idle card ("Open a table on your phone…", the game's colour), not the OGS one.

## Decision

- `OgsAirplayDisplay` gains `setLogContext(context)`, `syncPhonePages()` and `setIdleCard(line,
  background)`; `AirplayDisplay` (JS) exposes them as `setLogContext`, `syncPhonePages` and
  `setIdleCard({ line?, background? })`.
- Names are OGS-wide, not per game: the phone page gets `window.__OGS_TV__` and an `ogs:tv`
  CustomEvent `{ connected }` on every connect and disconnect (and on `syncPhonePages`); both pages get
  `window.__OGS_LOG__` (the TV page at document start). The TV WebView's user agent stays
  `OgsTV/airplay`.
- A game's own app may use `airplayDisplay` from `@open-game-system/shell/app` directly with its own
  TV URL instead of the cast backend. That path is the app's: its own Show on TV sheet, its own away
  notification, its own client log. The OGS path is unchanged and remains the default for catalogue
  games.

## Consequences

- In the OGS app the phone WebView now also receives `ogs:tv` events (before, the module only logged
  the phone WebViews). Pages that don't listen are unaffected.
- A game page that wants to go quiet while its app's TV is on listens for `ogs:tv`; Crak & Bam's
  page moved from its own `crakbam:tv` / `__CRAKBAM_*` names to these.
