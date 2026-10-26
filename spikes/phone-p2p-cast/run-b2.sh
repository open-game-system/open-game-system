#!/bin/zsh
# Approach (b2) in the Simulator: native snapshots of the TV WebView, streamed by WebKit's WebRTC.
#   INFLIGHT=4 ./run-b2.sh <sim udid> <visible|offscreen> <url> <outdir> [seconds]
SIM=$1; PLACE=$2; URL=$3; OUT=$4; SECS=${5:-30}
mkdir -p $OUT
xcrun simctl terminate $SIM org.opengame.spike.p2p 2>/dev/null
node receiver-driver.mjs --seconds $SECS --out $OUT > $OUT/tv.log 2>&1 &
DRV=$!
sleep 4
timeout $((SECS + 60)) xcrun simctl launch --console --terminate-running-process $SIM org.opengame.spike.p2p -mode snapstream -place $PLACE -inflight ${INFLIGHT:-4} -url "$URL" > $OUT/native.log 2>&1 &
sleep 20
echo "== CPU, streaming" > $OUT/cpu.txt
./sim-cpu.sh $SIM 6 >> $OUT/cpu.txt
wait $DRV
xcrun simctl terminate $SIM org.opengame.spike.p2p 2>/dev/null
curl -s localhost:8797/metrics | python3 -c "import json,sys; d=[m for m in json.load(sys.stdin) if m.get('role')=='phone']; [print(json.dumps({k:m.get(k) for k in ['mode','fpsEncoded','encodeMsPerFrame','kbps','size','limit','pageFps','snapFps']})) for m in d[-3:]]" > $OUT/phone-metrics.txt
