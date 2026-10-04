# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | `02-pick-tv` P | `01-app-open` PTK | `04-connecting` PT | MISSING | `05-launcher-ready` PTK | `03-no-tv` P | MISSING | MISSING |
| 2 Tonight | `01-who` PTK | MISSING | MISSING | `02-who-juneau` PTK | `03-who-ready` PTK | MISSING | MISSING | MISSING |
| 3 Switch games | `01-rocket-playing` PTK<br>`02-ava-helper` K<br>`04-touch-bake` PT | MISSING | MISSING | MISSING | `05-bake-playing` PTK<br>`06-bake-ava` K | MISSING | `03-home` PTK | MISSING |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-on-tv` PT<br>`02-handoff` PT | MISSING | MISSING | `03-placed` P | `04-sent` PT | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | `05-recasting` PT | MISSING | `02-remote-taken` PT<br>`06-resumed` PTK | `04-cast-dropped` PTK<br>`07-dropped-launcher` P | `01-remote-asleep` PT<br>`03-asleep-in-game` PT | MISSING |
| Home | `01-browse-touch-bake` PT<br>`02-remote` PT<br>`03-remote-your-turn` PT<br>`04-couch-games` T<br>`05-game-nights` PT<br>`06-library` T<br>`07-detail` PT<br>`08-keyboard` P | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

19/80 cells designed · 33 scenarios
