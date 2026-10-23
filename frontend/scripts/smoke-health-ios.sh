#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
OUTPUT="$REPO_ROOT/work/health-ios-smoke"
mkdir -p "$OUTPUT"
tar -xzf "$1" -C "$OUTPUT"
APP="$OUTPUT/Metriful.app"
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")
codesign --force --deep --sign - "$APP"
SIMULATOR=$(xcrun simctl list devices available --json | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
print(next(d["udid"] for runtime, group in devices.items() if ".iOS-" in runtime
           for d in group if d["name"].startswith("iPhone") and d["isAvailable"]))
')
trap 'xcrun simctl shutdown "$SIMULATOR" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$SIMULATOR"
xcrun simctl bootstatus "$SIMULATOR" -b
xcrun simctl install "$SIMULATOR" "$APP"
xcrun simctl launch "$SIMULATOR" "$BUNDLE_ID" | tee "$OUTPUT/launch.log"
sleep 15
xcrun simctl spawn "$SIMULATOR" launchctl list > "$OUTPUT/processes.log"
python3 - "$OUTPUT/processes.log" "$BUNDLE_ID" <<'PY'
import pathlib, sys
rows = pathlib.Path(sys.argv[1]).read_text().splitlines()
assert any(sys.argv[2] in line and line.split()[0].isdigit() for line in rows), 'App exited after launch'
print('Simulator app remained running after launch.')
PY
xcrun simctl io "$SIMULATOR" screenshot "$OUTPUT/launch.png"
xcrun simctl spawn "$SIMULATOR" log show --last 2m --style compact \
  --predicate 'process == "Metriful"' > "$OUTPUT/runtime.log" 2>&1
