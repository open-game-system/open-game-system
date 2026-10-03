#!/bin/zsh
# scripts/round.sh NN [concept,concept] — one critic round of evidence → critic/rounds/NN/<concept>/
# (screen sheets, shots, checks.json, coverage.md, flows/*.mp4 + marks.json). Run in the background:
# a full round takes several minutes per concept.
set -euo pipefail
cd "${0:A:h}/.."
NN=${1:?round number}
OUT=critic/rounds/$NN
mkdir -p $OUT
ARGS=()
[[ -n "${2:-}" ]] && ARGS=(--concept $2)
pnpm -s typecheck || echo "WARN: typecheck failed (shooting anyway; see above)"
pnpm -s shoot $ARGS --out $OUT
pnpm -s flows $ARGS --out $OUT
for d in $OUT/*/; do [[ -f $d/scenarios.json ]] && python3 scripts/coverage.py $d; done
echo "round $NN evidence in $OUT"
