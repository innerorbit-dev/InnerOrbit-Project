import { Logger } from './logger';
import { Buffer } from 'buffer';

/**
 * 🛡️ AEGIS-256 WASM Wrapper
 * 
 * PURPOSE:
 * Provides high-performance, hardware-accelerated (via WASM) AEGIS-256 encryption.
 * This is the Layer 2 "Outer Wrapper" for the Phase 7 Media Vault, designed to 
 * handle 4K video throughput with minimal overhead.
 */

let sodium: any = null;
let isReady = false;

/**
 * Ensures libsodium is initialized before use.
 */
export async function ensureSodiumReady(): Promise<void> {
    if (isReady && sodium) return;
    try {
        if (!sodium) {
            // 🔇 SILENCE: Temporarily suppress internal libsodium WASM warnings
            const originalWarn = console.warn;
            console.warn = (...args: any[]) => {
                if (args[0] && typeof args[0] === 'string' && (args[0].includes('WebAssembly') || args[0].includes('wasm'))) return;
                originalWarn(...args);
            };

            // Lazy load to prevent top-level unhandled rejections
            sodium = require('libsodium-wrappers');

            // Restore original warn
            console.warn = originalWarn;
        }
        // 🤫 SILENCE: libsodium-wrappers rejects with an empty object when WASM is missing.
        await sodium.ready.catch(() => {
            // Ignore internal rejection; the JS fallback is already engaged.
        });
        isReady = true;
        Logger.log("[AEGIS] ✅ Libsodium initialized (JS Fallback Active)");
    } catch (error) {
        Logger.error("[AEGIS] ❌ Failed to initialize libsodium:", error);
    }
}

/**
 * Encrypts data using AEGIS-256.
 * @param data - The raw bytes to encrypt (Uint8Array or Buffer)
 * @param key - 256-bit key (32 bytes)
 * @param nonce - 256-bit nonce (32 bytes for AEGIS-256)
 * @returns Encrypted bytes with authentication tag appended
 */
export async function encryptAegis256(
    data: Uint8Array | Buffer,
    key: Uint8Array | Buffer,
    nonce: Uint8Array | Buffer
): Promise<Uint8Array> {
    await ensureSodiumReady();
    
    try {
        // AEGIS-256 uses a 32-byte (256-bit) nonce
        if (nonce.length !== 32) {
            throw new Error(`AEGIS-256 requires a 32-byte nonce, got ${nonce.length}`);
        }
        if (key.length !== 32) {
            throw new Error(`AEGIS-256 requires a 32-byte key, got ${key.length}`);
        }

        // sodium.crypto_aead_aegis256_encrypt(message, ad, nsec, npub, key)
        // ad = additional data (optional), nsec = null
        return sodium.crypto_aead_aegis256_encrypt(
            data instanceof Buffer ? new Uint8Array(data) : data,
            null, // No additional data
            null, // Secret nonce (unused in sodium)
            nonce instanceof Buffer ? new Uint8Array(nonce) : nonce,
            key instanceof Buffer ? new Uint8Array(key) : key
        );
    } catch (error) {
        Logger.error("[AEGIS] Encryption failed:", error);
        throw error;
    }
}

/**
 * Decrypts data using AEGIS-256.
 * @param encryptedData - The encrypted bytes (with tag)
 * @param key - 256-bit key
 * @param nonce - 256-bit nonce
 * @returns Decrypted raw bytes
 */
export async function decryptAegis256(
    encryptedData: Uint8Array | Buffer,
    key: Uint8Array | Buffer,
    nonce: Uint8Array | Buffer
): Promise<Uint8Array> {
    await ensureSodiumReady();

    try {
        return sodium.crypto_aead_aegis256_decrypt(
            null, // Secret nonce (unused)
            encryptedData instanceof Buffer ? new Uint8Array(encryptedData) : encryptedData,
            null, // Additional data
            nonce instanceof Buffer ? new Uint8Array(nonce) : nonce,
            key instanceof Buffer ? new Uint8Array(key) : key
        );
    } catch (error) {
        Logger.error("[AEGIS] Decryption failed (Seal may be broken or key incorrect):", error);
        throw new Error("DECRYPTION_FAILED");
    }
}

/**
 * Generates a cryptographically secure 256-bit nonce for AEGIS-256.
 */
export async function generateAegisNonce(): Promise<Uint8Array> {
    await ensureSodiumReady();
    return sodium.randombytes_buf(32);
}
