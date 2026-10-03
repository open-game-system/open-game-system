# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 2 Tonight | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 3 Switch games | `01-mid-game` PTK<br>`02-choose-next` PTK | MISSING | `03-saving` PTK<br>`04-tv-cutover` PTK<br>`05-kids-following` PTK<br>`07-ava-following` K | MISSING | `06-bake-shop` PTK<br>`10-ava-caught-up` PK | MISSING | `08-ava-asleep` PK<br>`09-ava-asleep-progress` PT | `11-undo-resuming` PTK<br>`12-undone` PTK |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `00-push` P<br>`01-list` P<br>`02-nana` P<br>`06-new-game` P | `07-empty` P | MISSING | `03-placing` P | `04-sent` P<br>`05-list-after` P | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| Home | `01-tonight` PTK<br>`02-before-the-game` PTK<br>`03-switch-sheet` P<br>`04-family` P | `05-first-run` P | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

11/80 cells designed · 25 scenarios
