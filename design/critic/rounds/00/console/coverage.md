# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 2 Tonight | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 3 Switch games | `01-mid-rocket-crew` PKT<br>`02-console-menu` PT | MISSING | `03-saving` PTK<br>`04-tv-cutover` TPK | `05-kids-follow` KTP | `06-everyone-in` PTK<br>`07-ava-helper` K<br>`10-ava-wakes` PK | MISSING | `08-ava-asleep-switching` TP<br>`09-ava-asleep` PK | `11-undo-back` PTK |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-list` P<br>`02-nana-board` P | `08-empty` P | MISSING | `03-placing` P<br>`04-ready` P | `05-played` P<br>`06-list-after` P | `07-not-a-word` P | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| Home | `01-phone-friday` P<br>`02-tv-console-home` TP<br>`03-kid-paired-idle` K<br>`04-library` P | `05-first-run` P | MISSING | `06-phone-is-remote` PT | MISSING | MISSING | MISSING | MISSING |

14/80 cells designed · 25 scenarios
