
import { encryptV4, decryptV4, getRatchetSession, saveRatchetSession } from "../encryption";
import { initializeRatchet } from "../ratchet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import quickCrypto from "react-native-quick-crypto";

// Mocking AsyncStorage and SecureStore for persistence in tests
const storageMock: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(async (key: string) => storageMock[key] || null),
    setItem: jest.fn(async (key: string, value: string) => { storageMock[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete storageMock[key]; }),
    clear: jest.fn(async () => { Object.keys(storageMock).forEach(key => delete storageMock[key]); })
}));

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async (key: string) => storageMock[key] || null),
    setItemAsync: jest.fn(async (key: string, value: string) => { storageMock[key] = value; }),
    deleteItemAsync: jest.fn(async (key: string) => { delete storageMock[key]; })
}));

// Mocking react-native-quick-crypto for Node environment
jest.mock("react-native-quick-crypto", () => {
    const crypto = jest.requireActual("crypto");
    return {
        ...crypto,
        randomBytes: (size: number) => crypto.randomBytes(size),
        createHash: (alg: string) => crypto.createHash(alg),
        createHmac: (alg: string, key: any) => {
            const hmac = crypto.createHmac(alg, key);
            return {
                update: (data: any) => { hmac.update(data); return hmac; },
                digest: (enc: string) => hmac.digest(enc)
            };
        },
        generateKeyPairSync: (type: string) => {
            return crypto.generateKeyPairSync('x25519');
        },
        diffieHellman: (options: { privateKey: any; publicKey: any }) => {
            // Simple mock for DH exchange - in tests we don't need real math
            return Buffer.alloc(32, 0x42);
        },
        createCipheriv: (alg: string, key: any, iv: any) => {
            const cipher = crypto.createCipheriv(alg, key, iv);
            return {
                update: (data: any, inputEnc: any, outputEnc: any) => cipher.update(data, inputEnc, outputEnc),
                final: (outputEnc: any) => cipher.final(outputEnc),
                getAuthTag: () => cipher.getAuthTag()
            };
        },
        createDecipheriv: (alg: string, key: any, iv: any) => {
            const decipher = crypto.createDecipheriv(alg, key, iv);
            return {
                update: (data: any, inputEnc: any, outputEnc: any) => decipher.update(data, inputEnc, outputEnc),
                final: (outputEnc: any) => decipher.final(outputEnc),
                setAuthTag: (tag: any) => decipher.setAuthTag(tag)
            };
        }
    };
});

// Mock platform to ensure native path is taken in tests
jest.mock("../../utils/platform", () => ({
    isMobile: true,
    isWeb: false,
    isIOS: true,
    isAndroid: false
}));

describe("Level 5 Encryption (Double Ratchet) Integration", () => {
    const conversationId = "conv_123";
    const sharedSecret = Buffer.alloc(32, 0x12);
    const aliceDh = { publicKey: Buffer.alloc(32, 0x01), privateKey: Buffer.alloc(32, 0x02) };
    const bobDh = { publicKey: Buffer.alloc(32, 0x03), privateKey: Buffer.alloc(32, 0x04) };

    beforeEach(async () => {
        await (AsyncStorage as any).clear();
        
        // Initialize sessions for Alice and Bob
        const aliceState = await initializeRatchet(true, sharedSecret as any, bobDh.publicKey, aliceDh);
        const bobState = await initializeRatchet(false, sharedSecret as any, aliceDh.publicKey, bobDh);
        
        // For the test, we'll store Alice's session as the "local" session
        await saveRatchetSession(conversationId, aliceState);
        // We'll store Bob's session under a different ID to simulate another device/user
        await saveRatchetSession("bob_conv", bobState);
    });

    it("should encrypt and save state correctly", async () => {
        const plaintext = "Hello Level 5";
        const encrypted = await encryptV4(conversationId, plaintext);
        
        expect(encrypted).toContain("v4:");
        
        // Verify state advanced
        const state = await getRatchetSession(conversationId);
        expect(state?.sendingIndex).toBe(1);
    });

    it("should decrypt messages correctly using saved session", async () => {
        const plaintext = "Secret message";
        
        // Alice encrypts
        const encrypted = await encryptV4(conversationId, plaintext);
        
        // Bob decrypts (using his session)
        const decrypted = await decryptV4("bob_conv", encrypted);
        expect(decrypted).toBe(plaintext);
    });
});
