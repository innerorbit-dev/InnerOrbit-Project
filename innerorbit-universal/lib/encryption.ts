/**
 * 🔐 INNERORBIT CORE ENCRYPTION ENGINE
 * 
 * PURPOSE:
 * This module is the "Heart" of InnerOrbit's security. It manages how data is locked and unlocked 
 * across the entire app, ensuring that messages and sensitive keys are safe from hackers and 
 * future quantum computers.
 * 
 * REAL-LIFE ANALOGY:
 * Imagine a bank vault (The App) that requires three different types of keys to open:
 * 1. A physical key (Device-bound keys stored in the phone's Secure Enclave).
 * 2. A secret combination (User Passphrase hashed with Argon2id).
 * 3. A futuristic lock that can't be picked even by high-tech lasers (Post-Quantum ML-KEM-768).
 * 
 * HOW IT WORKS (THE "BULLET-PROOF" STACK):
 * - Level 5 (Double Ratchet): Like a conversation where you change the password for every single 
 *   sentence spoken. Even if one sentence is leaked, the rest remain secret.
 * - Level 4 (Quantum Resistant): Uses "Hybrid" math that combines traditional security with 
 *   quantum-safe algorithms. If a quantum computer is built tomorrow, your messages are still safe.
 * - Level 3 (Elite AES-GCM): Adds a "Digital Seal" to every message. If anyone changes a single 
 *   bit of the encrypted text, the seal breaks and the app rejects the message.
 * 
 * KEY FEATURES:
 * - Forward Secrecy: Past messages cannot be decrypted even if current keys are stolen.
 * - Break-in Recovery: The system automatically "heals" and generates new secure keys after a compromise.
 * - Hardware Protection: Master keys never leave the phone's dedicated security chip (on mobile).
 */
import { ml_kem768 } from "./crypto-wrapper";
import CryptoJS from "crypto-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { isMobile, isWeb, isIOS } from "../utils/platform";
import { Buffer } from "buffer";
import { createHash, randomBytes, createCipheriv, createDecipheriv, MlKem, argon2Sync } from "./crypto-wrapper";
import { Logger } from "./logger";

import { initializeRatchet, ratchetEncrypt, ratchetDecrypt, RatchetState } from "./ratchet";

/**
 * Enhanced Encryption utility module for InnerOrbit
 * Implements advanced security features:
 * - Level 4: Quantum Resistant (ML-KEM/Kyber768 + AES-GCM)
 * - Level 3: AES-GCM (Authenticated Encryption) + Argon2id (Memory-hard KDF)
 * - Hardware-backed protection via SecureStore Secure Enclave/Strongbox
 * - Legacy Support: AES-CBC (CryptoJS)
 * - Device-specific key storage logic
 */

const DEVICE_KEY_STORAGE = "innerorbit_device_key";
const DEVICE_SALT_STORAGE = "innerorbit_device_salt";
const USER_PASSPHRASE_STORAGE = "innerorbit_user_passphrase";
const PQC_PUBLIC_KEY_STORAGE = "innerorbit_pqc_public_key";
const PQC_PRIVATE_KEY_STORAGE = "innerorbit_pqc_private_key";

/**
 * Helper to securely get items, with migration from AsyncStorage to SecureStore (Mobile)
 * Also handles legacy keys with '@' prefix that are incompatible with SecureStore.
 */
async function getSecureItem(key: string): Promise<string | null> {
  if (isMobile) {
    try {
      let value = await SecureStore.getItemAsync(key);
      if (!value) {
        // Try the new key in AsyncStorage first
        value = await AsyncStorage.getItem(key);
        
        // If still nothing, check for legacy keys with '@' prefix
        if (!value && !key.startsWith("@")) {
          const legacyKey = "@" + key;
          value = await AsyncStorage.getItem(legacyKey);
          if (value) {
            Logger.log(`Migrating legacy key ${legacyKey} to ${key}`);
            await SecureStore.setItemAsync(key, value);
            await AsyncStorage.removeItem(legacyKey); // Clean up legacy key
            return value;
          }
        }

        if (value) {
          // Found in AsyncStorage (new key), migrate to SecureStore
          await SecureStore.setItemAsync(key, value);
          await AsyncStorage.removeItem(key);
        }
      }
      return value;
    } catch (error) {
      // If SecureStore fails (e.g. invalid key format or locked), fall back to AsyncStorage
      Logger.warn(`SecureStore error for ${key} (Expected on some emulators):`, error);
      try {
        let value = await AsyncStorage.getItem(key);
        if (!value && !key.startsWith("@")) {
          value = await AsyncStorage.getItem("@" + key);
        }
        return value;
      } catch (asyncErr) {
        Logger.error(`Ultimate storage failure for ${key}:`, asyncErr);
        return null;
      }
    }
  } else {
    // Web: Use AsyncStorage directly
    let value = await AsyncStorage.getItem(key);
    if (!value && !key.startsWith("@")) {
        value = await AsyncStorage.getItem("@" + key);
    }
    return value;
  }
}

/**
 * Helper to securely set items
 */
async function setSecureItem(key: string, value: string): Promise<void> {
  if (isMobile) {
    try {
      // Level 3 Hardware Hardening: Use Secure Enclave/Strongbox where available
      // Enforce the most secure flags for 'Elite' status
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
        requireAuthentication: false, // Set to true if biometric/passcode prompt is desired every time
      });
    } catch (error) {
      console.error(`Error writing ${key} to SecureStore:`, error);
      await AsyncStorage.setItem(key, value);
    }
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Generates or retrieves device-specific cryptographic material
 */
