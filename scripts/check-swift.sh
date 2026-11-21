#!/usr/bin/env bash
# Type-checks the Swift sources of every native module against the iOS simulator SDK
# (no CocoaPods, no Xcode project). The .mm Fabric shells are only compiled by an app build.
set -euo pipefail
cd "$(dirname "$0")/../ios"

SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
TARGET=arm64-apple-ios15.1-simulator
# each group is one Swift module as CocoaPods builds it (shared files go with their users)
MODULES=(
  "image"
  "modal"
  "gesture"
  "sheet"
  "datePicker"
  "camera"
  "pdf"
  "audio shared mediaSession"
  "audio shared mediaSessionOff"
  "video shared mediaSession"
)

status=0
for group in "${MODULES[@]}"; do
  files=()
  for dir in $group; do files+=("$dir"/*.swift); done
  if xcrun swiftc -typecheck -sdk "$SDK" -target "$TARGET" "${files[@]}"; then
    echo "ok    $group"
  else
    echo "FAIL  $group"
    status=1
  fi
done
exit $status
