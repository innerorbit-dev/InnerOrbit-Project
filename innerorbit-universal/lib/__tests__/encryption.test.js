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

    test('should produce different encrypted output each time (IV randomization)', () => {
        const message = 'test message';
        const encrypted1 = encrypt(message, testKey);
        const encrypted2 = encrypt(message, testKey);

        // Same message should produce different encrypted text due to random IV
        expect(encrypted1).not.toBe(encrypted2);

        // But both should decrypt to the same original message
        expect(decrypt(encrypted1, testKey)).toBe(message);
        expect(decrypt(encrypted2, testKey)).toBe(message);
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
