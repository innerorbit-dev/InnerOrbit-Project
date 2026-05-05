global.__DEV__ = true;

jest.mock('react-native', () => ({
    Platform: {
        OS: 'web',
        select: (obj) => obj.web || obj.default,
    },
    NativeModules: {},
    AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
}));
let mockAsyncStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key) => Promise.resolve(mockAsyncStore[key] || null)),
    setItem: jest.fn((key, value) => { mockAsyncStore[key] = value; return Promise.resolve(); }),
    removeItem: jest.fn((key) => { delete mockAsyncStore[key]; return Promise.resolve(); }),
    clear: jest.fn(() => { mockAsyncStore = {}; return Promise.resolve(); }),
}));

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(() => Promise.resolve(null)),
    setItemAsync: jest.fn(() => Promise.resolve()),
    deleteItemAsync: jest.fn(() => Promise.resolve()),
    WHEN_UNLOCKED: 'when_unlocked',
}));

jest.mock('@noble/post-quantum/ml-kem.js', () => ({
    ml_kem768: {
        keygen: jest.fn(() => ({ publicKey: new Uint8Array(1184), secretKey: new Uint8Array(2400) })),
        encapsulate: jest.fn(() => ({ cipherText: new Uint8Array(1088), sharedSecret: new Uint8Array(32) })),
        decapsulate: jest.fn(() => new Uint8Array(32)),
    },
}));