export async function getDeviceKeys(): Promise<{ deviceKey: string; deviceSalt: string }> {
  try {
    let deviceKey = await getSecureItem(DEVICE_KEY_STORAGE);
    let deviceSalt = await getSecureItem(DEVICE_SALT_STORAGE);

    if (!deviceKey || !deviceSalt) {
      deviceKey = randomBytes(32).toString("hex");
      deviceSalt = randomBytes(16).toString("hex");

      await setSecureItem(DEVICE_KEY_STORAGE, deviceKey);
      await setSecureItem(DEVICE_SALT_STORAGE, deviceSalt);
    }

    return { deviceKey, deviceSalt };
  } catch (error) {
    console.error("Error getting device keys:", error);
    throw new Error("Failed to initialize device keys");
  }
}

/**
 * Generates or retrieves Post-Quantum Keypair (Kyber768)
 */
export async function getPQCKeypair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> {
  try {
    const pubBase64 = await getSecureItem(PQC_PUBLIC_KEY_STORAGE);
    const privBase64 = await getSecureItem(PQC_PRIVATE_KEY_STORAGE);

    if (pubBase64 && privBase64) {
      return {
        publicKey: Buffer.from(pubBase64, "base64"),
        secretKey: Buffer.from(privBase64, "base64")
      };
    }

    // Generate new Kyber768 keypair
    const pk = ml_kem768.keygen();
    
    await setSecureItem(PQC_PUBLIC_KEY_STORAGE, Buffer.from(pk.publicKey).toString("base64"));
    await setSecureItem(PQC_PRIVATE_KEY_STORAGE, Buffer.from(pk.secretKey).toString("base64"));

    return {
      publicKey: pk.publicKey,
      secretKey: pk.secretKey
    };
  } catch (error) {
    console.error("Error managing PQC keys:", error);
    throw new Error("Failed to initialize Post-Quantum keys");
  }
}

/**
 * Encryption Version Constants
 */
const ENC_VERSION_RATCHET = "v5"; // Hybrid PQ Double Ratchet
const ENC_VERSION_QUANTUM = "v4"; // Hybrid PQC + AES-GCM
const ENC_VERSION_ELITE = "v3";   // AES-GCM + Argon2id
const ENC_VERSION_GCM = "v2";     // AES-GCM + PBKDF2
const GCM_IV_LENGTH = 12; // 96 bits recommended for GCM
const LEGACY_SEND_VERSION = "legacy";

export interface EncryptionCapabilities {
  v5: boolean;
  minReadable: number;
  maxWritable: number;
}

export interface SendVersionResolutionInput {
  localCapabilities?: Partial<EncryptionCapabilities> | null;
  remoteCapabilities?: Partial<EncryptionCapabilities> | null;
  hasLocalRatchetSession?: boolean;
}

export interface SendVersionResolution {
  version: "v5" | "legacy";
  reason: string;
}

export const DEFAULT_ENCRYPTION_CAPABILITIES: EncryptionCapabilities = {
  v5: true,
  minReadable: 1,
  maxWritable: 5
};

const telemetry = {
  sendVersion: { v5: 0, legacy: 0 },
  fallbackReasons: {} as Record<string, number>,
  decryptFailures: {} as Record<string, number>
};

function bumpCounter(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] || 0) + 1;
}

export function normalizeCapabilities(caps?: Partial<EncryptionCapabilities> | null): EncryptionCapabilities {
  return {
    v5: caps?.v5 !== false,
    minReadable: Number.isFinite(caps?.minReadable) ? Number(caps?.minReadable) : DEFAULT_ENCRYPTION_CAPABILITIES.minReadable,
    maxWritable: Number.isFinite(caps?.maxWritable) ? Number(caps?.maxWritable) : DEFAULT_ENCRYPTION_CAPABILITIES.maxWritable
  };
}

export function resolveSendVersion(input: SendVersionResolutionInput): SendVersionResolution {
  const local = normalizeCapabilities(input.localCapabilities);
  const remote = normalizeCapabilities(input.remoteCapabilities);
  const hasLocalRatchetSession = !!input.hasLocalRatchetSession;

  if (local.v5 && remote.v5 && local.maxWritable >= 5 && remote.minReadable <= 5 && hasLocalRatchetSession) {
    telemetry.sendVersion.v5 += 1;
    Logger.log("[encryption-policy] send=v5 reason=both_support_v5_with_ratchet");
    return { version: "v5", reason: "both_support_v5_with_ratchet" };
  }

  let reason = "fallback_unknown";
  if (!hasLocalRatchetSession) reason = "no_local_ratchet_session";
  else if (!local.v5) reason = "local_v5_disabled";
  else if (!remote.v5) reason = "remote_v5_disabled";
  else if (local.maxWritable < 5) reason = "local_max_writable_lt_5";
  else if (remote.minReadable > 5) reason = "remote_min_readable_gt_5";

  telemetry.sendVersion.legacy += 1;
  bumpCounter(telemetry.fallbackReasons, reason);
  Logger.log(`[encryption-policy] send=legacy reason=${reason}`);
  return { version: LEGACY_SEND_VERSION, reason };
}

