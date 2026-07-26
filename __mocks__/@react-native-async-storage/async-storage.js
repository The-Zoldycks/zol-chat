let store = {};

const AsyncStorage = {
  getItem: jest.fn(async (key) => store[key] || null),
  setItem: jest.fn(async (key, value) => { store[key] = value; }),
  removeItem: jest.fn(async (key) => { delete store[key]; }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
  multiRemove: jest.fn(async (keys) => { keys.forEach((k) => delete store[k]); }),
  clear: jest.fn(async () => { store = {}; }),
  __resetAll: () => { store = {}; },
};

export default AsyncStorage;
