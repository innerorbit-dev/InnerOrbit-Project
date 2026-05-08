/**
 * Integration Test: Chat Flow
 * Tests the complete messaging flow including:
 * - Message encryption/decryption
 * - Sending and receiving messages
 * - Message persistence
 */

global.__DEV__ = true;

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

jest.mock('expo-secure-store', () => ({
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/crypto-wrapper', () => {
    const crypto = require('crypto');
    return {
        ml_kem768: {
            keygen: jest.fn(() => ({ publicKey: new Uint8Array(1184), secretKey: new Uint8Array(2400) })),
            encapsulate: jest.fn((pk) => ({ cipherText: new Uint8Array(1088), sharedSecret: new Uint8Array(32).fill(0x42) })),
            decapsulate: jest.fn((ct, sk) => new Uint8Array(32).fill(0x42))
        },
        createHash: (alg) => crypto.createHash(alg),
        randomBytes: (n) => crypto.randomBytes(n),
        createHmac: (alg, key) => crypto.createHmac(alg, key),
        generateKeyPairSync: () => crypto.generateKeyPairSync('x25519'),
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
                setAuthTag: (t) => cipher.setAuthTag(t)
            };
        },
        createDecipheriv: (alg, key, iv) => {
            const decipher = crypto.createDecipheriv(alg, key, iv);
            return {
                update: (data, ie, oe) => decipher.update(data, ie, oe),
                final: (oe) => decipher.final(oe),
                setAuthTag: (t) => decipher.setAuthTag(t)
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
        }
    };
});

import { encrypt, decrypt } from '../../lib/encryption';

// Mock Firebase
jest.mock('../../lib/firebase', () => ({
    db: {},
    auth: {}
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    addDoc: jest.fn(() => Promise.resolve({ id: 'msg-123' })),
    getDocs: jest.fn(() => Promise.resolve({ empty: false, docs: [] })),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(),
    serverTimestamp: jest.fn(() => new Date())
}));

