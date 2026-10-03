# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 2 Tonight | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 3 Switch games | `01-mid-game` PTK<br>`02-ava-mid-game` K<br>`03-running-order` PT | MISSING | `04-saving` PTK<br>`05-ident` PTK<br>`06-following` PTK | MISSING | `07-on-air` PTK<br>`08-ava-on-air` K | MISSING | `09-ava-asleep-cut` PK<br>`10-ava-asleep` PTK | `11-back` PTK |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-list` P<br>`02-nana` P<br>`07-new` P | MISSING | MISSING | `03-placing` P<br>`04-ready` P | `05-sent` P<br>`06-list-after` P | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| Home | `01-on-now` PTK<br>`02-continuity` PTK<br>`03-ava-idle` K<br>`04-later` P | `05-first-run` P | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

10/80 cells designed · 23 scenarios
