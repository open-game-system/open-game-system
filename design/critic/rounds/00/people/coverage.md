# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 2 Tonight | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 3 Switch games | `01-mid-game` PTK<br>`02-choose` P | MISSING | `03-saving` PTK<br>`04-tv-cutover` PTK | `05-kids-follow` PTK<br>`07-ava-following` K | `06-loaded` PTK<br>`10-ava-caught-up` KP<br>`12-baking` KT | MISSING | `08-ava-asleep` PTK<br>`09-ava-chime` PK | `11-undo` PTK |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `00-push` P<br>`01-list` P<br>`02-nana` P | MISSING | MISSING | `03-placing` P | `04-sent` P<br>`05-list-after` P | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| Home | `01-people` P<br>`03-tv-ambient` T<br>`04-ipad-idle` K<br>`06-us-thread` P<br>`07-game-night` P<br>`08-library` P<br>`09-household` P | `05-first-run` P | MISSING | `02-your-move` P | MISSING | MISSING | MISSING | MISSING |

12/80 cells designed · 27 scenarios
