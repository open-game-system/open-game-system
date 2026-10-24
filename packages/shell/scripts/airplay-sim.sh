#!/usr/bin/env bash
# The iOS Simulator's external display (I/O > External Displays) stands in for an Apple TV with Screen
# Mirroring on: turns it on (a size) or off ("Disabled") for one simulator window, by clicking the
# Simulator menu through System Events (the terminal app needs Accessibility permission). simctl has
# no command for it (Xcode 26.4). From Crak & Bam's app/e2e/external-display.sh.
#   packages/shell/scripts/airplay-sim.sh "<simulator name>" "1920×1080 (1080p)"   # or "Disabled"
# Screenshot the TV: xcrun simctl io <udid> screenshot --display=external tv.png
set -euo pipefail
device="${1:?simulator name, e.g. ogs-airplay-test}"; size="${2:-1920×1080 (1080p)}"
osascript <<OSA
tell application "Simulator" to activate
tell application "System Events" to tell process "Simulator"
  set frontmost to true
  repeat with w in windows
    if name of w starts with "$device " then perform action "AXRaise" of w
  end repeat
  delay 0.5
  set target to menu item "$size" of menu 1 of menu item "External Displays" of menu 1 of menu bar item "I/O" of menu bar 1
  -- Clicking the size that is already on re-creates the display under a running app: skip it.
  set mark to ""
  try
    set mark to value of attribute "AXMenuItemMarkChar" of target
  end try
  if mark is missing value or mark is "" then click target
end tell
OSA