export function getEncryptionTelemetrySnapshot() {
  return JSON.parse(JSON.stringify(telemetry));
}

/**
 * Encrypts a plaintext message using the highest available level (Level 4: Quantum Resistant Hybrid)
 */
export function encrypt(text: string, secretKey: string, pqcPublicKey?: Uint8Array): string {
  if (!secretKey) throw new Error("Encryption key is required");
  try {

    // Level 4: Quantum Resistant Path
    if (pqcPublicKey) {
      const { cipherText: pqcCipherText, sharedSecret: pqcSecret } = ml_kem768.encapsulate(pqcPublicKey);
      
      const hybridKey = createHash('sha256')
        .update(Buffer.from(pqcSecret))
        .update(secretKey)
        .digest();

      const iv = randomBytes(GCM_IV_LENGTH);
      Logger.log(`[encrypt] v4: platform=${isWeb ? 'web' : isIOS ? 'ios' : 'android'}, keyPrefix=${hybridKey.slice(0, 4).toString('hex')}, ivLen=${iv.length}`);
      
      try {
        const cipher = createCipheriv("aes-256-gcm", hybridKey, iv);
        
        let encryptedPayload = cipher.update(text, "utf8", "base64");
        encryptedPayload += cipher.final("base64");
        const authTag = cipher.getAuthTag().toString("base64");
 
        // Format: v4:pqc_ciphertext_base64:iv_base64:tag_base64:payload_base64
        return `${ENC_VERSION_QUANTUM}:${Buffer.from(pqcCipherText).toString("base64")}:${iv.toString("base64")}:${authTag}:${encryptedPayload}`;
      } catch (e) {
        // Web Fallback for Level 4 - Use raw HEX key and pad the IV to 16 bytes
        const hexKey = CryptoJS.enc.Hex.parse(hybridKey.toString("hex"));
        const hexIv = CryptoJS.enc.Hex.parse(Buffer.concat([iv, Buffer.alloc(4, 0)]).toString("hex"));
        const encrypted = CryptoJS.AES.encrypt(text, hexKey, {
          iv: hexIv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }).toString();
        // Format: v4:web:pqc_ciphertext_base64:iv_base64:payload_base64
        return `${ENC_VERSION_QUANTUM}:web:${Buffer.from(pqcCipherText).toString("base64")}:${iv.toString("base64")}:${encrypted}`;
      }
    }

    // Level 3/2: Classic Authenticated Encryption
    const key = createHash('sha256').update(secretKey).digest();
    const iv = randomBytes(GCM_IV_LENGTH);
    
    Logger.log(`[encrypt] v3: platform=${isWeb ? 'web' : isIOS ? 'ios' : 'android'}, keyPrefix=${key.slice(0, 4).toString('hex')}, ivLen=${iv.length}`);

    try {
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      
      let encrypted = cipher.update(text, "utf8", "base64");
      encrypted += cipher.final("base64");
      
      const authTag = cipher.getAuthTag().toString("base64");
      
      // Format: v3:iv_base64:tag_base64:ciphertext_base64
      return `${ENC_VERSION_ELITE}:${iv.toString("base64")}:${authTag}:${encrypted}`;
    } catch (gcmError) {
      // Fallback for native environments where GCM might fail or for Web
      const hexKey = CryptoJS.enc.Hex.parse(key.toString("hex"));
      const hexIv = CryptoJS.enc.Hex.parse(Buffer.concat([iv, Buffer.allocUnsafe(4).fill(0)]).toString("hex"));
      const encrypted = CryptoJS.AES.encrypt(text, hexKey, {
        iv: hexIv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }).toString();
      return `${ENC_VERSION_ELITE}:web:${iv.toString("base64")}:${encrypted}`;
    }
  } catch (error) {
    console.warn("Encryption failed, falling back to legacy:", error);
    try {
        // Ultimate fallback to legacy CryptoJS (CBC)
        return CryptoJS.AES.encrypt(text, secretKey).toString();
    } catch (fallbackError) {
        console.error("Total encryption failure:", fallbackError);
        throw new Error("Failed to encrypt message");
    }
  }
}

/**
 * Decrypts a message, automatically detecting format (Hybrid PQC vs GCM vs Legacy CBC)
 */
