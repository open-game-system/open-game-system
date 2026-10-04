# Coverage: flows × states

Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.

| Flow | default | empty | loading | partial | success | error | interrupted | undone |
|---|---|---|---|---|---|---|---|---|
| 1 First run | `02-pick-tv` P | `01-open-app` PTK | `04-connecting` PTK | MISSING | `05-launcher-fresh` TPK | `03-no-tv` P | MISSING | MISSING |
| 2 Tonight | `01-whos-playing` TPK<br>`03-picker-on-phone` P | MISSING | MISSING | `02-ava-left-out` TPK | `04-rocket-running` TPK | MISSING | MISSING | MISSING |
| 3 Switch games | `01-control-centre` TPK<br>`02-control-on-phone` P | MISSING | `03-switching` TPK | `05-launcher-suspended` TP | `04-bake-running` TPK | MISSING | MISSING | MISSING |
| 4 Continue / New | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 5 Hearthisle 3 homes | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 6 Word Duel | `01-your-turn` TP<br>`02-on-phone` TPK | MISSING | MISSING | `04-one-left` T | `03-played` TP | MISSING | MISSING | MISSING |
| 7 World clock | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 8 Add a game (dev) | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |
| 9 Failure & edge | MISSING | MISSING | `04-recasting` PTK | MISSING | `02-mom-has-remote` PT | `03-cast-dropped` PTK | `01-remote-asleep` PT | MISSING |
| Home | `01-remote` TPK<br>`02-focus-continue` TP<br>`03-focus-card` TP<br>`04-list-on-phone` PT<br>`05-story-nook-hub` TP<br>`06-game-night-hub` T<br>`07-bake-shop-hub` T | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING |

20/80 cells designed · 29 scenarios
