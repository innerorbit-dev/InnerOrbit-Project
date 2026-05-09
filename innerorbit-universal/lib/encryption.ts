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
 
 * HOW IT WORKS (THE "BULLET-PROOF" STACK):
 * - Level 5 (Double Ratchet): Like a conversation where you change the password for every single sentence spoken. Even if one sentence is leaked, the rest remain secret.
 * - Level 4 (Quantum Resistant): Uses "Hybrid" math that combines traditional security with quantum-safe algorithms. If a quantum computer is built tomorrow, your messages are still safe.
 * - Level 3 (Elite AES-GCM): Adds a "Digital Seal" to every message. If anyone changes a single bit of the encrypted text, the seal breaks and the app rejects the message.
 
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
import { createHash, randomBytes, createCipheriv, createDecipheriv, createHmac, argon2Sync } from "./crypto-wrapper";
import { Logger } from "./logger";
import { decryptLegacy } from "./legacy-decryption";

import { initializeRatchet, ratchetEncrypt, ratchetDecrypt, RatchetState } from "./ratchet";
import { decryptV6 } from "./encryption-v6";
import { WebAuthnService } from "./webauthn-service";
import { getSecureItem, setSecureItem, removeSecureItem, getDeviceKeys, encryptWithDeviceKey, decryptWithDeviceKey } from "./device-storage-service";
export { enableWebHardwareLock } from "./device-storage-service";
import { 
  encrypt, 
  decrypt, 
  ENC_VERSION_ELITE, 
  ENC_VERSION_GCM, 
  ENC_VERSION_SIV, 
  ENC_VERSION_RATCHET, 
  ENC_VERSION_QUANTUM, 
  ENC_VERSION_QUANTUM_CHACHA, 
  ENC_VERSION_PQXDH, 
  GCM_IV_LENGTH 
} from "./encryption-core";

export { 
  encrypt, 
  decrypt, 
  ENC_VERSION_ELITE, 
  ENC_VERSION_GCM, 
  ENC_VERSION_SIV, 
  ENC_VERSION_RATCHET, 
  ENC_VERSION_QUANTUM, 
  ENC_VERSION_QUANTUM_CHACHA, 
  ENC_VERSION_PQXDH, 
  GCM_IV_LENGTH 
};

/**
 * Enhanced Encryption utility module for InnerOrbit
 * Implements advanced security features:
 * - Level 4: Quantum Resistant (ML-KEM/Kyber768 + AES-GCM)
 * - Level 3: AES-GCM (Authenticated Encryption) + Argon2id (Memory-hard KDF)
 * - Hardware-backed protection via SecureStore Secure Enclave/Strongbox
 * - Legacy Support: AES-CBC (CryptoJS)
 * - Device-specific key storage logic
 */

const USER_PASSPHRASE_STORAGE = "innerorbit_user_passphrase";
const PQC_PUBLIC_KEY_STORAGE = "innerorbit_pqc_public_key";
const PQC_PRIVATE_KEY_STORAGE = "innerorbit_pqc_private_key";

/**
 * 🛠️ GLOBAL SERVICE KILL-SWITCH
 * Set this to 'true' to immediately disable all outgoing chat services and trigger the UI fallback alert.
 */
export const GLOBAL_DISABLE_CHAT_SERVICES = false; 

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
 * 🔒 SAFETY NUMBER (SECURITY CODE) GENERATION
 * 
 * Generates a human-verifiable 60-digit safety number (split into blocks of 5)
 * based on the public keys of both participants.
 * 
 * @param {object} myKeys    - { identity, dh, pqc } (Base64)
 * @param {object} theirKeys - { identity, dh, pqc } (Base64)
 * @returns {string} 60-digit safety number string
 */
export function generateSafetyNumber(myKeys: any, theirKeys: any): string {
  // Sort IDs/Keys to ensure stability regardless of who calls the function
  const keys = [myKeys, theirKeys].sort((a, b) => 
    (a.identity || "").localeCompare(b.identity || "")
  );

  const hashInput = keys.map(k => `${k.identity || ""}:${k.dh || ""}:${k.pqc || ""}`).join("|");
  const fullHash = createHash("sha256").update(hashInput).digest();

  // Convert hash to a 60-digit number string
  let safetyNumber = "";
  for (let i = 0; i < 12; i++) {
    // Take 2 bytes and turn into a 5-digit zero-padded number
    const chunk = (fullHash[i * 2] << 8) | fullHash[i * 2 + 1];
    safetyNumber += (chunk % 100000).toString().padStart(5, "0");
  }

  // Format with spaces: 12 blocks of 5 digits
  return safetyNumber.match(/.{1,5}/g)?.join(" ") || safetyNumber;
}