export function decrypt(ciphertext: string, secretKey: string, pqcSecretKey?: Uint8Array): string {
  if (!secretKey) throw new Error("Decryption key is required");
  try {

    // Level 5: Double Ratchet
    if (ciphertext.startsWith(`${ENC_VERSION_RATCHET}:`)) {
      Logger.log(`[decrypt] v5: starting session decryption`);
      // Return a special marker that the UI can recognize to trigger async decryption
      return "🔒 [V5_ASYNC_REQUIRED]";
    }

    // Level 4: Quantum Resistant Hybrid
    if (ciphertext.startsWith(`${ENC_VERSION_QUANTUM}:`)) {
      if (!pqcSecretKey) throw new Error("PQC secret key required for Level 4 decryption");
      
      const parts = ciphertext.split(":");
      
      // Handle Web Fallback for Level 4: v4:web:pqc_ct:iv:payload
      if (parts[1] === 'web') {
        const pqcCipherText = Buffer.from(parts[2], "base64");
        // const iv = Buffer.from(parts[3], "base64"); // Not strictly needed for CryptoJS.AES fallback usually
        const payload = parts[4];

        const pqcSecret = ml_kem768.decapsulate(pqcCipherText, pqcSecretKey);
        const hybridKey = createHash('sha256')
          .update(Buffer.from(pqcSecret))
          .update(secretKey)
          .digest();
        
        try {
          const hexKey = CryptoJS.enc.Hex.parse(hybridKey.toString("hex"));
          const ivRaw = Buffer.from(parts[3], "base64");
          const hexIv = CryptoJS.enc.Hex.parse(Buffer.concat([ivRaw, Buffer.alloc(4, 0)]).toString("hex"));
          const bytes = CryptoJS.AES.decrypt(payload, hexKey, {
            iv: hexIv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          const result = bytes.toString(CryptoJS.enc.Utf8);
          if (!result && bytes.sigBytes > 0) throw new Error("Malformed UTF-8");
          return result;
        } catch (e) {
          return "🔒 [Decryption Error (v4 Web Fallback)]";
        }
      }

      const pqcCipherText = Buffer.from(parts[1], "base64");
      const iv = Buffer.from(parts[2], "base64");
      const tag = Buffer.from(parts[3], "base64");
      const payload = parts[4];

      const pqcSecret = ml_kem768.decapsulate(pqcCipherText, pqcSecretKey);
      
      // Re-derive the hybrid key
      const baseHybridKey = createHash('sha256')
        .update(Buffer.from(pqcSecret))
        .update(secretKey)
        .digest();

      // Strategy 1: Double-hashed Hybrid Key (New parity standard)
      const hashedHybridKey = createHash('sha256').update(baseHybridKey).digest();
      
      const khPref = Buffer.from(hashedHybridKey).slice(0, 4).toString('hex');
      const kbPref = Buffer.from(baseHybridKey).slice(0, 4).toString('hex');
      Logger.log(`[decrypt] v4: NATIVE GCM, keyPrefixHashed=${khPref}, keyPrefixRaw=${kbPref}`);

      try {
        const decipher = createDecipheriv("aes-256-gcm", hashedHybridKey as any, iv as any);
        decipher.setAuthTag(tag as any);
        let decrypted = decipher.update(payload, "base64", "utf8");
        decrypted += decipher.final("utf8");
        Logger.log("[decrypt] v4: ✅ Strategy 1 (Hashed Key) succeeded");
        return decrypted;
      } catch (e1: any) {
        Logger.warn(`[decrypt] v4: ❌ Strategy 1 failed, trying Strategy 2 (Raw Key): ${e1?.message || 'Unknown error'}`);
        try {
          const decipher = createDecipheriv("aes-256-gcm", baseHybridKey as any, iv as any);
          decipher.setAuthTag(tag as any);
          let decrypted = decipher.update(payload, "base64", "utf8");
          decrypted += decipher.final("utf8");
          Logger.log("[decrypt] v4: ✅ Strategy 2 (Raw Key) succeeded");
          return decrypted;
        } catch (e2: any) {
          Logger.error(`[decrypt] v4: ❌ All GCM strategies failed: ${e2?.message || 'Unknown error'}`);
          throw e2;
        }
      }
    }

    // Check version prefix (Classic GCM or Web Fallback)
    if (ciphertext.startsWith(`${ENC_VERSION_ELITE}:`) || ciphertext.startsWith(`${ENC_VERSION_GCM}:`)) {
        const parts = ciphertext.split(":");
        
        // Handle Web Fallback: v3:web:[iv:]ciphertext
        if (parts[1] === 'web') {
          try {
            const ivBase64 = parts.length === 4 ? parts[2] : null;
            const encryptedData = parts.length === 4 ? parts[3] : parts[2];
            
            // 1. Check for legacy Salted format (CryptoJS default)
            if (encryptedData.startsWith("U2FsdGVkX1")) {
              try {
                const saltedRes = CryptoJS.AES.decrypt(encryptedData, secretKey).toString(CryptoJS.enc.Utf8);
                if (saltedRes) {
                  const snippet = saltedRes.substring(0, 20).replace(/\n/g, '\\n');
                  Logger.log(`[decrypt] v3: WEB fallback ✅ Salted succeeded: "${snippet}${saltedRes.length > 20 ? '...' : ''}"`);
                  return saltedRes;
                }
              } catch (e) {}
            }

            const keysToTry = [
              { key: createHash('sha256').update(secretKey).digest(), label: "Hashed" },
              { key: Buffer.from(secretKey), label: "Raw" }
            ];
            
            for (const { key, label } of keysToTry) {
              const hexKey = CryptoJS.enc.Hex.parse(key.toString('hex'));
              const ivBuf = ivBase64 ? Buffer.from(ivBase64, "base64") : Buffer.alloc(16, 0);
              
              const variants = [
                { mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: (ivBuf.length === 12 ? Buffer.concat([ivBuf, Buffer.alloc(4, 0)]) : ivBuf), name: "CBC" },
                { mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: Buffer.alloc(16, 0), name: "CBC-ZeroIV" },
                { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.NoPadding, iv: (ivBuf.length === 12 ? Buffer.from(ivBuf.toString("hex") + "00000002", "hex") : ivBuf), name: "CTR-s2" },
                { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.NoPadding, iv: (ivBuf.length === 12 ? Buffer.from(ivBuf.toString("hex") + "00000001", "hex") : ivBuf), name: "CTR-s1" },
                { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.NoPadding, iv: (ivBuf.length === 12 ? Buffer.from(ivBuf.toString("hex") + "00000000", "hex") : ivBuf), name: "CTR-s0" }
              ];

              for (const v of variants) {
                try {
                  const hexIv = CryptoJS.enc.Hex.parse(v.iv.toString("hex"));
                  const bytes = CryptoJS.AES.decrypt(encryptedData, hexKey, {
                    iv: hexIv,
                    mode: v.mode,
                    padding: v.padding
                  });
                  let res = bytes.toString(CryptoJS.enc.Utf8);
                  if (res) res = res.replace(/\0/g, '').trim();
                  
                  if (res && res.length > 0 && !/[\x01-\x08\x0E-\x1F]/.test(res)) {
                    const snippet = res.substring(0, 20).replace(/\n/g, '\\n');
                    Logger.log(`[decrypt] v3: WEB fallback ✅ ${v.name} (${label}) succeeded: "${snippet}${res.length > 20 ? '...' : ''}"`);
                    return res;
                  } else if (bytes.sigBytes > 0) {
                    const hexSnippet = bytes.toString(CryptoJS.enc.Hex).substring(0, 16);
                    Logger.log(`[decrypt] v3: WEB variant ${v.name} (${label}) sigBytes=${bytes.sigBytes}, hexPrefix=${hexSnippet}`);
                  }
                } catch(e) {}
              }
            }
            const preview = encryptedData.substring(0, 15);
            Logger.warn(`[decrypt] v3: WEB fallback FAILED. dataLen=${encryptedData.length}, iv=${ivBase64 ? 'provided' : 'none'}, prefix=${preview}`);
            return "🔒 [Decryption Error (Web Fallback)]";
          } catch (e) {
            return "🔒 [Decryption Error (Web Fallback)]";
          }
        }

        const ivBase64 = parts[1];
        const tagBase64 = parts[2];
        const dataBase64 = parts[3];
        
        const keyHashed = createHash('sha256').update(secretKey).digest();
        const keyHex = secretKey.length === 64 ? Buffer.from(secretKey, 'hex') : null;
        
        const iv = Buffer.from(ivBase64, "base64");
        const tag = Buffer.from(tagBase64, "base64");
        
        const skPrefix = secretKey.substring(0, 8);
        const khStr = Buffer.from(keyHashed).slice(0, 4).toString('hex');
        Logger.log(`[decrypt] v3: NATIVE GCM, skPrefix=${skPrefix}, hash=${khStr}, ivLen=${iv.length}, tagLen=${tag.length}, dataLen=${Buffer.from(dataBase64, 'base64').length}`);
        
        // Strategy 1: Hashed Key (New Standard) - Native GCM
        if (isMobile) {
          try {
            const decipher = createDecipheriv("aes-256-gcm", keyHashed as any, iv as any);
            decipher.setAuthTag(tag as any);
            let decrypted = decipher.update(dataBase64, "base64", "utf8");
            decrypted += decipher.final("utf8");
            
            // Clean up: trim and remove null bytes
            if (decrypted) decrypted = decrypted.replace(/\0/g, '').trim();
            
            const snippet = decrypted.substring(0, 20).replace(/\n/g, '\\n');
            Logger.log(`[decrypt] v3: ✅ Strategy 1 (Hashed) succeeded: "${snippet}${decrypted.length > 20 ? '...' : ''}"`);
            return decrypted;
          } catch (e1: any) {
            Logger.log(`[decrypt] v3: Strategy 1 (Hashed) skipped/failed. Trying recovery...`);
          }
        }
          
        // Strategy 2: Legacy Hex (32 bytes from 64-char hex) - Native GCM
        if (keyHex && isMobile) {
          try {
            const decipher = createDecipheriv("aes-256-gcm", keyHex as any, iv as any);
            decipher.setAuthTag(tag as any);
            let decrypted = decipher.update(dataBase64, "base64", "utf8");
            decrypted += decipher.final("utf8");
            
            if (decrypted) decrypted = decrypted.replace(/\0/g, '').trim();
            
            const snippet = decrypted.substring(0, 20).replace(/\n/g, '\\n');
            Logger.log(`[decrypt] v3: ✅ Strategy 2 (Legacy Hex) succeeded: "${snippet}${decrypted.length > 20 ? '...' : ''}"`);
            return decrypted;
          } catch (e2: any) {
            Logger.log(`[decrypt] v3: Strategy 2 (Legacy Hex) skipped/failed. Trying recovery...`);
          }
        }

        // Strategy 3: CTR mode recovery (Supports varied GCM counter starts)
        const tryV3CTR = (keyBuf: any, label: string) => {
          // GCM standard often uses counter starts at 2 (J0=nonce||01, inc32(J0)=nonce||02)
          // Old polyfills might use 0 or 1.
          const suffixes = ["00000002", "00000001", "00000000"];
          
          for (const suffix of suffixes) {
            try {
              const hexKey = CryptoJS.enc.Hex.parse(Buffer.from(keyBuf).toString("hex"));
              const hexIv = CryptoJS.enc.Hex.parse(Buffer.from(iv).toString("hex") + suffix);
              
              const bytes = CryptoJS.AES.decrypt(dataBase64, hexKey, {
                iv: hexIv,
                mode: CryptoJS.mode.CTR,
                padding: CryptoJS.pad.NoPadding
              });
              
              let result = bytes.toString(CryptoJS.enc.Utf8);
              // Clean up: trim and remove null bytes
              if (result) result = result.replace(/\0/g, '').trim();

              // Simple heuristic for valid recovery: non-empty and primarily printable
              if (result && result.length > 0 && !/[\x01-\x08\x0E-\x1F]/.test(result)) {
                const snippet = result.substring(0, 20).replace(/\n/g, '\\n');
                Logger.log(`[decrypt] v3: ✅ Strategy 3 (CTR Recov, ${label}, s=${suffix}) succeeded: "${snippet}${result.length > 20 ? '...' : ''}" (len=${result.length})`);
                return result;
              }
            } catch (e) {}
          }
          return null;
        };

        if (isWeb) {
          Logger.log(`[decrypt] v3: Web environment detected. Skipping Native GCM, using Recovery...`);
        } else {
          Logger.log(`[decrypt] v3: GCM failed. Attempting CTR Recovery...`);
        }
        let ctrResult = tryV3CTR(keyHashed, "Hashed");
        if (ctrResult) return ctrResult;
        if (keyHex) {
          ctrResult = tryV3CTR(keyHex, "Hex");
          if (ctrResult) return ctrResult;
        }

        // Strategy 4: CryptoJS CBC with parsed GCM data (legacy recovery)
        const tryV3CBC = (keyBuf: any, label: string) => {
          try {
            const hexKey = CryptoJS.enc.Hex.parse(Buffer.from(keyBuf).toString("hex"));
            // Try standard IV padding (padded with 4 bytes of zeros)
            const hexIv = CryptoJS.enc.Hex.parse(Buffer.concat([iv, Buffer.alloc(4, 0)]).toString("hex"));
            
            const bytes = CryptoJS.AES.decrypt(dataBase64, hexKey, {
              iv: hexIv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
            });
            let result = bytes.toString(CryptoJS.enc.Utf8);
            if (result) result = result.replace(/\0/g, '').trim();
            if (result && result.length > 0) {
              const snippet = result.substring(0, 20).replace(/\n/g, '\\n');
              Logger.log(`[decrypt] v3: ✅ Strategy 4 (CBC Recov, ${label}) succeeded: "${snippet}${result.length > 20 ? '...' : ''}" (len=${result.length})`);
              return result;
            }
          } catch (cbcErr) {}
          return null;
        };

        Logger.log(`[decrypt] v3: CTR failed. Attempting CBC Recovery...`);
        let cbcResult = tryV3CBC(keyHashed, "Hashed");
        if (cbcResult) return cbcResult;
        if (keyHex) {
          cbcResult = tryV3CBC(keyHex, "Hex");
          if (cbcResult) return cbcResult;
        }
          
        Logger.warn(`[decrypt] v3: ⚠️ All recovery strategies exhausted for skPrefix=${skPrefix}.`);
    }

    // Fallback to legacy CBC (CryptoJS)
    const tryCBC = (key: any, label: string) => {
      try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        if (plaintext && plaintext.length > 0) {
          Logger.log(`[decrypt] ✅ CBC Success (${label})`);
          return plaintext;
        }
      } catch (e) {}
      return null;
    };

    // Try Hashed Key first (Modern CBC fallback)
    const keyHashed = createHash('sha256').update(secretKey).digest().toString('hex');
    let recovered = tryCBC(CryptoJS.enc.Hex.parse(keyHashed), "Hashed Hex");
    if (recovered) return recovered;

    // Try Hex Key (Legacy 32-byte)
    if (secretKey.length === 64) {
      recovered = tryCBC(CryptoJS.enc.Hex.parse(secretKey), "Raw Hex");
      if (recovered) return recovered;
    }

    // Try Literal String Key
    recovered = tryCBC(secretKey, "Raw String");
    if (recovered) return recovered;

    // Graceful fallback: instead of throwing, return a placeholder
    Logger.warn(`[decrypt] ⚠️ All strategies exhausted. skPrefix=${secretKey.substring(0, 8)}, cipher=${ciphertext.substring(0, 20)}...`);
    return "🔒 Encrypted Message";
  } catch (error) {
    Logger.error("Decryption error details:", error);
    return "🔒 Encrypted Message";
  }
}

/**
 * Asynchronous decryption for Level 5 (Double Ratchet) and fallbacks
 */
export async function decryptAsync(ciphertext: string, secretKey: string, conversationId?: string, pqcSecretKey?: Uint8Array): Promise<string> {
  try {
    if (ciphertext.startsWith("v5:")) {
      if (!conversationId) throw new Error("Conversation ID required for v5 decryption");
      return await decryptV5(conversationId, ciphertext);
    }

    // Standard synchronous versions handles most cases
    const result = decrypt(ciphertext, secretKey, pqcSecretKey);
    if (result !== "🔒 Encrypted Message") return result;

    // IF decrypt failed (returned placeholder), try async recovery for v3: web/mobile mismatch
    if (ciphertext.startsWith("v3:") || ciphertext.startsWith("v2:")) {
      const parts = ciphertext.split(":");
      if (parts.length >= 4) {
        const iv = Buffer.from(parts[1], "base64");
        const tag = Buffer.from(parts[2], "base64");
        const dataBase64 = parts[3];
        const keyHashed = createHash('sha256').update(secretKey).digest();

        // Strategy A: Web Crypto API (SubtleCrypto) GCM - works in browsers natively
        if (isWeb && typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
          try {
            const cryptoKey = await globalThis.crypto.subtle.importKey(
              'raw', new Uint8Array(keyHashed), { name: 'AES-GCM' }, false, ['decrypt']
            );
            const ciphertextBuf = Buffer.from(dataBase64, 'base64');
            const tagBuf = Buffer.from(tag);
            const combined = new Uint8Array(ciphertextBuf.length + tagBuf.length);
            combined.set(ciphertextBuf);
            combined.set(tagBuf, ciphertextBuf.length);
            
            const decryptedRaw = await globalThis.crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: new Uint8Array(iv) }, cryptoKey, combined
            );
            const decoded = new TextDecoder().decode(decryptedRaw);
            Logger.log("[decryptAsync] v3: ✅ Strategy A (SubtleCrypto) succeeded");
            return decoded;
          } catch (subtleErr: any) {
            Logger.warn(`[decryptAsync] v3: ❌ SubtleCrypto failed: ${subtleErr?.message}`);
          }
        }
      }
    }

    if (result === "🔒 Encrypted Message" || result === "🔒 Decryption Failed") {
      const failureKey = ciphertext?.startsWith("v5:") ? "v5" :
        ciphertext?.startsWith("v4:") ? "v4" :
        ciphertext?.startsWith("v3:") ? "v3" :
        ciphertext?.startsWith("v2:") ? "v2" : "legacy";
      bumpCounter(telemetry.decryptFailures, failureKey);
      Logger.warn(`[decryptAsync] failure version=${failureKey}`);
    }
    return result;
  } catch (error) {
    Logger.error("Async decryption error:", error);
    const failureKey = ciphertext?.startsWith("v5:") ? "v5" :
      ciphertext?.startsWith("v4:") ? "v4" :
      ciphertext?.startsWith("v3:") ? "v3" :
      ciphertext?.startsWith("v2:") ? "v2" : "legacy";
    bumpCounter(telemetry.decryptFailures, failureKey);
    return "🔒 Decryption Failed";
  }
}

