| Row | Score | Evidence (shot id) | Biggest gap |
|---|---:|---|---|
| R1 | 8 | 02–06, 13; top icon rail, room-filling focused art, large left logo, activity cards below | Activity cards and room controls still create enough simultaneous emphasis that the home is not instantly self-explanatory at platform-best level. |
| R2 | 7 | focus-strip; 03–06 | The enlarged ring is clear, but intermediate crossfades become muddy and the room response lacks the weight and decisiveness of first-party focus motion. |
| R3 | 7 | 02–09, 13, 16 | Excellent bespoke art and logos are undermined by uneven scrims, dense metadata, and inconsistent visual hierarchy across different backgrounds. |
| R4 | 8 | 02–06, 09, 16 | Picture-led game identities and Surprise me work without reading, but the small top-row choices and visually similar activity cards remain demanding for an almost-3-year-old. |
| R5 | 8 | 03–08, 13 | Paused sittings expose when and where to resume, and Continue leads on the game page; the home cards could make the resume point more visually dominant than their badges and captions. |
| R6 | 8 | 02–06, 13, 15 | Joined players, remote holder, code, TV, and host are correctly quiet and peripheral, but the tiny clustered people area feels informational rather than warm or alive. |
| R7 | 7 | 02–09, 13–16; DOM check | All checked text meets size and title-safe rules, but contrast weakens on Hearth Isle and during crossfades, while several labels remain optically small and crowded at 3 m. |
| R8 | 7 | 01, 07–12, 14–15 | The complete state set is specific and coherent, but connecting placeholders, the frozen cut-over frame, and failure treatment feel less resolved than the home experience. |

| # | Fix (concrete, implementable) | Rows lifted | Shots it should change |
|---:|---|---|---|
| 1 | Rebuild focus transitions as a single 250–350 ms weighted motion: move and scale one persistent focus frame, switch identity immediately, then crossfade only the background through a controlled scrim with no double-exposed UI. | R2, R3, R7 | focus-strip, 03–06 |
| 2 | Establish per-game focal-area and contrast metadata, then position a consistent left-side content stack and adaptive gradient so logos and text never compete with subjects or disappear on bright/detailed art. | R1, R3, R7 | 02–06, 09, 13, 16 |
| 3 | Unify transitional states around the selected game’s artwork and geometry: replace generic connecting skeletons, animate the selected tile continuously into the framed game, and give loading/failure/reconnecting one consistent status component. | R2, R8 | 01, 10–12, 14–15 |
