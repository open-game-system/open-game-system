#!/usr/bin/env bash
# Turns the Simulator's external display (I/O > External Displays) on or off for one device window,
# by clicking the Simulator menu through System Events (needs Accessibility permission for the
# terminal app). simctl has no command for it (Xcode 26.4).
#   e2e/external-display.sh "<simulator name>" "1920×1080 (1080p)"   # or "Disabled"
# (From Crak & Bam's app; the shell has the same as packages/shell/scripts/airplay-sim.sh.)
set -euo pipefail
device="${1:?simulator name}"; size="${2:-1920×1080 (1080p)}"
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