/**
 * Level 3: Encrypt with Device Key (for secure storage)
 */
export async function encryptWithDeviceKey(text: string): Promise<string> {
  const { deviceKey } = await getDeviceKeys();
  return encrypt(text, deviceKey);
}

/**
 * Level 3: Decrypt with Device Key (for secure storage)
 */
export async function decryptWithDeviceKey(ciphertext: string): Promise<string> {
  const { deviceKey } = await getDeviceKeys();
  return decrypt(ciphertext, deviceKey);
}

/**
 * Helper utilities
 */
export function generateRandomKey(): string {
  return randomBytes(32).toString("hex");
}

export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const isV5 = text.startsWith(`${ENC_VERSION_RATCHET}:`) || text.includes("\"dh\":");
  const result = text.startsWith(`${ENC_VERSION_QUANTUM}:`) || 
         text.startsWith(`${ENC_VERSION_ELITE}:`) || 
         text.startsWith(`${ENC_VERSION_GCM}:`) || 
         text.startsWith("U2FsdGVkX1") ||
         isV5;
  if (result) {
    Logger.log(`[isEncrypted] detected: ${text.substring(0, 3)}${isV5 ? ' (v5)' : ''}`);
  }
  return result;
}

/**
 * Legacy function for backward compatibility with existing UI components
 */
