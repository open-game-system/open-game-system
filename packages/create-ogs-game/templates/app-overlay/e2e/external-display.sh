#!/usr/bin/env bash
# Turns the Simulator's external display (it stands in for an Apple TV with Screen Mirroring) on at
# a size, or off, for one simulator:
#   e2e/external-display.sh "<simulator name>" "1920×1080 (1080p)"   # or "Disabled"
# Every simulator has a TVOut screen (`simctl io <udid> enumerate`); `simctl io screenConfig` powers it
# and sets its geometry, so this needs no Simulator window, no menu and no Accessibility permission
# (found 2026-11-15 on Xcode 26.4; the I/O › External Displays menu click is no longer needed).
set -euo pipefail
device="${1:?simulator name}"; size="${2:-1920×1080 (1080p)}"
udid="$(xcrun simctl list devices | grep "$device (" | grep -oE '[0-9A-F-]{36}' | head -1)"
[ -n "$udid" ] || { echo "no simulator named $device" >&2; exit 1; }
if [ "$size" = "Disabled" ]; then
  xcrun simctl io "$udid" screenConfig --display=TVOut power off
  exit 0
fi
geometry="$(printf '%s' "$size" | grep -oE '^[0-9]+' )x$(printf '%s' "$size" | grep -oE '×[0-9]+' | tr -d '×')"
xcrun simctl io "$udid" screenConfig --display=TVOut power on
xcrun simctl io "$udid" screenConfig --display=TVOut geometry "$geometry"
