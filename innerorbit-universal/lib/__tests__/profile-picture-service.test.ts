/**
 * Test Suite: ProfilePictureService
 * Verifies secure upload, encryption pipeline, and local caching.
 */

import { ProfilePictureService, ProfilePhotoMetadata } from '../profile-picture-service';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../firebase', () => ({
    storage: {}
}));

jest.mock('firebase/storage', () => ({
    ref: jest.fn(),
    uploadBytes: jest.fn(() => Promise.resolve({ ref: {} })),
    getDownloadURL: jest.fn(() => Promise.resolve('http://download.url/avatar.enc'))
}));

jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'manipulated-uri', width: 512, height: 512 })),
    SaveFormat: { JPEG: 'jpeg' }
}));

const mockBase64Data = 'dGVzdC1pbWFnZS1kYXRh'; // 'test-image-data' in base64

jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn(() => Promise.resolve(mockBase64Data))
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null))
}));

jest.mock('../logger', () => ({
    Logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

const mockHashDigest = new Uint8Array(32).fill(0xAA);

jest.mock('../crypto-wrapper', () => ({
    ml_kem768: {
        encapsulate: jest.fn(() => ({ cipherText: new Uint8Array(1184), sharedSecret: new Uint8Array(32) })),
        decapsulate: jest.fn(() => new Uint8Array(32))
    },
    createHash: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => mockHashDigest)
    }))
}));

const mockCiphertext = new Uint8Array(10).fill(0xCC);
const mockIv = new Uint8Array(12).fill(0xDD);
const mockTag = new Uint8Array(16).fill(0xEE);
const mockDecrypted = new Uint8Array(10).fill(0xFF);

jest.mock('../encryption-core', () => ({
    encryptSivBinary: jest.fn(() => Promise.resolve({ 
        ciphertext: mockCiphertext, 
        iv: mockIv, 
        tag: mockTag 
    })),
    decryptSivBinary: jest.fn(() => Promise.resolve(mockDecrypted)),
    ENC_VERSION_QUANTUM_CHACHA: 'v5.5'
}));

// Mock global fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('ProfilePictureService', () => {
    const mockUid = 'user-123';
    const mockUri = 'file://original-avatar.jpg';
    const mockPqcPublicKey = new Uint8Array(1184).fill(0x01);
    const mockPqcSecretKey = new Uint8Array(2400).fill(0x02);
    const mockProfileKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockImplementation(() =>
            Promise.resolve({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
            } as any)
        );
    });

    describe('uploadSecureProfilePicture()', () => {
        test('successfully processes, encrypts, and uploads profile picture', async () => {
            const metadata = await ProfilePictureService.uploadSecureProfilePicture(
                mockUid,
                mockUri,
                mockPqcPublicKey,
                mockProfileKey
            );

            // Verify Image Manipulation
            expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
                mockUri,
                [{ resize: { width: 512, height: 512 } }],
                expect.any(Object)
            );

            // Verify Encryption
            expect(uploadBytes).toHaveBeenCalled();
            expect(metadata.version).toBe('v5.5');
            expect(metadata.iv).toBeDefined();
            expect(metadata.tag).toBeDefined();
            expect(metadata.pqcCt).toBeDefined();

            // Verify Local Caching
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining(mockUid),
                expect.stringContaining('"c":')
            );
        });

    });

    describe('getSecureProfilePicture()', () => {
        const mockMetadata: ProfilePhotoMetadata = {
            iv: Buffer.from(new Uint8Array(12).fill(0xDD)).toString('base64'),
            tag: Buffer.from(new Uint8Array(16).fill(0xEE)).toString('base64'),
            pqcCt: Buffer.from(new Uint8Array(1184).fill(0x01)).toString('base64'),
            version: 'v5.5'
        };

        test('returns cached image if available', async () => {
            const mockCachedPayload = JSON.stringify({
                c: 'Y29udGVudA==',
                i: 'aXY=',
                t: 'dGFn'
            });
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockCachedPayload);

            const result = await ProfilePictureService.getSecureProfilePicture(
                mockUid,
                mockMetadata,
                null,
                mockProfileKey
            );

            expect(result).toContain('data:image/jpeg;base64,');
            expect(AsyncStorage.getItem).toHaveBeenCalled();
            expect(uploadBytes).not.toHaveBeenCalled();
        });

        test('downloads and decrypts from cloud if not in cache', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            const result = await ProfilePictureService.getSecureProfilePicture(
                mockUid,
                mockMetadata,
                mockPqcSecretKey,
                mockProfileKey
            );

            expect(result).toContain('data:image/jpeg;base64,');
            expect(getDownloadURL).toHaveBeenCalled();
            expect(global.fetch).toHaveBeenCalled();
            expect(AsyncStorage.setItem).toHaveBeenCalled(); // Should cache after download
        });

        test('returns null if no cache and no secret key', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            const result = await ProfilePictureService.getSecureProfilePicture(
                mockUid,
                mockMetadata,
                null,
                mockProfileKey
            );

            expect(result).toBeNull();
        });

        test('handles forceRefresh by bypassing cache', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue('some-cache');

            await ProfilePictureService.getSecureProfilePicture(
                mockUid,
                mockMetadata,
                mockPqcSecretKey,
                mockProfileKey,
                true // forceRefresh
            );

            expect(getDownloadURL).toHaveBeenCalled();
        });
    });
});