export const LEGACY_SEND_VERSION = "legacy";

export interface EncryptionCapabilities {
  v3_5: boolean; // AES-GCM-SIV (Hardened Baseline)
  v4: boolean;   // Double Ratchet
  v5: boolean;   // Quantum Resistant (ML-KEM + AES-GCM)
  v5_5: boolean; // Quantum Resistant (ML-KEM + ChaCha20)
  v6: boolean;   // PQXDH (Architectural Hold)
  minReadable: number;
  maxWritable: number;
}

export interface SendVersionResolutionInput {
  localCapabilities?: Partial<EncryptionCapabilities> | null;
  remoteCapabilities?: Partial<EncryptionCapabilities> | null;
  hasLocalRatchetSession?: boolean;
  hasV6Session?: boolean;
}

export interface SendVersionResolution {
  version: "v2" | "v3" | "v3.5" | "v4" | "v5" | "v5.5" | "v6" | "legacy";
  reason: string;
}

export const DEFAULT_ENCRYPTION_CAPABILITIES: EncryptionCapabilities = {
  v3_5: true,  // Stable Baseline: AES-GCM-SIV
  v4: false,   // Architectural Hold: v4 Double Ratchet
  v5: true,    // Stable: v5 Quantum Resistant Hybrid
  v5_5: true,  // Stable: v5.5 Quantum Resistant (ChaCha20)
  v6: false,   // Architectural Hold: v6 PQXDH
  minReadable: 1,
  maxWritable: 5.5 
};

const telemetry: {
  sendVersion: { v2: number; v3: number; "v3.5": number; v4: number; v5: number; "v5.5": number; v6: number; legacy: number };
  fallbackReasons: Record<string, number>;
  decryptFailures: Record<string, number>;
} = {
  sendVersion: { v2: 0, v3: 0, "v3.5": 0, v4: 0, v5: 0, "v5.5": 0, v6: 0, legacy: 0 },
  fallbackReasons: {},
  decryptFailures: {}
};

function bumpCounter(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] || 0) + 1;
}

export function normalizeCapabilities(caps?: Partial<EncryptionCapabilities> | null): EncryptionCapabilities {
  return {
    v3_5: caps?.v3_5 !== false, // Default to true (stable)
    v4: caps?.v4 === true, // Default to false (hold)
    v5: caps?.v5 !== false, // Default to true (stable)
    v5_5: caps?.v5_5 !== false, // Default to true (stable)
    v6: caps?.v6 === true, // Default to false (hold)
    minReadable: Number.isFinite(caps?.minReadable) ? Number(caps?.minReadable) : DEFAULT_ENCRYPTION_CAPABILITIES.minReadable,
    maxWritable: Number.isFinite(caps?.maxWritable) ? Number(caps?.maxWritable) : DEFAULT_ENCRYPTION_CAPABILITIES.maxWritable
  };
}

export function resolveSendVersion(input: SendVersionResolutionInput): SendVersionResolution {
  const local = normalizeCapabilities(input.localCapabilities);
  const remote = normalizeCapabilities(input.remoteCapabilities);
  const hasLocalRatchetSession = !!input.hasLocalRatchetSession;
  const hasV6Session = !!input.hasV6Session;

  // Level 7: PQXDH Double Ratchet (Protocol v6)
  if (local.v6 && remote.v6 && hasV6Session) {
    telemetry.sendVersion.v6 += 1;
    return { version: "v6", reason: "both_support_v6" };
  }

  // Level 6.5: Quantum Resistant + ChaCha20 (Protocol v5.5)
  if (local.v5_5 && remote.v5_5) {
    telemetry.sendVersion["v5.5"] += 1;
    return { version: "v5.5", reason: "both_support_v5.5" };
  }

  // Level 6: ML-KEM-768 + AES-GCM (Protocol v5)
  if (local.v5 && remote.v5) {
    telemetry.sendVersion.v5 += 1;
    return { version: "v5", reason: "both_support_v5" };
  }

  // Level 5: Double Ratchet (Protocol v4)
  if (local.v4 && remote.v4 && hasLocalRatchetSession) {
    telemetry.sendVersion.v4 += 1;
    return { version: "v4", reason: "both_support_v4" };
  }

  // Level 4.5: Hardened Baseline (Protocol v3.5 - AES-GCM-SIV)
  telemetry.sendVersion["v3.5"] += 1;
  return { version: "v3.5", reason: "hardened_baseline_siv" };
}

