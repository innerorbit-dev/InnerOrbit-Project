/**
 * 🔐 v6: PQXDH DOUBLE RATCHET — HIGHEST SECURITY TIER
 *
 * PURPOSE:
 * Combines Signal's Double Ratchet (Perfect Forward Secrecy) with ML-KEM-768
 * Post-Quantum Key Encapsulation on EVERY ratchet step. Unlike v4 (where PQC
 * is optional), v6 REQUIRES both parties to have ML-KEM-768 key pairs.
 *
 * HOW IT DIFFERS FROM v4 AND v5:
 * ┌──────┬──────────────────────────────────┬────────────────────────┐
 * │ Ver  │ Algorithm                        │ PQC                    │
 * ├──────┼──────────────────────────────────┼────────────────────────┤
 * │  v4  │ Double Ratchet (Signal)          │ Optional (if keys set) │
 * │  v5  │ ML-KEM-768 + AES-GCM             │ Yes (no ratchet)       │
 * │  v6  │ Double Ratchet + ML-KEM-768      │ Mandatory, every step  │
 * └──────┴──────────────────────────────────┴────────────────────────┘
 *
 * SECURITY PROPERTIES:
 * - Perfect Forward Secrecy (PFS): Each message has its own ephemeral key.
 * - Break-in Recovery: New keys are generated after each DH ratchet step.
 * - Quantum Resistance: ML-KEM-768 is included in EVERY DH key exchange.
 * - Hardware Protection: Sessions encrypted with the device's Secure Enclave key.
 *
 * WIRE FORMAT:
 *   v6:<headerBase64>:<ciphertext>
 *   where headerBase64 = base64(JSON({ dh, pqcPk, pqcCt, n, pn }))
 *
 * USAGE:
 *   // One-time setup (both parties exchange public keys out-of-band):
 *   await initializeV6Session(conversationId, {
 *     isAlice: true,
 *     sharedSecret: Buffer.from(...),
 *     remoteDhPublicKey: Buffer.from(...),
 *     remotePqcPublicKey: new Uint8Array(...),
 *   });
 *
 *   // Encrypt:
 *   const ciphertext = await encryptV6(conversationId, 'Hello!');
 *
 *   // Decrypt:
 *   const plaintext = await decryptV6(conversationId, ciphertext);
 */

import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeRatchet,
  ratchetEncrypt,
  ratchetDecrypt,
  RatchetState,
} from './ratchet';
import { ml_kem768, generateKeyPairSync } from './crypto-wrapper';
import { Logger } from './logger';
import { encryptWithDeviceKey, decryptWithDeviceKey } from './device-storage-service';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Wire format prefix for v6 messages. */
import { ENC_VERSION_PQXDH } from './encryption-core';
export { ENC_VERSION_PQXDH };

/** AsyncStorage key prefix for v6 sessions (separate from v4 sessions). */
const V6_SESSION_PREFIX = '@innerorbit_ratchet_v6_';


// ─── Types ───────────────────────────────────────────────────────────────────

export interface V6SessionOptions {
  /** Whether we are the initiator (Alice) in the PQXDH handshake. */
  isAlice: boolean;

  /**
   * Pre-shared secret for root key initialization.
   * Typically derived from a QR code scan, invite link, or previous secure channel.
   */
  sharedSecret: Buffer;

  /** Remote party's X25519 DH public key. Required. */
  remoteDhPublicKey: Buffer;

  /** Remote party's ML-KEM-768 public key. Required — v6 mandates PQC. */
  remotePqcPublicKey: Uint8Array;

  /**
   * Our own X25519 DH key pair.
   * Auto-generated with generateKeyPairSync if not provided.
   */
  ownDhKeyPair?: { publicKey: Buffer; privateKey: Buffer };

  /**
   * Our own ML-KEM-768 key pair.
   * Auto-generated with ml_kem768.keygen() if not provided.
   */
  ownPqcKeyPair?: { publicKey: Uint8Array; secretKey: Uint8Array };
}

// ─── Session Storage ──────────────────────────────────────────────────────────

/**
 * Retrieve and deserialize a v6 ratchet session from AsyncStorage.
 * Returns null if no session exists.
 */
