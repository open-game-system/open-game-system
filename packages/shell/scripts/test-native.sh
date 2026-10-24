#!/usr/bin/env bash
# XCTest for the AirPlay display's UIKit core (ios/Package.swift) on an iOS simulator, under a timeout.
# SIM=<udid or name> picks the simulator (default: the first available iPhone).
set -euo pipefail
cd "$(dirname "$0")/../ios"
sim="${SIM:-$(xcrun simctl list devices available | grep -m1 -oE 'iPhone[^(]*\(([0-9A-F-]{36})\)' | grep -oE '[0-9A-F-]{36}')}"
timeout 600 xcodebuild test -scheme AirplayDisplayCore -destination "platform=iOS Simulator,id=$sim" \
  -derivedDataPath "${TMPDIR:-/tmp}/ogs-airplay-xctest" -quiet
