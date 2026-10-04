# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | `02-pick-tv` P | `01-open` PTK | `04-connecting` PTK | MISSING | `05-launcher-fresh` PTK | `03-no-tv` PT | MISSING | MISSING |
| 2 Tonight | `01-who` PTK<br>`03-who-browse` P | MISSING | MISSING | MISSING | `02-who-ava` PTK<br>`04-starting` PTK | MISSING | MISSING | MISSING |
| 3 Switch games | `01-playing-rocket` PTK<br>`01b-ava-helper` K<br>`03-focus-bake` PT<br>`04-bake-detail` PT | MISSING | MISSING | MISSING | `05-cutover` PTK<br>`06-bake-playing` PTK<br>`06b-ava-bake` K | MISSING | `02-home` PTK | MISSING |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | `10-night` T | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-system` PT<br>`02-turns` PT | MISSING | MISSING | `03-on-phone` PT | `04-done` PT | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | `05-recasting` PTK | MISSING | `03-mom-remote` PT<br>`06-resumed` PTK | `04-cast-dropped` PTK | `01-remote-asleep` PT<br>`02-mom-offer` PT | MISSING |
| Home | `01-remote` PTK<br>`02-focus-bake` PT<br>`03-focus-far` PT<br>`04-system-row` PT<br>`05-users-row` PT<br>`06-browse` PT<br>`07-detail` PT<br>`08-detail-browse` PT<br>`09-devices` T | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

19/80 cells designed · 37 scenarios
