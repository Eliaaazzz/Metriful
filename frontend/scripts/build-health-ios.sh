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
echo 'Installing CocoaPods dependencies...'
pod install --repo-update 2>&1 | tee "$REPO_ROOT/work/health-ios/pod-install.log"
# Xcode embeds simulated entitlements during linking. Keep this CI-only identity
# separate from the device entitlements used by EAS and distribution builds.
ENTITLEMENTS="$APP_ROOT/ios/Metriful/Metriful.entitlements"
cp "$ENTITLEMENTS" "$REPO_ROOT/work/health-ios/device-entitlements.plist"
trap 'cp "$REPO_ROOT/work/health-ios/device-entitlements.plist" "$ENTITLEMENTS"' EXIT
python3 - "$ENTITLEMENTS" <<'PY'
import plistlib, sys
bundle = 'com.elia.aurafit'
with open(sys.argv[1], 'wb') as output:
    plistlib.dump({'application-identifier': bundle,
                  'keychain-access-groups': [bundle],
                  'com.apple.developer.healthkit': True}, output)
PY
echo 'Compiling the Release iOS Simulator target...'
xcodebuild -workspace Metriful.xcworkspace -scheme Metriful -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$REPO_ROOT/work/health-ios/DerivedData" \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= \
  build 2>&1 | tee "$REPO_ROOT/work/health-ios/xcodebuild.log"
tar -czf "$REPO_ROOT/work/health-ios/Metriful-simulator.app.tar.gz" \
  -C "$REPO_ROOT/work/health-ios/DerivedData/Build/Products/Release-iphonesimulator" Metriful.app
echo "Native simulator compilation passed. Log: $REPO_ROOT/work/health-ios/xcodebuild.log"
