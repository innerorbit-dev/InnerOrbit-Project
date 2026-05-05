import * as encryption from "../encryption";
const crypto = require("crypto");

// Mock @noble/post-quantum/ml-kem
jest.mock("@noble/post-quantum/ml-kem.js", () => {
    return {
        ml_kem768: {
            keygen: jest.fn(() => ({
                publicKey: new Uint8Array(1184),
                secretKey: new Uint8Array(2400)
            })),
            encapsulate: jest.fn((pk) => ({
                cipherText: new Uint8Array(1088),
                sharedSecret: new Uint8Array(32).fill(0x42)
            })),
            decapsulate: jest.fn((ct, sk) => new Uint8Array(32).fill(0x42))
        }
    };
});

// Mock dependencies that cause issues in Node/Jest environment
jest.mock("react-native", () => ({
    Platform: { OS: "ios" }
}));

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn()
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));

// Quick-crypto uses Node's crypto under the hood but with slightly different API
// For testing in Node, we can potentially use Node's native 'crypto' if the library 
// doesn't work directly in Jest. But let's see if it works with the mocks.
jest.mock("react-native-quick-crypto", () => {
    const crypto = require("crypto");
    return {
        ...crypto,
        randomBytes: (n) => crypto.randomBytes(n),
        createCipheriv: (alg, key, iv) => {
            const cipher = crypto.createCipheriv(alg, key, iv);
            let tag;
            return {
                update: (data, inputEnc, outputEnc) => cipher.update(data, inputEnc, outputEnc),
                final: (outputEnc) => cipher.final(outputEnc),
                getAuthTag: () => cipher.getAuthTag(),
                setAuthTag: (t) => cipher.setAuthTag(t)
            };
        },
        createDecipheriv: (alg, key, iv) => {
            const decipher = crypto.createDecipheriv(alg, key, iv);
            return {
                update: (data, inputEnc, outputEnc) => decipher.update(data, inputEnc, outputEnc),
                final: (outputEnc) => decipher.final(outputEnc),
                setAuthTag: (tag) => decipher.setAuthTag(tag)
            };
        },
        createHash: (alg) => crypto.createHash(alg),
        pbkdf2Sync: (p, s, i, k, a) => crypto.pbkdf2Sync(p, s, i, k, a),
        argon2Sync: (alg, options) => {
            const hash = crypto.createHash('sha256')
                .update(options.pass)
                .update(options.salt)
                .digest();
            return hash.subarray(0, options.hashLength || 32);
        }
    };
});

describe("Encryption Evolution (Level 1 to Level 4)", () => {
    const secretKey = "test-secret-key";
    const plaintext = "Hello, Secure Earth!";

    test("should encrypt and decrypt using Level 4 (Quantum Resistant Hybrid)", async () => {
        const pk = new Uint8Array(1184);
        const sk = new Uint8Array(2400);
        
        const encrypted = encryption.encrypt(plaintext, secretKey, pk);
        expect(encrypted).toContain("v4:");
        
        const decrypted = encryption.decrypt(encrypted, secretKey, sk);
        expect(decrypted).toBe(plaintext);
    });

    test("should encrypt and decrypt using v3 (Elite)", async () => {
        const encrypted = encryption.encrypt(plaintext, secretKey);
        expect(encrypted).toContain("v3:");
        
        const decrypted = encryption.decrypt(encrypted, secretKey);
        expect(decrypted).toBe(plaintext);
    });

    test("should handle v2 (GCM/PBKDF2) backward compatibility", async () => {
        const key = crypto.createHash('sha256').update(secretKey).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        let encrypted = cipher.update(plaintext, "utf8", "base64");
        encrypted += cipher.final("base64");
        const tag = cipher.getAuthTag().toString("base64");
        
        const v2Ciphertext = `v2:${iv.toString("base64")}:${tag}:${encrypted}`;
        
        const decrypted = encryption.decrypt(v2Ciphertext, secretKey);
        expect(decrypted).toBe(plaintext);
    });

    test("should detect tampering (Elite integrity check)", async () => {
        const encrypted = encryption.encrypt(plaintext, secretKey);
        const parts = encrypted.split(":");
        
        parts[3] = parts[3].substring(0, parts[3].length - 4) + "AAAA";
        const tampered = parts.join(":");
        
        expect(() => encryption.decrypt(tampered, secretKey)).toThrow();
    });

    test("should correctly identify encrypted strings", () => {
        const v4 = "v4:pqc:iv:tag:data";
        const v3 = "v3:iv:tag:data";
        const v2 = "v2:iv:tag:data";
        const v1 = "U2FsdGVkX1something";
        const plain = "not encrypted";

        expect(encryption.isEncrypted(v4)).toBe(true);
        expect(encryption.isEncrypted(v3)).toBe(true);
        expect(encryption.isEncrypted(v2)).toBe(true);
        expect(encryption.isEncrypted(v1)).toBe(true);
        expect(encryption.isEncrypted(plain)).toBe(false);
    });

    test("should derive ephemeral keys consistently using Argon2id", async () => {
        const convId = "conv-123";
        const uids = ["userA", "userB"];
        const ts = 1678838400000;
        
        const { getItemAsync } = require("expo-secure-store");
        getItemAsync.mockImplementation((key) => {
            if (key === "innerorbit_device_key") return Promise.resolve("mock-device-key");
            if (key === "innerorbit_device_salt") return Promise.resolve("mock-device-salt");
            return Promise.resolve(null);
        });

        const key1 = await encryption.deriveEphemeralKey(convId, uids, ts);
        const key2 = await encryption.deriveEphemeralKey(convId, uids, ts);
        
        expect(key1).toBe(key2);
        expect(key1).toHaveLength(64);
    });

    test("should migrate legacy @ keys to new keys", async () => {
        const { getItemAsync, setItemAsync } = require("expo-secure-store");
        const AsyncStorage = require("@react-native-async-storage/async-storage");
        
        // Mock scenario: Legacy key exists in AsyncStorage, but not in SecureStore
        getItemAsync.mockResolvedValue(null);
        AsyncStorage.getItem.mockImplementation((key) => {
            if (key === "@innerorbit_device_key") return Promise.resolve("legacy-val");
            return Promise.resolve(null);
        });

        const convId = "conv-mig";
        const uids = ["userA"];
        const ts = 123456789;

        await encryption.deriveEphemeralKey(convId, uids, ts);

        // Verification: 
        // 1. Should have tried to migrate "@innerorbit_device_key" to "innerorbit_device_key"
        expect(setItemAsync).toHaveBeenCalledWith("innerorbit_device_key", "legacy-val");
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@innerorbit_device_key");
    });

    test("should resolve v5 send when both peers support and ratchet exists", () => {
        const result = encryption.resolveSendVersion({
            localCapabilities: { v5: true, minReadable: 1, maxWritable: 5 },
            remoteCapabilities: { v5: true, minReadable: 1, maxWritable: 5 },
            hasLocalRatchetSession: true
        });
        expect(result.version).toBe("v5");
    });

    test("should fallback to legacy send when ratchet session missing", () => {
        const result = encryption.resolveSendVersion({
            localCapabilities: { v5: true, minReadable: 1, maxWritable: 5 },
            remoteCapabilities: { v5: true, minReadable: 1, maxWritable: 5 },
            hasLocalRatchetSession: false
        });
        expect(result.version).toBe("legacy");
        expect(result.reason).toBe("no_local_ratchet_session");
    });
});
