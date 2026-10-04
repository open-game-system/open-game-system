# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | `02-pick-tv` P | `01-open` TPK | `03-searching` P<br>`05-connecting` TPK | MISSING | `06-room-fresh` TPK | `04-no-tv` P | MISSING | MISSING |
| 2 Tonight | MISSING | MISSING | MISSING | `01-who-picker` TPK | `02-ava-seated` TPK | MISSING | MISSING | MISSING |
| 3 Switch games | `01-playing-rocket` TPK<br>`03-bake-open` TPK | MISSING | MISSING | MISSING | `02-home` TPK<br>`04-bake-playing` TPK | MISSING | MISSING | MISSING |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | `01-window` TP | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-note` TP<br>`02-on-phone` TP | MISSING | MISSING | `03-tiles` P | `04-sent` TP | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | `05-recasting` TP | MISSING | `02-remote-picked-up` TP | `04-cast-dropped` TPK | `01-remote-asleep` TP<br>`03-asleep-in-game` TPK | MISSING |
| Home | `01-room` TP<br>`02-focus-bake` TP<br>`03-focus-night` TP<br>`04-remote-only` TP<br>`05-detail-rocket` TPK<br>`06-detail-remote` P | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

18/80 cells designed · 28 scenarios