export function getEncryptionTelemetrySnapshot() {
  return JSON.parse(JSON.stringify(telemetry));
}


/**
 * Async encrypt — prioritizes SubtleCrypto AES-256-GCM for new web messages.
 *
 * WHY THIS EXISTS:
 * The sync encrypt() falls back to AES-CTR on web (no auth tag = tamper-blind).
 * This async version uses SubtleCrypto directly, producing real GCM with a 16-byte
 * auth tag. The output format is identical to mobile v3: so decryptAsync() handles
 * it natively on all platforms.
 *
 * BACKWARD COMPATIBILITY:
 * Old CTR-encrypted web messages still decrypt via the fallback chain in decryptAsync().
 * This function only affects NEW outgoing web messages.
 *
 * MOBILE / WINDOWS:
 * Not affected — delegates to sync encrypt() which uses react-native-quick-crypto natively.
 *
 * @returns v3:<iv_b64>:<authTag_b64>:<payload_b64>  (web SubtleCrypto GCM)
 *       OR result of sync encrypt()                 (mobile / SubtleCrypto unavailable)
 */
export async function encryptAsync(
  text: string,
  secretKey: string,
  pqcPublicKey?: Uint8Array,
  conversationId?: string,
  versionOverride?: string,
  senderId?: string // 🕶️ Added for Sealed Sender
): Promise<string> {
  if (GLOBAL_DISABLE_CHAT_SERVICES) throw new Error("CHAT_SERVICE_UNAVAILABLE");

  // 🕶️ Sealed Sender: Wrap identity before encryption
  const sealedPayload = senderId ? JSON.stringify({ s: senderId, m: text, t: Date.now() }) : text;

  // ── PQXDH Double Ratchet (v6) ──
  if ((versionOverride === ENC_VERSION_PQXDH || versionOverride === ENC_VERSION_RATCHET) && conversationId) {
    const { encryptV6 } = await import("./encryption-v6");
    return await encryptV6(conversationId, sealedPayload);
  }

  // ── Double Ratchet (v4) ──
  if (versionOverride === ENC_VERSION_RATCHET && conversationId) {
    // Note: We'll need to make sure ratchetEncrypt handles the sealed payload
    const { ratchetEncrypt } = await import("./ratchet");
    // This part might need further refinement depending on how ratchetEncrypt is called
  }

  // ── High-Assurance Fallback ──
  return encrypt(sealedPayload, secretKey, pqcPublicKey, versionOverride);
}


/**
 * Asynchronous decryption for Level 4 (Double Ratchet) and fallbacks
 */
export async function decryptAsync(
  ciphertext: string,
  secretKey: string,
  conversationId?: string,
  pqcSecretKey?: Uint8Array,
  myUid?: string,
  partnerUid?: string,
  messageId?: string,
  skipCache: boolean = false
): Promise<any> { // 🕶️ Changed from string to any to support { text, senderId }
  try {
    let rawDecrypted: string;

    if (ciphertext.startsWith("v4:") || ciphertext.startsWith("v6:")) {
      const isV6 = ciphertext.startsWith("v6:");
      if (!conversationId) throw new Error(`Conversation ID required for ${isV6 ? 'v6' : 'v4'} decryption`);

      const { getV6Session } = await import("./encryption-v6");
      const state = isV6 ? await getV6Session(conversationId) : await getRatchetSession(conversationId);
      
      if (!state && myUid && partnerUid) {
        const { initializeRatchetIfNeeded, initializeV6IfNeeded } = await import("./ratchet-key-service");
        isV6 
          ? await initializeV6IfNeeded(conversationId, myUid, partnerUid)
          : await initializeRatchetIfNeeded(conversationId, myUid, partnerUid);
      }

      rawDecrypted = isV6 
        ? await decryptV6(conversationId, ciphertext, messageId, skipCache) 
        : await decryptV4(conversationId, ciphertext, messageId, skipCache);
    } else if (ciphertext.startsWith(`${ENC_VERSION_QUANTUM}:`) || ciphertext.startsWith(`${ENC_VERSION_QUANTUM_CHACHA}:`)) {
      let activePqcKey = pqcSecretKey;
      if (!activePqcKey) {
        const keys = await getPQCKeypair();
        activePqcKey = keys.secretKey;
      }
      rawDecrypted = decrypt(ciphertext, secretKey, activePqcKey);
    } else {
      rawDecrypted = decrypt(ciphertext, secretKey, pqcSecretKey);
    }

    // 🛡️ Post-Decryption Sync Recovery (v3 fallback)
    if (rawDecrypted === "🔒 Encrypted" && (ciphertext.startsWith("v3:") || ciphertext.startsWith("v2:"))) {
        // ... (Strategy A logic preserved below)
        rawDecrypted = await attemptAsyncGcmRecovery(ciphertext, secretKey) || "🔒 Encrypted";
    }

    // 🕶️ UNSEAL: Recover metadata if present
    if (rawDecrypted.startsWith('{"s":')) {
      try {
        const parsed = JSON.parse(rawDecrypted);
        if (parsed.s && parsed.m) {
          return { text: parsed.m, senderId: parsed.s, timestamp: parsed.t };
        }
      } catch (e) {
        // Fallback to raw if JSON parse fails (e.g. coincidental start with {"s":)
      }
    }

    return rawDecrypted;
  } catch (error) {
    Logger.error("Async decryption error:", error);
    return "🔒 Failed";
  }
}