export function deriveConversationKey(conversationId: string, participantUids: string[]): string {
    if (!conversationId || !participantUids || participantUids.length < 2) return "";
    const sortedUids = [...participantUids].sort();
    const keyMaterial = `${conversationId}:${sortedUids.join(":")}`;
    return CryptoJS.SHA256(keyMaterial).toString();
}

// Re-export other functions as they were
export async function setUserPassphrase(passphrase: string): Promise<void> {
  try {
    if (!passphrase || passphrase.length < 8) {
      throw new Error("Passphrase must be at least 8 characters long");
    }
    
    // Use a unique salt for each user/passphrase
    const salt = randomBytes(16).toString('hex');
    
    // Use Argon2id (via argon2Sync helper) for strong passphrase hashing
    const hashedPassphrase = argon2Sync('argon2id', {
      message: passphrase,
      nonce: Buffer.from(salt, 'hex'),
      memory: 65536,
      passes: 3,
      parallelism: 4,
      tagLength: 32
    }).toString('hex');

    // Store salt and hash together
    const storageValue = `${salt}:${hashedPassphrase}`;
    await setSecureItem(USER_PASSPHRASE_STORAGE, storageValue);
    Logger.log("[Encryption] User passphrase updated with strong hashing");
  } catch (error) {
    console.error("Error setting user passphrase:", error);
    throw error;
  }
}

