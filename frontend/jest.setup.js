// Global test setup.
//
// In-memory mock for AsyncStorage so zustand-persisted stores (hydration, auth, …)
// run under the node test environment. The real package loads its web build, which
// dereferences `window` and throws "window is not defined" in jest.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(key in store ? store[key] : null)),
      setItem: jest.fn((key, value) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
      multiGet: jest.fn((keys) => Promise.resolve(keys.map((k) => [k, k in store ? store[k] : null]))),
      multiSet: jest.fn((pairs) => {
        pairs.forEach(([k, v]) => {
          store[k] = v;
        });
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys) => {
        keys.forEach((k) => {
          delete store[k];
        });
        return Promise.resolve();
      }),
    },
  };
});
