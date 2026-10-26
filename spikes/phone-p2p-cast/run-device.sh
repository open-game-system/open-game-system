#!/bin/zsh
# The real-iPhone round: Kite Count (wrangler dev on the LAN), the spike server, then
#  1. a 5-minute measured run (TV-side targets, phone CPU / thermal / battery), and
#  2. an 80-second proof video (the phone's controller beside the received stream, with sound).
# The iPhone must be unlocked, on charge, on the Mac's Wi-Fi, with Local Network allowed for P2PSpike.
#   ./run-device.sh [out dir]
set -e
cd "$(dirname "$0")"
OUT=${1:-/tmp/p2p-device-$(date +%H%M)}
DEV=8EE95E69-FAB4-5CC0-BE1D-355B7B806E73
mkdir -p $OUT/phone-frames
lsof -tiTCP:8787 -sTCP:LISTEN >/dev/null || (cd ~/src/kite-count && npx wrangler dev --ip 0.0.0.0 --port 8787 --persist-to $OUT/kite-state > $OUT/kite.log 2>&1 &)
lsof -tiTCP:8797 -sTCP:LISTEN | xargs kill 2>/dev/null || true
SPIKE_FRAMES=$OUT/phone-frames node server.mjs > $OUT/server.log 2>&1 &
SERVER=$!
until curl -s -o /dev/null http://192.168.68.113:8787/healthz; do sleep 1; done
sleep 1
node native-run.mjs --device $DEV --seconds 300 --out $OUT/measure
node proof-video.mjs --device $DEV --seconds 80 --frames $OUT/phone-frames --out $OUT/proof --final ~/src/ogs-p2pcast/recordings/p2p-native-kite-iphone.mp4
kill $SERVER
open ~/src/ogs-p2pcast/recordings/p2p-native-kite-iphone.mp4
