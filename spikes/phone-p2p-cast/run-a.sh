#!/bin/zsh
# Approach (a) in the Simulator: the spike app's WKWebView streams the TV page itself.
#   ./run-a.sh <sim udid> <visible|offscreen|transparent> <url> <outdir> [seconds]
SIM=$1; PLACE=$2; URL=$3; OUT=$4; SECS=${5:-30}
mkdir -p $OUT
xcrun simctl launch --terminate-running-process $SIM org.opengame.spike.p2p -mode web -place $PLACE -url "$URL" >/dev/null
sleep 6
echo "== CPU, page drawing, not streaming" > $OUT/cpu.txt
./sim-cpu.sh $SIM 5 >> $OUT/cpu.txt
node receiver-driver.mjs --seconds $SECS --out $OUT > $OUT/tv.log 2>&1 &
DRV=$!
sleep 12
echo "== CPU, streaming" >> $OUT/cpu.txt
./sim-cpu.sh $SIM 10 >> $OUT/cpu.txt
wait $DRV
curl -s localhost:8797/metrics | python3 -c "import json,sys; d=[m for m in json.load(sys.stdin) if m.get('role')=='phone']; [print(json.dumps(m)) for m in d[-3:]]" > $OUT/phone-metrics.txt