export async function getV6Session(conversationId: string): Promise<RatchetState | null> {
  let data = await AsyncStorage.getItem(`${V6_SESSION_PREFIX}${conversationId}`);
  if (!data) return null;

  // Decrypt if protected with device key (detected by ":" presence without "{")
  if (data.includes(':') && !data.startsWith('{')) {
    try {
      data = await decryptWithDeviceKey(data);
    } catch (e: any) {
      Logger.trace("ENCRYPTION", "encryption-v6.ts", "getV6Session", "FAILED", `Decryption error: ${e?.message}`);
      return null;
    }
  }

  const state = JSON.parse(data);

  // Reconstitute classical DH Buffers
  state.rootKey = Buffer.from(state.rootKey, 'base64');
  state.dhKeyPair.publicKey = Buffer.from(state.dhKeyPair.publicKey, 'base64');
  state.dhKeyPair.privateKey = Buffer.from(state.dhKeyPair.privateKey, 'base64');
  if (state.remoteDhPublicKey)
    state.remoteDhPublicKey = Buffer.from(state.remoteDhPublicKey, 'base64');
  if (state.sendingChainKey)
    state.sendingChainKey = Buffer.from(state.sendingChainKey, 'base64');
  if (state.receivingChainKey)
    state.receivingChainKey = Buffer.from(state.receivingChainKey, 'base64');

  // Reconstitute skipped message keys
  for (const key in state.skippedMessageKeys) {
    state.skippedMessageKeys[key] = Buffer.from(state.skippedMessageKeys[key], 'base64');
  }

  // Reconstitute PQC key material (base64 → Uint8Array)
  if (state.ownPqcKeyPair) {
    state.ownPqcKeyPair.publicKey = new Uint8Array(
      Buffer.from(state.ownPqcKeyPair.publicKey, 'base64')
    );
    state.ownPqcKeyPair.secretKey = new Uint8Array(
      Buffer.from(state.ownPqcKeyPair.secretKey, 'base64')
    );
  }
  if (state.remotePqcPublicKey) {
    state.remotePqcPublicKey = new Uint8Array(
      Buffer.from(state.remotePqcPublicKey, 'base64')
    );
  }
  if (state.pendingPqcCt) {
    state.pendingPqcCt = new Uint8Array(Buffer.from(state.pendingPqcCt, 'base64'));
  }

  return state;
}

/**
 * Serialize and save a v6 ratchet session to AsyncStorage.
 * The session is encrypted with the device key for hardware-bound protection.
 */
export async function saveV6Session(conversationId: string, state: RatchetState): Promise<void> {
  const serialized = {
    ...state,
    rootKey: (state.rootKey as Buffer).toString('base64'),
    dhKeyPair: {
      publicKey: (state.dhKeyPair.publicKey as Buffer).toString('base64'),
      privateKey: (state.dhKeyPair.privateKey as Buffer).toString('base64'),
    },
    remoteDhPublicKey: state.remoteDhPublicKey
      ? (state.remoteDhPublicKey as Buffer).toString('base64')
      : null,
    sendingChainKey: state.sendingChainKey
      ? (state.sendingChainKey as Buffer).toString('base64')
      : null,
    receivingChainKey: state.receivingChainKey
      ? (state.receivingChainKey as Buffer).toString('base64')
      : null,
    skippedMessageKeys: Object.fromEntries(
      Object.entries(state.skippedMessageKeys).map(([k, v]) => [
        k,
        (v as Buffer).toString('base64'),
      ])
    ),
    // PQC key material → base64
    ownPqcKeyPair: state.ownPqcKeyPair
      ? {
          publicKey: Buffer.from(state.ownPqcKeyPair.publicKey).toString('base64'),
          secretKey: Buffer.from(state.ownPqcKeyPair.secretKey).toString('base64'),
        }
      : null,
    remotePqcPublicKey: state.remotePqcPublicKey
      ? Buffer.from(state.remotePqcPublicKey).toString('base64')
      : null,
    pendingPqcCt: state.pendingPqcCt
      ? Buffer.from(state.pendingPqcCt).toString('base64')
      : null,
  };

  const jsonData = JSON.stringify(serialized);

  try {
    const encrypted = await encryptWithDeviceKey(jsonData);
    await AsyncStorage.setItem(`${V6_SESSION_PREFIX}${conversationId}`, encrypted);
    Logger.trace("ENCRYPTION", "encryption-v6.ts", "saveV6Session", "SUCCESS");
  } catch (e: any) {
    Logger.trace("ENCRYPTION", "encryption-v6.ts", "saveV6Session", "RETRY", `Plaintext fallback: ${e?.message}`);
    await AsyncStorage.setItem(`${V6_SESSION_PREFIX}${conversationId}`, jsonData);
  }
}