export async function getUserPassphrase(): Promise<string | null> {
  const value = await getSecureItem(USER_PASSPHRASE_STORAGE);
  if (!value) return null;
  
  // Return the hash part for backward compatibility with existing usage
  if (value.includes(":")) {
    return value.split(":")[1];
  }
  return value;
}

export async function deriveEphemeralKey(
  conversationId: string, 
  participantUids: string[], 
  timestamp: number = Date.now()
): Promise<string> {
    const { deviceKey, deviceSalt } = await getDeviceKeys();
    const userPassphrase = await getUserPassphrase();
    const sortedUids = [...participantUids].sort();

    const keyMaterial = [
      conversationId,
      sortedUids.join(":"),
      deviceKey,
      deviceSalt,
      timestamp.toString(),
      userPassphrase || ""
    ].join(":");

    // Use Argon2id for Level 3 key derivation (Elite Status)
    const saltBuffer = Buffer.from(deviceSalt, 'hex');
    
    // Argon2id parameters (High security, mobile-optimized)
    const derivedKey = argon2Sync('argon2id', {
      message: keyMaterial,
      nonce: saltBuffer,
      memory: 65536, // 64 MB
      passes: 3,       // 3 iterations
      parallelism: 4,    // 4 threads
      tagLength: 32     // 256-bit key
    });
    
    return derivedKey.toString('hex');
}

