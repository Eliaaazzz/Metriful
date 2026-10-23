#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Run this native compilation check on macOS with Xcode.' >&2
  exit 1
fi
cd "$APP_ROOT"
npm run ios:check
mkdir -p "$REPO_ROOT/work/health-ios"
cd ios
pod install --repo-update 2>&1 | tee "$REPO_ROOT/work/health-ios/pod-install.log"
xcodebuild -workspace Metriful.xcworkspace -scheme Metriful -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$REPO_ROOT/work/health-ios/DerivedData" \
  CODE_SIGNING_ALLOWED=NO build > "$REPO_ROOT/work/health-ios/xcodebuild.log" 2>&1
echo "Native simulator compilation passed. Log: $REPO_ROOT/work/health-ios/xcodebuild.log"
