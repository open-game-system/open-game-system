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
# AV gate (verify-on-device): fail any flow clip that's a black/white screen. Prototype flows are
# silent and may hold still on purpose, so no --expect-audio / --expect-motion.
AV=~/src/skills/verify-on-device/scripts/av-verdict.mjs
for v in $OUT/*/flows/*.mp4(N); do
  node $AV $v --out ${v:r}.verdict.json > /dev/null 2>&1 && echo "av ok   ${v#$OUT/}" || echo "AV FAIL ${v#$OUT/} (see ${v:r}.verdict.json)"
done
echo "round $NN evidence in $OUT"
