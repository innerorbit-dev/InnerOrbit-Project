import { encryptAsync, decryptAsync, getPQCKeypair } from '../encryption';

// Mock platform
jest.mock('../../utils/platform', () => ({
    isWeb: true,
    select: (obj: any) => obj.web || obj.default
}));

// Mock telemetry is not needed as it is internal to encryption.ts

describe('Sealed Sender Encryption', () => {
    const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const senderId = 'user_123';
    const message = 'This is a sealed message';

    test('encryptAsync should seal message with senderId', async () => {
        const encrypted = await encryptAsync(message, testKey, undefined, undefined, 'v3.5', senderId);
        
        // Output should be a v3.5 ciphertext
        expect(encrypted.startsWith('v3.5:')).toBe(true);
        
        // Decrypting should return an object
        const decrypted = await decryptAsync(encrypted, testKey);
        
        expect(typeof decrypted).toBe('object');
        expect(decrypted.text).toBe(message);
        expect(decrypted.senderId).toBe(senderId);
        expect(decrypted.timestamp).toBeDefined();
    });

    test('decryptAsync should handle plain text (unsealed) messages for backward compatibility', async () => {
        // Create an unsealed v3.5 message using sync encrypt
        const { encrypt } = require('../encryption');
        const legacyEncrypted = encrypt(message, testKey, undefined, 'v3.5');
        
        expect(legacyEncrypted.startsWith('v3.5:')).toBe(true);
        
        // DecryptAsync should return a string for legacy messages
        const decrypted = await decryptAsync(legacyEncrypted, testKey);
        
        expect(typeof decrypted).toBe('string');
        expect(decrypted).toBe(message);
    });

    test('encryptAsync without senderId should produce a string (standard encryption)', async () => {
        const encrypted = await encryptAsync(message, testKey, undefined, undefined, 'v3.5');
        const decrypted = await decryptAsync(encrypted, testKey);
        
        expect(typeof decrypted).toBe('string');
        expect(decrypted).toBe(message);
    });

    test('Sealed Sender should work with v5 (Quantum) version', async () => {
        // Generate mock PQC keys for test
        const { publicKey } = await getPQCKeypair();
        
        const encrypted = await encryptAsync(message, testKey, publicKey, undefined, 'v5', senderId);
        
        expect(encrypted.startsWith('v5:')).toBe(true);
        
        const decrypted = await decryptAsync(encrypted, testKey);
        
        expect(typeof decrypted).toBe('object');
        expect(decrypted.text).toBe(message);
        expect(decrypted.senderId).toBe(senderId);
    });
});
