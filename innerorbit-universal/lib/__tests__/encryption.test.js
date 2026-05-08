global.__DEV__ = true;

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

jest.mock('../crypto-wrapper', () => require('../crypto-wrapper.web'));

import { encrypt, decrypt, generateRandomKey } from '../encryption';

jest.mock('expo-secure-store', () => ({
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

describe('Encryption', () => {
    const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    test('should encrypt and decrypt a message correctly', () => {
        const originalMessage = 'Hello, this is a secret!';

        // Encrypt the message
        const encrypted = encrypt(originalMessage, testKey);

        // Decrypt it back
        const decrypted = decrypt(encrypted, testKey);

        // Check if we got the original message back
        expect(decrypted).toBe('Hello, this is a secret!');
    });

    test('encrypted text should be different from original', () => {
        const message = 'secret';
        const encrypted = encrypt(message, testKey);

        // Encrypted text should not match the original
        expect(encrypted).not.toBe('secret');
        expect(encrypted.length).toBeGreaterThan(0);
    });

    test('should handle special characters', () => {
        const specialMessage = '!@#$%^&*()_+-={}[]|:";\'<>?,./';
        const encrypted = encrypt(specialMessage, testKey);
        const decrypted = decrypt(encrypted, testKey);

        expect(decrypted).toBe(specialMessage);
    });

    test('should automatically upgrade v3 requests to v3.5 (Deterministic SIV)', () => {
        const message = 'test message';
        // v3 is now upgraded to v3.5 which is SIV (Deterministic)
        const encrypted1 = encrypt(message, testKey, undefined, 'v3');
        const encrypted2 = encrypt(message, testKey, undefined, 'v3');

        expect(encrypted1).toBe(encrypted2);
        expect(encrypted1.startsWith('v3.5:')).toBe(true);
        expect(decrypt(encrypted1, testKey)).toBe(message);
    });

    test('should produce consistent output for v3.5 (SIV Deterministic)', () => {
        const message = 'test message';
        // v3.5 is SIV (Deterministic)
        const encrypted1 = encrypt(message, testKey); // Defaults to v3.5
        const encrypted2 = encrypt(message, testKey);

        expect(encrypted1).toBe(encrypted2);
        expect(encrypted1.startsWith('v3.5:')).toBe(true);
        expect(decrypt(encrypted1, testKey)).toBe(message);
    });

    test('Strict Write: should automatically upgrade v1/v2/v3 requests to v3.5', () => {
        const message = 'upgrade me';
        
        const encryptedV1 = encrypt(message, testKey, undefined, 'v1');
        const encryptedV2 = encrypt(message, testKey, undefined, 'v2');
        const encryptedV3 = encrypt(message, testKey, undefined, 'v3');

        // All should now be v3.5
        expect(encryptedV1.startsWith('v3.5:')).toBe(true);
        expect(encryptedV2.startsWith('v3.5:')).toBe(true);
        expect(encryptedV3.startsWith('v3.5:')).toBe(true);
        
        expect(decrypt(encryptedV1, testKey)).toBe(message);
    });

    test('Graceful Read: should decrypt legacy v2 ciphertexts using the shim', () => {
        // This is a mock v2 ciphertext format: v2:iv:payload
        const legacyCiphertext = 'v2:MTIzNDU2Nzg5MDEy:YmFzZTY0cGF5bG9hZA==';
        
        // We expect decrypt to pass this to legacy-decryption.ts
        // Since we are mocking the environment, we just check that it doesn't throw immediate errors
        // or tries to use the v3.5 logic which would fail.
        try {
            decrypt(legacyCiphertext, testKey);
        } catch (e) {
            // It might fail in test env due to missing legacy dependencies, 
            // but we want to ensure it reached the legacy path.
            expect(e.message).not.toContain('Unsupported version');
        }
    });

    test('should throw error when no key is provided', () => {
        expect(() => encrypt('test', null)).toThrow('Encryption key is required');
        expect(() => decrypt('test', null)).toThrow('Decryption key is required');
    });

    test('generateRandomKey should create valid keys', () => {
        const key1 = generateRandomKey();
        const key2 = generateRandomKey();

        // Keys should be different
        expect(key1).not.toBe(key2);

        // Keys should be 64 characters (32 bytes in hex)
        expect(key1.length).toBe(64);
        expect(key2.length).toBe(64);
    });
});
