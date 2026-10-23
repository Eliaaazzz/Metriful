// The checked-in iOS project owns native configuration. Verify HealthKit in both sources.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const plist = require('@expo/plist').default;
const ignore = require('ignore');
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const config = JSON.parse(read('app.json')).expo;
const info = plist.parse(read('ios/Metriful/Info.plist'));
const entitlements = plist.parse(read('ios/Metriful/Metriful.entitlements'));
const project = read('ios/Metriful.xcodeproj/project.pbxproj');
const properties = JSON.parse(read('ios/Podfile.properties.json'));
const problems = [];
function check(condition, message) { if (!condition) problems.push(message); }

check(config.ios.entitlements['com.apple.developer.healthkit'] === true, 'Expo HealthKit entitlement missing');
check(entitlements['com.apple.developer.healthkit'] === true, 'Native HealthKit entitlement missing');
check(info.NSHealthShareUsageDescription === config.ios.infoPlist.NSHealthShareUsageDescription,
  'Native and Expo Health read-purpose descriptions differ');
const identifiers = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(m => m[1]);
check(identifiers.every(id => id === config.ios.bundleIdentifier), 'Bundle identifiers differ');
const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map(m => Number(m[1]));
check(targets.length > 0 && targets.every(v => v >= 15.4), 'A native target is below the modules\' iOS 15.4 minimum');
check(Number(properties['ios.deploymentTarget']) >= 15.4, 'Podfile deployment target is below 15.4');
check(read('modules/metriful-health/ios/MetrifulHealth.podspec').includes("s.frameworks = 'HealthKit'"),
  'HealthKit framework link missing');
check(read('modules/metriful-health/ios/MetrifulHealth.podspec').includes("s.swift_version = '5.0'"),
  'Health module must use the project\'s Swift 5 language mode');
check(read('ios/Podfile').includes('use_expo_modules!'), 'Expo native modules are not linked');
const autolinking = path.join(path.dirname(require.resolve('expo-modules-autolinking/package.json')),
  'bin/expo-modules-autolinking.js');
const linked = JSON.parse(execFileSync(process.execPath, [autolinking, 'resolve', '--platform', 'apple', '--json'],
  { cwd: root, encoding: 'utf8' }));
check(linked.modules.some(m => m.packageName === 'metriful-health' && m.modules.includes('MetrifulHealthModule')),
  'Health module not discovered by Expo autolinking');
const matcher = ignore().add(fs.readFileSync(path.join(repo, '.easignore'), 'utf8'));
const required = ['frontend/modules/metriful-health/ios/MetrifulHealthModule.swift',
  'frontend/modules/metriful-health/ios/MetrifulHealth.podspec',
  'frontend/modules/metriful-health/expo-module.config.json', 'frontend/ios/Podfile',
  'frontend/ios/Metriful/Metriful.entitlements', 'frontend/ios/Metriful/Info.plist'];
for (const file of required) check(!matcher.ignores(file), `Build archive would exclude ${file}`);
check(matcher.ignores('backend/secrets/credential.json'), 'Backend secrets must be excluded from EAS upload');
check(matcher.ignores('agent-service/.env'), 'Agent credentials must be excluded from EAS upload');
if (problems.length) {
  process.stderr.write(problems.join('\n') + '\n'); process.exitCode = 1;
} else {
  process.stdout.write(JSON.stringify({ status: 'passed', minimumIOS: '15.4', healthKit: true,
    nativeAutolinking: true, requiredSourcesIncluded: true, nativeCompilation: 'requires macOS or EAS' }) + '\n');
}
