/**
 * Test Suite: MediaVaultService
 * Tests the 3-layer cryptographic pipeline and Firebase integration.
 */

import { MediaVaultService } from '../media-vault-service';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import { doc, setDoc, getDoc, addDoc, collection, Firestore } from 'firebase/firestore';
import { ml_kem768 } from '../crypto-wrapper';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../firebase', () => ({
    db: {},
    storage: {}
}));

jest.mock('firebase/storage', () => ({
    ref: jest.fn(),
    uploadBytes: jest.fn(() => Promise.resolve({ ref: {} })),
    getBytes: jest.fn(),
    getDownloadURL: jest.fn(() => Promise.resolve('http://download.url')),
    deleteObject: jest.fn(() => Promise.resolve()),
    FirebaseStorage: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    setDoc: jest.fn(() => Promise.resolve()),
    getDoc: jest.fn(),
    addDoc: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
    collection: jest.fn(),
    serverTimestamp: jest.fn(() => ({})),
    deleteDoc: jest.fn(() => Promise.resolve()),
    Firestore: jest.fn()
}));

jest.mock('../logger', () => ({
    Logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('../crypto-wrapper', () => ({
    ml_kem768: {
        encapsulate: jest.fn(() => ({ cipherText: new Uint8Array(10), sharedSecret: new Uint8Array(32) })),
        decapsulate: jest.fn(() => new Uint8Array(32))
    },
    randomBytes: jest.fn((len) => Buffer.alloc(len).fill(0))
}));

jest.mock('../encryption-core', () => ({
    encrypt: jest.fn(() => 'encrypted-data'),
    decrypt: jest.fn(() => Buffer.from(new Uint8Array(32).fill(0)).toString('base64')),
    encryptSivBinary: jest.fn(() => Promise.resolve({ 
        ciphertext: new Uint8Array(10), 
        iv: new Uint8Array(12), 
        tag: new Uint8Array(16) 
    })),
    decryptSivBinary: jest.fn(() => Promise.resolve(new Uint8Array(10))),
    ENC_VERSION_SIV: 'v3.5'
}));

// Mock libsodium-wrappers
jest.mock('libsodium-wrappers', () => ({
    ready: Promise.resolve(),
    crypto_aead_aegis256_encrypt: jest.fn(() => new Uint8Array([1, 2, 3])),
    crypto_aead_aegis256_decrypt: jest.fn(() => new Uint8Array([4, 5, 6])),
    randombytes_buf: jest.fn((len) => new Uint8Array(len).fill(0))
}));

// Mock global crypto
if (!global.crypto) {
    (global as any).crypto = {
        getRandomValues: (arr: any) => arr.fill(0)
    };
}

// Mock global Blob and URL
if (typeof Blob === 'undefined') {
    (global as any).Blob = class {
        constructor(public parts: any[], public options: any) {}
    };
}
if (typeof URL === 'undefined') {
    (global as any).URL = {
        createObjectURL: jest.fn(() => 'blob://test')
    };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('MediaVaultService', () => {
    const mockPqcPublicKey = new Uint8Array(1184).fill(0x01);
    const mockPqcSecretKey = new Uint8Array(2400).fill(0x02);
    const mockFileUri = 'file://test-media.jpg';
    const mockConversationId = 'conv-123';
    const mockSenderId = 'user-abc';

    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Ensure fetch is mocked for every test
        if (!(global as any).fetch) {
            (global as any).fetch = jest.fn();
        }
        
        fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
            Promise.resolve({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
                blob: () => Promise.resolve({
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
                })
            } as any)
        );
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    describe('uploadMedia()', () => {
        test('processes media through the 3-layer pipeline and uploads to storage', async () => {
            // Execute
            const vaultId = await MediaVaultService.uploadMedia(
                mockFileUri,
                mockConversationId,
                mockSenderId,
                mockPqcPublicKey,
                'image/jpeg'
            );

            // Verify
            expect(vaultId).toBe('new-doc-id');
            expect(global.fetch).toHaveBeenCalledWith(mockFileUri);
            expect(uploadBytes).toHaveBeenCalled();
            expect(addDoc).toHaveBeenCalled();
        });

        test('throws error if file exceeds 100MB', async () => {
            // Mock a large 101MB file
            fetchSpy.mockImplementation(() =>
                Promise.resolve({
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(101 * 1024 * 1024))
                } as any)
            );

            await expect(MediaVaultService.uploadMedia(
                mockFileUri,
                mockConversationId,
                mockSenderId,
                mockPqcPublicKey
            )).rejects.toThrow('FILE_TOO_LARGE');
        });

        test('throws error for unsupported mime types (e.g. video)', async () => {
            await expect(MediaVaultService.uploadMedia(
                mockFileUri,
                mockConversationId,
                mockSenderId,
                mockPqcPublicKey,
                'video/mp4'
            )).rejects.toThrow('UNSUPPORTED_FILE_TYPE');
        });

        test('throws error if fetch fails', async () => {
            fetchSpy.mockRejectedValue(new Error('Fetch failed'));

            await expect(MediaVaultService.uploadMedia(
                mockFileUri,
                mockConversationId,
                mockSenderId,
                mockPqcPublicKey
            )).rejects.toThrow('Fetch failed');
        });
    });

    describe('downloadMedia()', () => {
        const mockVaultId = 'vault-id-456';
        const mockMetadata = {
            conversationId: mockConversationId,
            pqcCiphertext: Buffer.from(new Uint8Array(10)).toString('base64'),
            wrappedMmk: 'wrapped-mmk-b64',
            aegisNonce: Buffer.from(new Uint8Array(32)).toString('base64'),
            sivIv: Buffer.from(new Uint8Array(12)).toString('base64'),
            sivTag: Buffer.from(new Uint8Array(16)).toString('base64'),
            mimeType: 'image/jpeg'
        };

        test('downloads and decrypts media correctly', async () => {
            // Setup mocks for metadata retrieval
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: mockVaultId,
                data: () => mockMetadata
            });

            // Execute
            const objectUrl = await MediaVaultService.downloadMedia(mockVaultId, mockPqcSecretKey);

            // Verify
            expect(objectUrl).toContain('blob:');
            expect(getDoc).toHaveBeenCalled();
            expect(global.fetch).toHaveBeenCalled();
        });

        test('throws error if metadata is missing', async () => {
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => false
            });

            await expect(MediaVaultService.downloadMedia(mockVaultId, mockPqcSecretKey))
                .rejects.toThrow('VAULT_ENTRY_NOT_FOUND');
        });
    });

    describe('Pipeline Integrity', () => {
        test('MediaVaultService is properly initialized', () => {
            expect(MediaVaultService).toBeDefined();
            expect(typeof MediaVaultService.uploadMedia).toBe('function');
            expect(typeof MediaVaultService.downloadMedia).toBe('function');
        });
    });
});
