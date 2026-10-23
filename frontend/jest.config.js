// Jest configuration for the Expo / React Native app.
//
// Uses the official `jest-expo` preset (already a devDependency) so test files can
// import `react-native`, Expo modules, and community native modules — which ship
// untranspiled and otherwise fail to load with "Cannot use import statement outside
// a module". The preset was declared but never wired up, so store/hook tests that
// import `react-native` were failing to run; this file activates it.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