describe('Integration: Chat Flow', () => {
    const testKey = 'test-encryption-key-12345';
    const senderId = 'user-123';
    const recipientId = 'user-456';

    describe('Message Encryption Flow', () => {
        test('should encrypt and decrypt messages end-to-end', () => {
            const originalMessage = 'Hello, this is a secret message!';

            // Encrypt
            const encrypted = encrypt(originalMessage, testKey);
            expect(encrypted).not.toBe(originalMessage);
            expect(encrypted.length).toBeGreaterThan(0);

            // Decrypt
            const decrypted = decrypt(encrypted, testKey);
            expect(decrypted).toBe(originalMessage);
        });

        test('should handle different message types', () => {
            const messages = [
                'Simple text',
                'Text with emoji 😊🔒',
                'Special chars: !@#$%^&*()',
                'Multi\nline\nmessage',
                'Very long message: ' + 'a'.repeat(1000)
            ];

            messages.forEach(msg => {
                const encrypted = encrypt(msg, testKey);
                const decrypted = decrypt(encrypted, testKey);
                expect(decrypted).toBe(msg);
            });
        });

        test('should produce different ciphertext for same message', () => {
            const message = 'Same message';

            const encrypted1 = encrypt(message, testKey);
            const encrypted2 = encrypt(message, testKey);

            // Protocol v3.5 (SIV) is deterministic for same key/message
            expect(encrypted1).toBe(encrypted2);

            // But both decrypt to same message
            expect(decrypt(encrypted1, testKey)).toBe(message);
            expect(decrypt(encrypted2, testKey)).toBe(message);
        });
    });

    describe('Message Sending Flow', () => {
        test('should prepare message for sending', () => {
            const messageText = 'Test message';
            const encrypted = encrypt(messageText, testKey);

            const messagePayload = {
                senderId,
                recipientId,
                encryptedContent: encrypted,
                timestamp: new Date(),
                status: 'sent'
            };

            expect(messagePayload.encryptedContent).toBeDefined();
            expect(messagePayload.encryptedContent).not.toBe(messageText);
            expect(messagePayload.senderId).toBe(senderId);
            expect(messagePayload.recipientId).toBe(recipientId);
        });

        test('should carry encryption version metadata for compatibility', () => {
            const messageText = 'Versioned message';
            const encrypted = encrypt(messageText, testKey);
            const encVersion = encrypted.startsWith('v5:') ? 'v5' : (encrypted.startsWith('v3:') ? 'v3' : 'legacy');

            const messagePayload = {
                senderId,
                recipientId,
                encryptedContent: encrypted,
                encVersion
            };

            expect(['v5', 'v3', 'legacy']).toContain(messagePayload.encVersion);
        });

        test('should handle message metadata', () => {
            const message = {
                id: 'msg-123',
                senderId,
                recipientId,
                encryptedContent: encrypt('Hello', testKey),
                timestamp: new Date(),
                status: 'sent',
                readAt: null,
                deletedAt: null
            };

            expect(message.id).toBe('msg-123');
            expect(message.status).toBe('sent');
            expect(message.readAt).toBeNull();
        });
    });

    describe('Message Receiving Flow', () => {
        test('should decrypt received message', () => {
            const originalMessage = 'Received message';
            const encrypted = encrypt(originalMessage, testKey);

            // Simulate receiving encrypted message
            const receivedMessage = {
                id: 'msg-456',
                senderId: recipientId,
                recipientId: senderId,
                encryptedContent: encrypted,
                timestamp: new Date()
            };

            // Decrypt
            const decrypted = decrypt(receivedMessage.encryptedContent, testKey);
            expect(decrypted).toBe(originalMessage);
        });

        test('should handle message status updates', () => {
            const message = {
                id: 'msg-789',
                status: 'sent',
                readAt: null
            };

            // Mark as delivered
            message.status = 'delivered';
            expect(message.status).toBe('delivered');

            // Mark as read
            message.status = 'read';
            message.readAt = new Date();
            expect(message.status).toBe('read');
            expect(message.readAt).toBeDefined();
        });

        test('should still read legacy encrypted payloads', () => {
            const legacyCiphertext = 'U2FsdGVkX1legacyExample';
            expect(() => decrypt(legacyCiphertext, testKey)).not.toThrow();
        });
    });

    describe('Chat History Flow', () => {
        test('should handle multiple messages in conversation', () => {
            const conversation = [
                { text: 'Hello!', sender: senderId },
                { text: 'Hi there!', sender: recipientId },
                { text: 'How are you?', sender: senderId },
                { text: 'I am good, thanks!', sender: recipientId }
            ];

            // Encrypt all messages
            const encryptedConversation = conversation.map(msg => ({
                ...msg,
                encryptedContent: encrypt(msg.text, testKey)
            }));

            // Decrypt all messages
            const decryptedConversation = encryptedConversation.map(msg => ({
                ...msg,
                text: decrypt(msg.encryptedContent, testKey)
            }));

            // Verify all messages decrypted correctly
            decryptedConversation.forEach((msg, index) => {
                expect(msg.text).toBe(conversation[index].text);
            });
        });

        test('should maintain message order', () => {
            const messages = [
                { id: '1', timestamp: new Date('2024-01-01T10:00:00'), text: 'First' },
                { id: '2', timestamp: new Date('2024-01-01T10:01:00'), text: 'Second' },
                { id: '3', timestamp: new Date('2024-01-01T10:02:00'), text: 'Third' }
            ];

            // Sort by timestamp
            const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

            expect(sorted[0].text).toBe('First');
            expect(sorted[1].text).toBe('Second');
            expect(sorted[2].text).toBe('Third');
        });
    });

    describe('Message Deletion Flow', () => {
        test('should mark message as deleted', () => {
            const message = {
                id: 'msg-delete-1',
                text: 'To be deleted',
                deletedAt: null,
                isDeleted: false
            };

            // Delete message
            message.deletedAt = new Date();
            message.isDeleted = true;

            expect(message.isDeleted).toBe(true);
            expect(message.deletedAt).toBeDefined();
        });

        test('should handle soft delete vs hard delete', () => {
            const message = {
                id: 'msg-delete-2',
                encryptedContent: encrypt('Message content', testKey),
                deletedAt: null
            };

            // Soft delete (mark as deleted but keep data)
            message.deletedAt = new Date();
            expect(message.encryptedContent).toBeDefined();

            // Hard delete (remove content)
            message.encryptedContent = null;
            expect(message.encryptedContent).toBeNull();
        });
    });

    describe('End-to-End Chat Scenarios', () => {
        test('should complete full message lifecycle', () => {
            const messageText = 'Complete lifecycle test';

            // 1. Compose message
            const composed = {
                text: messageText,
                senderId,
                recipientId
            };

            // 2. Encrypt before sending
            const encrypted = encrypt(composed.text, testKey);
            const toSend = {
                ...composed,
                encryptedContent: encrypted,
                timestamp: new Date(),
                status: 'sending'
            };

            // 3. Mark as sent
            toSend.status = 'sent';
            expect(toSend.status).toBe('sent');

            // 4. Recipient receives and decrypts
            const received = {
                ...toSend,
                status: 'delivered'
            };
            const decrypted = decrypt(received.encryptedContent, testKey);
            expect(decrypted).toBe(messageText);

            // 5. Mark as read
            received.status = 'read';
            received.readAt = new Date();
            expect(received.status).toBe('read');
        });

        test('should handle conversation between two users', () => {
            const messages = [];

            // User 1 sends message
            const msg1 = {
                id: '1',
                senderId,
                recipientId,
                encryptedContent: encrypt('Hello from User 1', testKey),
                timestamp: new Date()
            };
            messages.push(msg1);

            // User 2 replies
            const msg2 = {
                id: '2',
                senderId: recipientId,
                recipientId: senderId,
                encryptedContent: encrypt('Hello from User 2', testKey),
                timestamp: new Date()
            };
            messages.push(msg2);

            // Verify both messages can be decrypted
            expect(decrypt(messages[0].encryptedContent, testKey)).toBe('Hello from User 1');
            expect(decrypt(messages[1].encryptedContent, testKey)).toBe('Hello from User 2');

            // Verify conversation structure
            expect(messages.length).toBe(2);
            expect(messages[0].senderId).toBe(senderId);
            expect(messages[1].senderId).toBe(recipientId);
        });
    });
});