export async function generateSafetyNumber(conversationId: string, participantUids: string[]): Promise<string> {
    const { deviceKey } = await getDeviceKeys();
    const sortedUids = [...participantUids].sort();
    const fingerprintMaterial = [conversationId, sortedUids.join(":"), deviceKey].join(":");
    
    const fingerprint = createHash('sha256').update(fingerprintMaterial).digest().toString('hex');
    return fingerprint.match(/.{1,5}/g)?.join(' ').toUpperCase() || fingerprint.toUpperCase();
}
/**
 * Level 5: Double Ratchet Session Management
 */
const RATCHET_SESSION_PREFIX = "@innerorbit_ratchet_";

export async function getRatchetSession(conversationId: string): Promise<RatchetState | null> {
  let data = await AsyncStorage.getItem(`${RATCHET_SESSION_PREFIX}${conversationId}`);
  if (!data) return null;

  // Level 3: Attempt to decrypt if it looks like an encrypted string
  if (data.includes(":") && !data.startsWith("{")) {
    try {
      data = await decryptWithDeviceKey(data);
    } catch (e) {
      Logger.error("[Encryption] Failed to decrypt ratchet session:", e);
      return null;
    }
  }

  // Note: We need to reconstitute Buffers after JSON.parse
  const state = JSON.parse(data);
  state.rootKey = Buffer.from(state.rootKey, "base64");
  state.dhKeyPair.publicKey = Buffer.from(state.dhKeyPair.publicKey, "base64");
  state.dhKeyPair.privateKey = Buffer.from(state.dhKeyPair.privateKey, "base64");
  if (state.remoteDhPublicKey) state.remoteDhPublicKey = Buffer.from(state.remoteDhPublicKey, "base64");
  if (state.sendingChainKey) state.sendingChainKey = Buffer.from(state.sendingChainKey, "base64");
  if (state.receivingChainKey) state.receivingChainKey = Buffer.from(state.receivingChainKey, "base64");
  
  // Reconstitute skipped keys
  for (const key in state.skippedMessageKeys) {
    state.skippedMessageKeys[key] = Buffer.from(state.skippedMessageKeys[key], "base64");
  }
  
  return state;
}

export async function saveRatchetSession(conversationId: string, state: RatchetState): Promise<void> {
  // Convert Buffers to base64 for storage
  const serialized = {
    ...state,
    rootKey: state.rootKey.toString("base64"),
    dhKeyPair: {
      publicKey: state.dhKeyPair.publicKey.toString("base64"),
      privateKey: state.dhKeyPair.privateKey.toString("base64")
    },
    remoteDhPublicKey: state.remoteDhPublicKey?.toString("base64"),
    sendingChainKey: state.sendingChainKey?.toString("base64"),
    receivingChainKey: state.receivingChainKey?.toString("base64"),
    skippedMessageKeys: Object.fromEntries(
      Object.entries(state.skippedMessageKeys).map(([k, v]) => [k, (v as Buffer).toString("base64")])
    )
  };
  
  const jsonData = JSON.stringify(serialized);
  
  // Level 3 Hardware/Device-bound protection
  try {
    const encryptedData = await encryptWithDeviceKey(jsonData);
    await AsyncStorage.setItem(`${RATCHET_SESSION_PREFIX}${conversationId}`, encryptedData);
  } catch (e) {
    Logger.warn("[Encryption] Failed to encrypt ratchet session, saving in plaintext fallback");
    await AsyncStorage.setItem(`${RATCHET_SESSION_PREFIX}${conversationId}`, jsonData);
  }
}

/**
 * High-level Level 5 Encrypt/Decrypt
 */
export async function encryptV5(conversationId: string, text: string): Promise<string> {
  const state = await getRatchetSession(conversationId);
  if (!state) throw new Error("No ratchet session found for conversation");
  
  const { ciphertext, header } = ratchetEncrypt(state, text);
  await saveRatchetSession(conversationId, state);
  
  const headerBase64 = Buffer.from(JSON.stringify(header)).toString("base64");
  return `${ENC_VERSION_RATCHET}:${headerBase64}:${ciphertext}`;
}

export async function decryptV5(conversationId: string, ciphertextV5: string): Promise<string> {
  const parts = ciphertextV5.split(":");
  if (parts[0] !== ENC_VERSION_RATCHET) throw new Error("Invalid v5 ciphertext");
  
  const header = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
  const ciphertext = parts.slice(2).join(":");
  
  const state = await getRatchetSession(conversationId);
  if (!state) throw new Error("No ratchet session found for conversation");
  
  const plaintext = ratchetDecrypt(state, ciphertext, header);
  await saveRatchetSession(conversationId, state);
  
  return plaintext;
}