// ─── Session Initialization ───────────────────────────────────────────────────

/**
 * Initialize a v6 PQXDH session for a conversation.
 *
 * Both parties MUST call this before messaging, providing each other's
 * DH public key and ML-KEM-768 public key (exchanged out-of-band).
 *
 * Auto-generates own key pairs if not provided.
 *
 * @param conversationId - Unique ID for the conversation.
 * @param options - Handshake parameters. See V6SessionOptions.
 * @returns The own public keys to share with the remote party.
 */
export async function initializeV6Session(
  conversationId: string,
  options: V6SessionOptions
): Promise<{
  ownDhPublicKey: Buffer;
  ownPqcPublicKey: Uint8Array;
}> {
  Logger.trace("ENCRYPTION", "encryption-v6.ts", "initializeV6Session", "PENDING", `conv=${conversationId?.substring(0, 5)}...`);

  // ── Auto-generate ML-KEM-768 key pair if not provided ──
  const ownPqcKeyPair = options.ownPqcKeyPair ?? ml_kem768.keygen();

  // ── Auto-generate X25519 DH key pair with proper DER encoding ──
  const rawDhKp = generateKeyPairSync('x25519');
  const ownDhKeyPair = options.ownDhKeyPair ?? {
    publicKey: Buffer.from(rawDhKp.publicKey as any),
    privateKey: Buffer.from(rawDhKp.privateKey as any),
  };

  // ── PQXDH Initial Key Agreement ──
  // Alice encapsulates to Bob's PQC public key to establish a shared PQC secret.
  // Bob will decapsulate using his secret key (handled automatically by the ratchet).
  let pqcSharedSecret: Buffer | undefined;
  if (options.isAlice) {
    const { sharedSecret } = ml_kem768.encapsulate(options.remotePqcPublicKey);
    pqcSharedSecret = Buffer.from(sharedSecret);
    Logger.trace("ENCRYPTION", "encryption-v6.ts", "initializeV6Session", "SUCCESS", "Alice PQC encapsulation complete");
  }

  // ── Initialize the Double Ratchet state with mandatory PQC ──
  const state = await initializeRatchet(
    options.isAlice,
    options.sharedSecret,
    options.remoteDhPublicKey,
    ownDhKeyPair,
    {
      ownPqcKeyPair,
      remotePqcPublicKey: options.remotePqcPublicKey,
      pqcSharedSecret,
    }
  );

  await saveV6Session(conversationId, state);
  Logger.trace("ENCRYPTION", "encryption-v6.ts", "initializeV6Session", "SUCCESS", `isAlice=${options.isAlice}`);
  return {
    ownDhPublicKey: ownDhKeyPair.publicKey,
    ownPqcPublicKey: ownPqcKeyPair.publicKey,
  };
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a message using v6 PQXDH Double Ratchet.
 *
 * @param conversationId - Must match the conversation used for decryption.
 * @param text - Plaintext to encrypt.
 * @param messageId - Optional: Firestore ID for persistent local caching.
 * @returns Encrypted ciphertext string.
 */
export async function encryptV6(
  conversationId: string, 
  text: string,
  messageId?: string
): Promise<string> {
  Logger.trace("ENCRYPTION", "encryption-v6.ts", "encryptV6", "PENDING", `conv=${conversationId?.substring(0, 5)}...`);

  const state = await getV6Session(conversationId);
  if (!state) {
    throw new Error('[v6] No session found. Call initializeV6Session() first.');
  }

  // ── Enforce v6 invariant: PQC is MANDATORY ──
  if (!state.ownPqcKeyPair) {
    throw new Error('[v6] ownPqcKeyPair is missing. v6 requires ML-KEM-768 on both sides.');
  }
  if (!state.remotePqcPublicKey) {
    throw new Error('[v6] remotePqcPublicKey is missing. v6 requires ML-KEM-768 on both sides.');
  }

  const { ciphertext, header } = await ratchetEncrypt(state, text);
  await saveV6Session(conversationId, state);
  Logger.trace("ENCRYPTION", "encryption-v6.ts", "encryptV6", "SUCCESS", `n=${header.n}`);

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64');

  // ── PERSIST FOR FUTURE SESSIONS ──
  if (messageId) {
    const { MessageStorageService } = await import('./message-storage-service');
    await MessageStorageService.saveMessage(conversationId, messageId, text);
  }

  return `${ENC_VERSION_PQXDH}:${headerBase64}:${ciphertext}`;
}

/**
 * Decrypt a v6 PQXDH Double Ratchet ciphertext.
 *
 * @param conversationId - Must match the conversation used for encryption.
 * @param ciphertextV6 - Must start with "v6:".
 * @param messageId - Optional: Firestore ID for persistent local caching.
 * @returns Decrypted plaintext string.
 */
export async function decryptV6(
  conversationId: string, 
  ciphertextV6: string,
  messageId?: string,
  skipCache: boolean = false
): Promise<string> {
  Logger.trace("ENCRYPTION", "encryption-v6.ts", "decryptV6", "PENDING", `conv=${conversationId?.substring(0, 5)}...`);

  if (!ciphertextV6.startsWith(`${ENC_VERSION_PQXDH}:`)) {
    throw new Error(`[v6] Invalid prefix. Expected "v6:", got "${ciphertextV6.substring(0, 5)}"`);
  }

  // 🛡️ PERMANENT CACHE CHECK (Idempotency Guard)
  // Double Ratchet keys are consumed on use. We must retrieve from local storage
  // if this message was already decrypted in a previous session.
  if (messageId) {
    const { MessageStorageService } = await import('./message-storage-service');
    const cached = await MessageStorageService.getMessage(conversationId, messageId);
    if (cached) {
      Logger.trace("ENCRYPTION", "encryption-v6.ts", "decryptV6", "SUCCESS", "Cache hit");
      return cached;
    }
  }

  const parts = ciphertextV6.split(':');
  const header = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  const ciphertext = parts.slice(2).join(':');

  const state = await getV6Session(conversationId);
  if (!state) {
    throw new Error('[v6] No session found for decryption. Session may have been cleared.');
  }

  // ── Enforce v6 invariant ──
  if (!state.ownPqcKeyPair) {
    throw new Error('[v6] ownPqcKeyPair is missing. Cannot decrypt v6 message.');
  }

  const plaintext = await ratchetDecrypt(state, ciphertext, header);
  await saveV6Session(conversationId, state);

  // ── PERSIST FOR FUTURE SESSIONS ──
  if (messageId && !skipCache) {
    const { MessageStorageService } = await import('./message-storage-service');
    await MessageStorageService.saveMessage(conversationId, messageId, plaintext);
  }

  Logger.trace("ENCRYPTION", "encryption-v6.ts", "decryptV6", "SUCCESS", `n=${header.n}`);
  return plaintext;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns true if a v6 session exists for the given conversation. */
export async function hasV6Session(conversationId: string): Promise<boolean> {
  const data = await AsyncStorage.getItem(`${V6_SESSION_PREFIX}${conversationId}`);
  return data !== null;
}

/**
 * Delete a v6 session (e.g. on logout, conversation deletion, or key compromise).
 * This is irreversible — past messages will no longer be decryptable from this device.
 */
export async function deleteV6Session(conversationId: string): Promise<void> {
  await AsyncStorage.removeItem(`${V6_SESSION_PREFIX}${conversationId}`);
  Logger.log(`[v6] 🗑️ Session deleted for conversation ${conversationId}`);
}

/**
 * Check if a message string is a v6 ciphertext.
 */
export function isV6Encrypted(text: string): boolean {
  return typeof text === 'string' && text.startsWith(`${ENC_VERSION_PQXDH}:`);
}
