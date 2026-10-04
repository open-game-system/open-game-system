#!/bin/zsh
# scripts/variant.sh <moment> <letter> "<name>" — clone the current console concept into an isolated
# variant folder (src/concepts/v-<moment>-<letter>) for a per-moment go-wide round. Each variant agent
# owns only its folder, so ideas never bleed into each other.
set -euo pipefail
cd "${0:A:h}/.."
moment=${1:?moment}; letter=${2:?letter}; name=${3:?name}
id="v-$moment-$letter"
dest=src/concepts/$id
[[ -e $dest ]] && { echo "$dest exists"; exit 1; }
cp -R src/concepts/console $dest
python3 - "$dest/index.tsx" "$id" "$name" <<'PY'
import re, sys
p, cid, name = sys.argv[1:]
s = open(p).read()
s, n = re.subn(r'id: "console"', f'id: "{cid}"', s, count=1)
assert n == 1, "concept id not found"
s = re.sub(r'name: "[^"]*"', f'name: {name!r}'.replace("'", '"'), s, count=1)
open(p, "w").write(s)
PY
echo "$dest"
