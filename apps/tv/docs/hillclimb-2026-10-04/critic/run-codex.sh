#!/bin/sh
# usage: critic/run-codex.sh <round>   (from the hill-climb folder): fresh Codex critic on the round's sheet + focus strip
r=$1
{ cat critic/BRIEF.md
  if [ -f "$r/checks.json" ]; then
    echo; echo "Automatic DOM check of every shot (text runs under 24 px, text outside 5% title-safe; the sheet is downscaled 3x, so judge text size from this):"
    python3 -c "import json;[print(f\"- {c['id']}: {c['textRuns']} text runs, under 24 px: {len(c['under24px'])}, outside title-safe: {len(c['outsideTitleSafe'])}\") for c in json.load(open('$r/checks.json'))]"
  fi; } > "critic/$r-prompt.md"
timeout 900 codex exec -m gpt-5.6-sol -c model_reasoning_effort="medium" --skip-git-repo-check -s read-only \
  -i "$r/sheet.jpg" -i "$r/focus-strip.jpg" < "critic/$r-prompt.md" > "critic/$r-codex.md" 2> "critic/$r-codex.err"
echo "exit $?" >> "critic/$r-codex.err"
