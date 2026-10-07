# The launcher owns joining: QR, web join, phones follow the TV

**Date:** 2026-10-06
**Status:** Accepted (owner-approved direction 2026-10-05/06; **planned, not built**). Design canvas: https://claude.ai/artifact/5CoghVnLznn5pSdENvazJM
**Builds on:** [The OGS game contract](2026-10-04-ogs-game-contract.md), [Couches join the game's room](2026-10-05-couches-join-the-games-room.md)

## Context

Joining a couch today means opening the OGS app, tapping Join with TV code and typing six characters. Games that run outside OGS draw their own room codes, and some still do on an OGS TV. A competitive pass (2026-10-05/06) found:

- **AirConsole:** scan a QR, no install, one session across many games. Phones are anonymous gamepads, there are ads, and it needs a browser on the TV.
- **Netflix TV games:** already on every TV, polished, household profiles. A new QR scan per game, the Netflix app required, closed catalogue.
- **Rocketcrab:** a party lobby that frames any web game, passes the name in, and links from a game's own lobby to the host. No TV, a spoofable host flag, no identity across nights.
- **Jackbox:** a TV room code and a web phone page, the benchmark for "no install".
- **Discord Activities:** the host's session carries everyone into a game.

Our edge is what none of them have: games know who you are, sittings continue tomorrow, kids' iPads follow, one cast lasts all evening. Our gap is the door.

## Decision

1. **The launcher owns the join QR**, next to the TV code, on Home and Getting ready. It encodes `https://opengame.org/join/<code>`: the OGS app opens if installed, otherwise a web join page. Games never draw join codes. QR is a launcher-level feature, not a game-level one.
2. **Guests join from the browser with no install**: a name and a picture put them on the couch as a guest profile (session-scoped, token `guest: true`). The app is the upgrade (profile, friends, pushes, sittings), not the door.
3. **Every couch phone follows the TV.** Home is the remote; when a game starts every couch phone opens that game; Home brings them back. The rule fires on a change of the current game, not on every update.
4. **Mid-game invites** come from a phone's Invite button or the game's `ogs:invite` message. The launcher shows a small QR card in the corner named by the manifest's new optional `inviteCorner`, never over the focal area; it hides after 30 s.
5. **Transfer link:** a game's own site links to `https://opengame.org/play/<appId>?room=<room>` ("Play on TV with OGS"), the same link the friend invite already uses.
6. **Several households in one room** stays as decided in 2026-10-05; see `docs/exec-plans/active/2026-10-05-multi-couch-handoff.md`. Not repeated here.

## Alternatives considered

- **Each game draws its own QR (AirConsole style):** a new scan per game, and every game re-implements it. Rejected: it is exactly the Netflix weakness.
- **App required to join:** keeps identity simple but loses grandparents and visitors. Rejected; guests are second-class by design (no friends, nothing kept) and the app upgrade is offered.
- **Full anonymous gamepad (no names):** loses "games know who you are". Rejected; a guest still has a name and a sticker.
- **QR in the game's frame, positioned by the game:** lets a game cover its own focal area or hide the code. Rejected; the launcher draws, the game only names a corner.

## Consequences

- New surfaces: launcher QR card and invite card (`apps/tv`), `opengame.org/join/<code>` and the web join page, guest profiles and guest game tokens (`services/api`, `ogs-protocol`), universal/app links in the app. All **planned**.
- New contract items (see `docs/specification.md` §8): `ogs:invite`, `inviteCorner`, `guest` token claim, "games never draw join codes". All additive and optional; a game that does none of it still runs.
- Games that draw their own join UI on an OGS TV already break rule 1 of the contract (§5); the rule now names QR and codes explicitly.
- Guests are untrusted for persistence: a game must not store scores against a guest `sub` beyond the session.
- Typing the TV code in the app keeps working.
- Needs: a security review of the guest path (rate limits on `/join/<code>`, code entropy, host can remove a phone).