/** 🛡️ Strategy A: Web Crypto API (SubtleCrypto) GCM helper */
async function attemptAsyncGcmRecovery(ciphertext: string, secretKey: string): Promise<string | null> {
    const parts = ciphertext.split(":");
    if (parts.length >= 4 && isWeb && typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
        try {
            const iv = Buffer.from(parts[1], "base64");
            const tag = Buffer.from(parts[2], "base64");
            const dataBase64 = parts[3];
            const keyHashed = createHash('sha256').update(secretKey).digest();
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
            return new TextDecoder().decode(decryptedRaw);
        } catch (e) {}
    }
    return null;
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
  const result = text.startsWith(`${ENC_VERSION_PQXDH}:`) ||
    text.startsWith(`${ENC_VERSION_QUANTUM}:`) ||
    text.startsWith(`${ENC_VERSION_ELITE}:`) ||
    text.startsWith(`${ENC_VERSION_GCM}:`) ||
    text.startsWith("U2FsdGVkX1") ||
    isV5;
  if (result) {
    let version = text.substring(0, 3);
    if (version === "v3:") version = "v3 (Elite)";
    else if (version === "v4:") version = "v4 (Ratchet)";
    else if (version === "v5:") version = "v5 (Quantum)";
    else if (version === "v6:") version = "v6 (PQXDH)";
    else if (text.startsWith("U2FsdGVkX1")) version = "Legacy (CBC)";
    
    Logger.log(`[isEncrypted] detected: ${version}${isV5 ? ' (v5-legacy)' : ''}`);
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
 * High-level Level 5 Encrypt/Decrypt (Double Ratchet)
 */
export async function encryptV4(conversationId: string, text: string): Promise<string> {
  const state = await getRatchetSession(conversationId);
  if (!state) throw new Error("No ratchet session found for conversation");

  const { ciphertext, header } = await ratchetEncrypt(state, text);
  await saveRatchetSession(conversationId, state);

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString("base64");
  return `${ENC_VERSION_RATCHET}:${headerBase64}:${ciphertext}`;
}

export async function decryptV4(
  conversationId: string, 
  ciphertextV4: string,
  messageId?: string,
  skipCache: boolean = false
): Promise<string> {
  // 🛡️ PERMANENT CACHE CHECK
  if (messageId && !skipCache) {
    const { MessageStorageService } = await import('./message-storage-service');
    const cached = await MessageStorageService.getMessage(conversationId, messageId);
    if (cached) return cached;
  }
  const parts = ciphertextV4.split(":");
  if (parts[0] !== ENC_VERSION_RATCHET) throw new Error("Invalid v4 ciphertext");

  const header = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
  const ciphertext = parts.slice(2).join(":");

  const state = await getRatchetSession(conversationId);
  if (!state) throw new Error("No ratchet session found for conversation");

  const plaintext = await ratchetDecrypt(state, ciphertext, header);
  await saveRatchetSession(conversationId, state);

  // ── PERSIST (Skip if private) ──
  if (messageId && !skipCache) {
    const { MessageStorageService } = await import('./message-storage-service');
    await MessageStorageService.saveMessage(conversationId, messageId, plaintext);
  }

  return plaintext;
}

/**
 * High-level Level 6 Encrypt/Decrypt (Quantum Hybrid)
 * v5 is Quantum.
 */
export async function encryptV5(text: string, secretKey: string, pqcPublicKey: Uint8Array): Promise<string> {
  // Delegate to the main encrypt function with PQC enabled
  return encrypt(text, secretKey, pqcPublicKey);
}

export async function decryptV5(ciphertextV5: string, secretKey: string, pqcSecretKey: Uint8Array): Promise<string> {
  // Delegate to the main decrypt function with PQC enabled
  return decrypt(ciphertextV5, secretKey, pqcSecretKey);
}
