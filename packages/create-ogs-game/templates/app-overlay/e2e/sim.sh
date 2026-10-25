#!/usr/bin/env bash
# The app on the iOS Simulator with the TV on its external display, end to end:
#   1. a simulator of its own (created once), booted, Simulator.app open;
#   2. expo prebuild + a Release build (the JS bundle embedded: no Metro);
#   3. install, external display on (it stands in for an Apple TV with Screen Mirroring);
#   4. Maestro: name → lobby → Show on TV → Apple TV / AirPlay → Start;
#   5. screenshots of the phone and of the TV (the external display) in e2e/out/, timings in
#      e2e/out/timings.txt.
# Needs: macOS with Xcode and CocoaPods, Maestro (~/.maestro/bin/maestro), a deploy of the game
# (../deploys.json, or GAME_ORIGIN), and Accessibility access for the terminal (the external display
# is a Simulator menu: e2e/external-display.sh). SKIP_BUILD=1 reuses the last build.
set -euo pipefail
# CocoaPods fails on a non-UTF-8 locale (Unicode Normalization not appropriate for ASCII-8BIT).
export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"
here="$(cd "$(dirname "$0")" && pwd)"; app="$here/.."; cd "$app"
out="$here/out"; mkdir -p "$out"; : > "$out/timings.txt"
dev="${DEVICE:-__OGS_APP_ID__-sim}"; model="${MODEL:-iPhone 17 Pro}"
maestro="${MAESTRO:-$HOME/.maestro/bin/maestro}"
t0=$(date +%s); last=$t0
step() { local now; now=$(date +%s); printf '%-28s %4ss (total %ss)\n' "$1" $((now - last)) $((now - t0)) | tee -a "$out/timings.txt"; last=$now; }

udid="$(xcrun simctl list devices available | grep "$dev (" | grep -oE '[0-9A-F-]{36}' | head -1 || true)"
if [ -z "$udid" ]; then
  runtime="$(xcrun simctl list runtimes available | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' | tail -1)"
  udid="$(xcrun simctl create "$dev" "$model" "$runtime")"
fi
xcrun simctl boot "$udid" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$udid"
xcrun simctl bootstatus "$udid" -b >/dev/null
step "simulator booted"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  pnpm exec expo prebuild --platform ios --clean >"$out/prebuild.log" 2>&1
  step "expo prebuild"
  # expo prebuild exits 0 even when `pod install` fails: check for the workspace.
  workspace="$(ls -d ios/*.xcworkspace 2>/dev/null | head -1 || true)"
  [ -n "$workspace" ] || { echo "prebuild made no Xcode workspace: see $out/prebuild.log" >&2; exit 1; }; scheme="$(basename "$workspace" .xcworkspace)"
  xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphonesimulator \
    -destination "id=$udid" -derivedDataPath ios/build ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build >"$out/xcodebuild.log" 2>&1
  step "xcodebuild (Release)"
fi
bundle="$(ls -d ios/build/Build/Products/Release-iphonesimulator/*.app | head -1)"
xcrun simctl install "$udid" "$bundle"
step "installed"

"$here/external-display.sh" "$dev" "1920×1080 (1080p)" >/dev/null; sleep 2
step "external display on"
"$maestro" --device "$udid" test e2e/maestro/show-on-tv.yaml >"$out/maestro-show.log" 2>&1
step "on the TV (Maestro)"
sleep 3
xcrun simctl io "$udid" screenshot --display=external "$out/04-tv-lobby.png" >/dev/null 2>&1
"$maestro" --device "$udid" test e2e/maestro/start.yaml >"$out/maestro-start.log" 2>&1 &
maestro_pid=$!
sleep 4
xcrun simctl io "$udid" screenshot --display=external "$out/06-tv-kites.png" >/dev/null 2>&1
wait $maestro_pid
step "round started (Maestro)"
sleep 1
xcrun simctl io "$udid" screenshot --display=external "$out/08-tv-question.png" >/dev/null 2>&1
echo "The phone walk passed. LOOK at the TV screenshots (04, 06, 08) before calling the TV done:"
echo "the native idle card (\"Pick a game on your phone…\") means the TV page never loaded."
echo "Screenshots and timings in $out"
