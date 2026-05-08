import { encrypt, decrypt, encryptAsync, decryptAsync, ENC_VERSION_QUANTUM_CHACHA, ENC_VERSION_QUANTUM, ENC_VERSION_SIV, GLOBAL_DISABLE_CHAT_SERVICES } from '../encryption';
import { ml_kem768 } from '../crypto-wrapper';
import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';

// Mock react-native for Platform checks
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

// Use web crypto wrapper for tests
jest.mock('../crypto-wrapper', () => require('../crypto-wrapper.web'));

describe('Encryption Protocol v5.5 (Quantum Hybrid + ChaCha20)', () => {
    const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const message = 'InnerOrbit v5.5 Quantum-Safe Message';
    let pqcKeypair: { publicKey: Uint8Array; secretKey: Uint8Array };

    beforeAll(() => {
        pqcKeypair = ml_kem768.keygen();
    });

    test('should encrypt and decrypt v5.5 correctly (Sync)', () => {
        const encrypted = encrypt(message, testKey, pqcKeypair.publicKey, ENC_VERSION_QUANTUM_CHACHA);
        expect(encrypted.startsWith('v5.5:')).toBe(true);
        const decrypted = decrypt(encrypted, testKey, pqcKeypair.secretKey);
        expect(decrypted).toBe(message);
    });

    test('cascading fallback: v5.5 -> v5', () => {
        const cryptoWrapper = require('../crypto-wrapper');
        
        // Persistent mock that fails ChaCha20 but allows GCM (simulated)
        const spyCipher = jest.spyOn(cryptoWrapper, 'createCipheriv').mockImplementation((alg) => {
            if (alg === 'chacha20-poly1305') throw new Error('Native Fail');
            
            // For v5 fallback, return a mock cipher to bypass shim's GCM error
            return {
                update: () => 'v5_encrypted_data',
                final: () => '',
                getAuthTag: () => Buffer.alloc(16),
                setAAD: () => {}
            } as any;
        });

        // Force v5.5
        const encrypted = encrypt(message, testKey, pqcKeypair.publicKey, ENC_VERSION_QUANTUM_CHACHA);
        
        // Should have fallen back to v5
        expect(encrypted.startsWith('v5:')).toBe(true);
        expect(encrypted).not.toContain('v5.5:');
        
        spyCipher.mockRestore();
    });

    test('cascading fallback: v5 -> v3.5', () => {
        const cryptoWrapper = require('../crypto-wrapper');
        
        // Mock to fail v5 (AES-GCM) but allow v3.5 (AES-GCM-SIV)
        let callCount = 0;
        const spyCipher = jest.spyOn(cryptoWrapper, 'createCipheriv').mockImplementation(() => {
            callCount++;
            if (callCount === 1) throw new Error('v5 Native Fail');
            return {
                update: () => 'v3.5_encrypted_data',
                final: () => '',
                getAuthTag: () => Buffer.alloc(16),
                setAAD: () => {}
            } as any;
        });
        
        // Fail Web Fallback (CryptoJS) for v5
        const spyCryptoJS = jest.spyOn(CryptoJS.AES, 'encrypt').mockImplementationOnce(() => {
            throw new Error('v5 CryptoJS Fail');
        });

        // Force v5
        const encrypted = encrypt(message, testKey, pqcKeypair.publicKey, ENC_VERSION_QUANTUM);
        
        // Should have fallen back to v3.5
        expect(encrypted.startsWith('v3.5:')).toBe(true);
        
        spyCipher.mockRestore();
        spyCryptoJS.mockRestore();
    });

    test('total failure -> CHAT_SERVICE_UNAVAILABLE', () => {
        const cryptoWrapper = require('../crypto-wrapper');
        
        const spyCipher = jest.spyOn(cryptoWrapper, 'createCipheriv').mockImplementation(() => { 
            throw new Error('Fail everything'); 
        });
        const spyCryptoJS = jest.spyOn(CryptoJS.AES, 'encrypt').mockImplementation(() => { 
            throw new Error('Fail everything'); 
        });

        try {
            encrypt(message, testKey, undefined, ENC_VERSION_SIV);
            fail('Should have thrown CHAT_SERVICE_UNAVAILABLE');
        } catch (e: any) {
            expect(e.message).toBe('CHAT_SERVICE_UNAVAILABLE');
        }

        spyCipher.mockRestore();
        spyCryptoJS.mockRestore();
    });
});
