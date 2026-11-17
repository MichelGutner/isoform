#!/usr/bin/env bash
# Compiles the library's Kotlin with every module on (see example/isoform.config.json),
# through the example app's Gradle project. Needs a JDK 17+ and the Android SDK.
set -euo pipefail
cd "$(dirname "$0")/../example"

if [ ! -f android/gradlew ]; then
  echo "example/android does not exist yet. Generate it once with:" >&2
  echo "  cd example && yarn install && npx expo prebuild --platform android --no-install" >&2
  exit 1
fi

cd android
./gradlew :isoform:compileDebugKotlin -q
echo "ok    android: :isoform:compileDebugKotlin"
