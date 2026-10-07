# TV platform coverage estimates

**Date:** 2026-10-06
**Status:** Accepted as planning input. **All numbers are estimates and unverified for custom receivers**; revisit with real device tests.
**Builds on:** [TV platforms](2026-10-04-tv-platforms.md)

## Context

The launcher reaches a TV through Cast (Chromecast, Google TV, and newer LG/Samsung sets with Cast), through direct web apps (Fire TV, Samsung, LG), or through a native shell (Apple TV). Which platform to build next should follow reach, so the owner asked for rough household coverage per step.

## Estimates (US TV households, cumulative)

| Step | Adds | Cumulative reach |
|---|---|---|
| Chromecast and Google TV (today) | the cast path already built | ~10-15% |
| Plus newer LG and Samsung sets with built-in Cast, **if** custom receivers run on them | no new client | ~15-25% |
| Plus Amazon Fire TV | thin WebView app | ~30-40% |
| Plus Apple TV | native tvOS launcher shell + WebRTC player | ~45-55% |
| Plus Samsung and LG web apps | direct web launcher | ~65-70% |
| Roku | no web engine, no WebRTC; unreachable | ~30% stays out |

Sources: Parks Associates (April 2026), Pixalate (Q4 2025), FlatpanelsHD (April 2026, Samsung Cast), CEPro (January 2024, LG Cast). Ranges are rough readings of these sources, not figures any of them publish for OGS. Whether a **custom** Cast receiver runs on Samsung and LG sets is **unverified**; the 15-25% step assumes it does.

## Decision

Use the table to order TV work, not as a promise:

1. Keep Chromecast and Google TV working (done; real-device test still open in the roadmap).
2. Test a custom receiver on a Samsung and an LG set with Cast before counting that step.
3. Fire TV is the largest cheap step; Apple TV needs a native shell; Samsung/LG web apps are the biggest total but are two store submissions.
4. Roku stays Not planned (see the 2026-10-04 ADR).

## Consequences

- The roadmap's "Later" TV items are ordered by this table. Update the table, not the roadmap, when better numbers arrive.
- Joining by QR and web join (see [the launcher owns joining](2026-10-06-launcher-owns-joining.md)) is platform-independent: it works on every TV the launcher reaches.
