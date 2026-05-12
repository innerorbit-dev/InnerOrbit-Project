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

// Mock react-native-quick-crypto globally — prevents react-native-nitro-modules crash in Node/Jest
jest.mock('react-native-quick-crypto', () => {
    const crypto = require('crypto');
    return {
        ...crypto,
        randomBytes: (n) => crypto.randomBytes(n),
        createHash: (alg) => crypto.createHash(alg),
        createHmac: (alg, key) => crypto.createHmac(alg, key),
        pbkdf2Sync: (p, s, i, k, a) => crypto.pbkdf2Sync(p, s, i, k, a),
        generateKeyPairSync: () => ({
            publicKey: Buffer.alloc(32, 0x01),
            privateKey: Buffer.alloc(32, 0x02),
        }),
        diffieHellman: () => Buffer.alloc(32, 0x42),
        argon2Sync: (alg, options) => {
            const hash = crypto.createHash('sha256')
                .update(options.message)
                .update(options.nonce)
                .digest();
            return hash.subarray(0, options.tagLength || 32);
        },
        createCipheriv: (alg, key, iv) => {
            const cipher = crypto.createCipheriv(alg, key, iv);
            return {
                update: (data, ie, oe) => cipher.update(data, ie, oe),
                final: (oe) => cipher.final(oe),
                getAuthTag: () => cipher.getAuthTag(),
                setAuthTag: (t) => cipher.setAuthTag(t),
            };
        },
        createDecipheriv: (alg, key, iv) => {
            const decipher = crypto.createDecipheriv(alg, key, iv);
            return {
                update: (data, ie, oe) => decipher.update(data, ie, oe),
                final: (oe) => decipher.final(oe),
                setAuthTag: (t) => decipher.setAuthTag(t),
            };
        },
        MlKem: class {
            constructor(type) {}
            generateKeyPairSync() {}
            getPublicKey() { return new Uint8Array(1184); }
            getPrivateKey() { return new Uint8Array(2400); }
            setPublicKey() {}
            setPrivateKey() {}
            encapsulateSync() { return { ciphertext: new Uint8Array(1088), sharedKey: new Uint8Array(32).fill(0x42) }; }
            decapsulateSync() { return new Uint8Array(32).fill(0x42); }
        },
    };
});

jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            firebaseApiKey: 'mock-api-key',
            firebaseProjectId: 'mock-project-id',
        },
    },
    manifest: {
        extra: {
            firebaseApiKey: 'mock-api-key',
            firebaseProjectId: 'mock-project-id',
        },
    },
}));

jest.mock('expo-sqlite', () => ({
    openDatabaseSync: jest.fn(() => ({
        execAsync: jest.fn(() => Promise.resolve()),
        runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
        getFirstAsync: jest.fn(() => Promise.resolve(null)),
        getAllAsync: jest.fn(() => Promise.resolve([])),
        prepareAsync: jest.fn(() => Promise.resolve({
            executeAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
            finalizeAsync: jest.fn(() => Promise.resolve()),
        })),
        withTransactionAsync: jest.fn((callback) => callback()),
    })),
}));
