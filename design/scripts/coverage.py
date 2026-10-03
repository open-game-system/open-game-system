#!/usr/bin/env python3
"""coverage.md: flows × state kinds, each cell listing the scenarios (and devices) shot, or MISSING."""
import json, os, sys

out = sys.argv[1]
scen = json.load(open(os.path.join(out, "scenarios.json")))
FLOWS = [("first-run", "1 First run"), ("tonight", "2 Tonight"), ("swap", "3 Switch games"), ("continue", "4 Continue / New"),
         ("game-night", "5 Hearthisle 3 homes"), ("word-duel", "6 Word Duel"), ("world-clock", "7 World clock"),
         ("add-game", "8 Add a game (dev)"), ("failure", "9 Failure & edge"), ("home", "Home")]
STATES = ["default", "empty", "loading", "partial", "success", "error", "interrupted", "undone"]
short = {"phone": "P", "ipad": "K", "tv": "T"}
lines = ["# Coverage: flows × states", "", "Cells list scenario ids with devices (P phone, K kid iPad, T TV). MISSING = not designed yet.", "",
         "| Flow | " + " | ".join(STATES) + " |", "|---|" + "---|" * len(STATES)]
filled = total = 0
for fid, name in FLOWS:
    row = [name]
    for st in STATES:
        cell = [f"`{s['id'].split('.', 1)[-1]}` {''.join(short[d] for d in s['devices'])}" for s in scen if s["flow"] == fid and s["state"] == st]
        total += 1
        if cell:
            filled += 1
        row.append("<br>".join(cell) if cell else "MISSING")
    lines.append("| " + " | ".join(row) + " |")
lines += ["", f"{filled}/{total} cells designed · {len(scen)} scenarios"]
open(os.path.join(out, "coverage.md"), "w").write("\n".join(lines) + "\n")
print(f"coverage: {filled}/{total}")
