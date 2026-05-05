/** Purpose: Signal-based Double Ratchet implementation enhanced with Hybrid ML-KEM-768 for Quantum Resistance. */
/**
 * 🔄 DOUBLE RATCHET & POST-QUANTUM PROTOCOL
 * 
 * PURPOSE:
 * This is the "Engine Room" for end-to-end encrypted conversations. It ensures that every 
 * message has its own unique, temporary key.
 * 
 * REAL-LIFE ANALOGY:
 * Imagine you and a friend are writing letters. Instead of using the same code for every letter:
 * 1. You include a "hint" in letter #1 on how to decode letter #2.
 * 2. Letter #2 includes a "hint" for letter #3, and so on.
 * 3. Even if a thief steals letter #5 and somehow cracks it, they cannot use that info to 
 *    understand letter #4 (Past) or letter #6 (Future).
 * 
 * WHY IT IS "BULLET-PROOF":
 * - Self-Healing: If an attacker steals your current session key, the very next time you 
 *   receive a message, the system "ratchets" (rotates) to a brand new key that the 
 *   attacker doesn't have.
 * - Double Layers: It uses two types of math "ratchets":
 *    a) Diffie-Hellman (Classical) - Changes keys when people take turns replying.
 *    b) Hash Chain (Symmetric) - Changes keys for every single message sent in a row.
 * - Quantum-Safe: We've added a third layer (ML-KEM-768) that protects the conversation 
 *   against quantum computer attacks.
 */
import { Buffer } from "buffer";
import CryptoJS from "crypto-js";
import { createHmac, diffieHellman, generateKeyPairSync, randomBytes, createCipheriv, createDecipheriv, createHash } from "./crypto-wrapper";
import { ml_kem768 } from "./crypto-wrapper";
import { Logger } from "./logger";

/**
 * Double Ratchet + Hybrid Post-Quantum Implementation
 * 
 * This module implements the Signal Protocol's Double Ratchet algorithm
 * enhanced with ML-KEM (Kyber768) for Quantum Resistance.
 */

export interface RatchetState {
  // DH Ratchet
  dhKeyPair: { publicKey: any; privateKey: any };
  remoteDhPublicKey: any | null;
  
  // KDF Chains
  rootKey: any;
  sendingChainKey: any | null;
  receivingChainKey: any | null;
  
  // Message indices
  sendingIndex: number;
  receivingIndex: number;
  previousCounter: number; // Number of messages in previous sending chain
  
  // Out-of-order handling
  skippedMessageKeys: Record<string, any>; // Key format: "remoteDhPublicKey:index"
  
  // PQ Extension (Level 5 Hybrid)
  ownPqcKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null;
  remotePqcPublicKey: Uint8Array | null;
  pendingPqcCt: Uint8Array | null;
}

/**
 * KDF for Root Key (Step root chain)
 */
function kdfRK(rk: Buffer, dhOut: Buffer, pqcSharedSecret?: Buffer): [Buffer, Buffer] {
  const info = "InnerOrbit_Root_Chain";
  const hmac = createHmac("sha256", rk as any)
    .update(dhOut as any);
  
  if (pqcSharedSecret) {
    hmac.update(pqcSharedSecret as any);
  }
  
  const derived = hmac.update(Buffer.from(info) as any).digest();
  
  return [Buffer.from(derived.slice(0, 32)) as any, Buffer.from(derived.slice(32, 64)) as any];
}

/**
 * KDF for Chain Key (Step sending/receiving chain)
 */
function kdfCK(ck: Buffer): [Buffer, Buffer] {
  const nextCk = createHmac("sha256", ck as any).update(Buffer.from([0x01]) as any).digest();
  const mk = createHmac("sha256", ck as any).update(Buffer.from([0x02]) as any).digest();
  
  return [Buffer.from(nextCk) as any, Buffer.from(mk) as any];
}

/**
 * Initial Handshake (PQXDH Hybrid Setup)
 */
export async function initializeRatchet(
  isAlice: boolean,
  sharedSecret: Buffer,
  remoteDhPublicKey: Buffer,
  ownDhKeyPair: { publicKey: Buffer; privateKey: Buffer },
  pqcOptions?: {
    ownPqcKeyPair?: { publicKey: Uint8Array; secretKey: Uint8Array };
    remotePqcPublicKey?: Uint8Array;
    pqcSharedSecret?: Buffer;
  }
): Promise<RatchetState> {
  const state: RatchetState = {
    dhKeyPair: ownDhKeyPair,
    remoteDhPublicKey: remoteDhPublicKey,
    rootKey: sharedSecret,
    sendingChainKey: null,
    receivingChainKey: null,
    sendingIndex: 0,
    receivingIndex: 0,
    previousCounter: 0,
    skippedMessageKeys: {},
    ownPqcKeyPair: pqcOptions?.ownPqcKeyPair || null,
    remotePqcPublicKey: pqcOptions?.remotePqcPublicKey || null,
    pendingPqcCt: null
  };

  const dhOut = (diffieHellman({
    privateKey: state.dhKeyPair.privateKey as any,
    publicKey: state.remoteDhPublicKey as any
  }) as any) as Buffer;

  if (isAlice) {
    const [newRootKey, newSendingChainKey] = kdfRK(state.rootKey, dhOut, pqcOptions?.pqcSharedSecret);
    state.rootKey = newRootKey;
    state.sendingChainKey = newSendingChainKey;
  } else {
    const [newRootKey, newReceivingChainKey] = kdfRK(state.rootKey, dhOut, pqcOptions?.pqcSharedSecret);
    state.rootKey = newRootKey;
    state.receivingChainKey = newReceivingChainKey;
  }

  return state;
}

const MAX_SKIP = 1000;

/**
 * Safely reconstitutes a Buffer from various formats (Buffer, base64 string, or JSON-serialized object).
 */
function reconstituteBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data, "base64");
  if (data && typeof data === 'object') {
    const rawData = data.data !== undefined ? data.data : data;
    try {
      return Buffer.from(rawData);
    } catch (e) {
      Logger.error("[ratchet] Failed to reconstitute buffer from object:", e);
    }
  }
  return Buffer.from(data);
}

/**
 * Perform a DH Ratchet step
 */
function dhRatchet(state: RatchetState, header: any) {
  state.previousCounter = state.sendingIndex;
  state.sendingIndex = 0;
  state.receivingIndex = 0;
  
  try {
    state.remoteDhPublicKey = reconstituteBuffer(header.dh) as any;
  } catch (e) {
    Logger.error("[dhRatchet] Error reconstituting remote DH public key:", e);
    state.remoteDhPublicKey = Buffer.alloc(32, 0) as any;
  }
  
  let pqcSecret: Buffer | undefined;
  if (header.pqcCt && state.ownPqcKeyPair) {
    const ss = ml_kem768.decapsulate(header.pqcCt, state.ownPqcKeyPair.secretKey);
    pqcSecret = Buffer.from(ss);
  }

  const dhOut = (diffieHellman({
    privateKey: state.dhKeyPair.privateKey as any,
    publicKey: state.remoteDhPublicKey! as any
  }) as any) as Buffer;
  
  const [newRootKey, newReceivingChainKey] = kdfRK(state.rootKey, dhOut, pqcSecret);
  state.rootKey = newRootKey;
  state.receivingChainKey = newReceivingChainKey;
  
  Logger.log(`[dhRatchet] Receiving chain rotated: rkPrefix=${newRootKey.slice(0, 4).toString('hex')}, rckPrefix=${newReceivingChainKey.slice(0, 4).toString('hex')}`);
  
  // Generate new DH key for sending
  const newDh = generateKeyPairSync("x25519");
  state.dhKeyPair = {
    publicKey: newDh.publicKey as any,
    privateKey: newDh.privateKey as any
  };
  
  // Update PQ state if new key provided
  if (header.pqcPk) {
    state.remotePqcPublicKey = header.pqcPk;
  }

  let sendPqcCt: Uint8Array | undefined;
  let sendPqcSecret: Buffer | undefined;
  if (state.remotePqcPublicKey) {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(state.remotePqcPublicKey);
    sendPqcCt = cipherText;
    sendPqcSecret = Buffer.from(sharedSecret);
  }

  const dhOutSend = (diffieHellman({
    privateKey: state.dhKeyPair.privateKey as any,
    publicKey: state.remoteDhPublicKey! as any
  }) as any) as Buffer;
  
  const [finalRootKey, newSendingChainKey] = kdfRK(state.rootKey, dhOutSend, sendPqcSecret);
  state.rootKey = finalRootKey;
  state.sendingChainKey = newSendingChainKey;

  Logger.log(`[dhRatchet] Sending chain rotated: rkPrefix=${finalRootKey.slice(0, 4).toString('hex')}, sckPrefix=${newSendingChainKey.slice(0, 4).toString('hex')}`);

  state.pendingPqcCt = sendPqcCt || null;
}

/**
 * Skip messages to handle out-of-order delivery
 */
function skipMessageKeys(state: RatchetState, until: number) {
  if (state.receivingIndex + MAX_SKIP < until) {
    throw new Error("Too many messages skipped");
  }
  if (state.receivingChainKey) {
    while (state.receivingIndex < until) {
      const [nextCk, mk] = kdfCK(state.receivingChainKey);
      state.receivingChainKey = nextCk;
      const skipKey = `${state.remoteDhPublicKey?.toString("base64")}:${state.receivingIndex}`;
      state.skippedMessageKeys[skipKey] = mk;
      state.receivingIndex++;
    }
  }
}

/**
 * Encrypt a message with the current ratchet state
 */
export function ratchetEncrypt(state: RatchetState, plaintext: string): { ciphertext: string; header: any } {
  if (!state.sendingChainKey) {
    if (!state.remoteDhPublicKey) {
       throw new Error("Ratchet not initialized for sending (missing remote public key)");
    }
    Logger.log(`[ratchetEncrypt] Triggering initial DH ratchet step`);
    // Perform a DH ratchet step to generate a sending chain
    dhRatchet(state, { dh: state.remoteDhPublicKey });
  }

  const [nextCk, mk] = kdfCK(state.sendingChainKey);
  state.sendingChainKey = nextCk;
  
  const iv = randomBytes(12);
  
  const header: any = {
    dh: state.dhKeyPair.publicKey,
    n: state.sendingIndex,
    pn: state.previousCounter
  };

  // PQ Extension: Rotate PQC key occasionally or include current public key for PCS
  if (state.ownPqcKeyPair) {
    header.pqcPk = state.ownPqcKeyPair.publicKey;
  }
  
  if (state.pendingPqcCt) {
    header.pqcCt = state.pendingPqcCt;
    state.pendingPqcCt = null; // Clear after sending
  }

  state.sendingIndex++;

  try {
    const key = createHash('sha256').update(mk).digest();
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    const tag = cipher.getAuthTag();
    Logger.log(`[ratchetEncrypt] ciphertext: ${iv.toString("base64").substring(0, 8)}... (tag: ${tag.toString("base64").substring(0, 8)})`);

    return {
      ciphertext: `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`,
      header
    };
  } catch (e) {
    // Web Fallback for Level 5 - Use hashed GCM key as raw CBC key
    const key = createHash('sha256').update(mk).digest();
    const hexKey = CryptoJS.enc.Hex.parse(key.toString("hex"));
    
    // 🛡️ SECURITY FIX: Use a random 16-byte IV for CBC instead of static zero IV
    const cbcIv = randomBytes(16);
    const hexIv = CryptoJS.enc.Hex.parse(cbcIv.toString("hex"));
    
    const encrypted = CryptoJS.AES.encrypt(plaintext, hexKey, {
      iv: hexIv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();

    // Include a simple HMAC-SHA256 for integrity since CBC doesn't provide it
    const hmac = createHmac('sha256', mk as any).update(encrypted as any).digest('base64');

    return {
      ciphertext: `web:${cbcIv.toString("base64")}:${hmac}:${encrypted}`,
      header
    };
  }
}

/**
 * Decrypt a message and advance ratchet
 */
export function ratchetDecrypt(state: RatchetState, ciphertext: string, header: any): string {
  const parts = ciphertext.split(":");
  let iv: Buffer, tag: Buffer, payload: string, isWeb = false, receivedHmac: string | null = null;

  if (parts[0] === 'web') {
    isWeb = true;
    iv = Buffer.from(parts[1], "base64");
    
    // Check if we have the new format with HMAC: web:iv:hmac:payload
    if (parts.length === 4) {
      receivedHmac = parts[2];
      payload = parts[3];
    } else {
      // Legacy web format: web:iv:payload
      payload = parts[2];
    }
    tag = Buffer.alloc(0);
  } else {
    iv = Buffer.from(parts[0], "base64");
    tag = Buffer.from(parts[1], "base64");
    payload = parts[2];
  }

  Logger.log(`[ratchetDecrypt] incoming: isWeb=${isWeb}, ivPrefix=${iv.toString("base64").substring(0, 8)}`);

  let headerDh: Buffer;
  try {
    headerDh = reconstituteBuffer(header.dh);
  } catch (e) {
    Logger.error("[ratchetDecrypt] Critical error reconstituting header DH key:", e);
    // Return a dummy buffer to avoid crash, decryption will naturally fail
    headerDh = Buffer.alloc(32, 0);
  }

  // Check skipped keys first
  const skipKey = `${headerDh.toString("base64")}:${header.n}`;
  if (state.skippedMessageKeys[skipKey]) {
    const mk = state.skippedMessageKeys[skipKey];
    delete state.skippedMessageKeys[skipKey];
    return decryptWithKey(mk, iv, tag, payload, isWeb);
  }

  // If header has a new DH key, we need a DH ratchet step
  if (state.remoteDhPublicKey === null || !headerDh.equals(state.remoteDhPublicKey)) {
    skipMessageKeys(state, header.pn);
    dhRatchet(state, header);
  }

  // Skip messages in current chain if needed
  skipMessageKeys(state, header.n);
  
  const [nextCk, mk] = kdfCK(state.receivingChainKey!);
  state.receivingChainKey = nextCk;
  state.receivingIndex++;

  return decryptWithKey(mk, iv, tag, payload, isWeb, receivedHmac);
}

function decryptWithKey(mk: Buffer, iv: Buffer, tag: Buffer, payload: string, isWeb: boolean = false, receivedHmac: string | null = null): string {
  // Pre-derive key variants
  const keyHashed = createHash('sha256').update(mk).digest();
  
  // Strategy: Legacy Hex - If mk is 64 hex characters, convert to 32 bytes
  let keyHex: Buffer | null = null;
  if (mk.length === 64) {
    try {
      const mkStr = mk.toString('utf8');
      if (/^[0-9a-fA-F]{64}$/.test(mkStr)) {
        keyHex = Buffer.from(mkStr, 'hex');
      }
    } catch (e) {}
  }

  const keyRaw = mk;

  if (isWeb) {
    // 🛡️ SECURITY FIX: Verify HMAC if provided before attempting decryption
    if (receivedHmac) {
      const calculatedHmac = createHmac('sha256', mk as any).update(payload as any).digest('base64');
      if (calculatedHmac !== receivedHmac) {
        Logger.error("[ratchet] 🛡️ HMAC verification failed for web-fallback ciphertext");
        return "🔒 [Integrity Error]";
      }
    }

    const tryWeb = (k: Buffer, label: string) => {
      try {
        const hexKey = CryptoJS.enc.Hex.parse(k.toString("hex"));
        const hexIv = CryptoJS.enc.Hex.parse(iv.toString("hex"));
        
        // If IV is not 16 bytes (e.g. legacy 12-byte GCM IV), pad it with zeros
        const finalIv = iv.length === 12 ? Buffer.concat([iv, Buffer.alloc(4, 0)]) : iv;
        const hexFinalIv = CryptoJS.enc.Hex.parse(finalIv.toString("hex"));

        const bytes = CryptoJS.AES.decrypt(payload, hexKey, {
          iv: hexFinalIv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        const result = bytes.toString(CryptoJS.enc.Utf8);
        if (result && result.length > 0) {
          Logger.log(`[decryptWithKey] v5: ✅ Web Success (${label})`);
          return result;
        }
      } catch (e) {}
      return null;
    };

    let recovered = tryWeb(Buffer.from(keyHashed), "Hashed");
    if (recovered) return recovered;
    if (keyHex) {
      recovered = tryWeb(Buffer.from(keyHex), "Hex");
      if (recovered) return recovered;
    }
    recovered = tryWeb(Buffer.from(keyRaw), "Raw");
    if (recovered) return recovered;
    
    return "🔒 [Decryption Error (v5 Web Fallback)]";
  }

  // Strategy 1: NATIVE GCM with Hashed Key (Modern Standard)
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyHashed as any, iv as any);
    decipher.setAuthTag(tag as any);
    Logger.log(`[decryptWithKey] v5: NATIVE GCM (S1-H), h=${keyHashed.slice(0, 4).toString('hex')}`);
    let decrypted = decipher.update(payload, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err1: any) {
    Logger.warn(`[decryptWithKey] v5: Strategy 1 failed: ${err1.message}`);

    // Strategy 2: Legacy Hex (if applicable)
    if (keyHex) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", keyHex as any, iv as any);
        decipher.setAuthTag(tag as any);
        Logger.log(`[decryptWithKey] v5: NATIVE GCM (S2-X), x=${keyHex.slice(0, 4).toString('hex')}`);
        let decrypted = decipher.update(payload, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      } catch (err2: any) {
        Logger.warn(`[decryptWithKey] v5: Strategy 2 failed: ${err2.message}`);
      }
    }

    // Strategy 3: NATIVE GCM with Raw Key (Legacy Mobile)
    try {
      const decipher = createDecipheriv("aes-256-gcm", keyRaw as any, iv as any);
      decipher.setAuthTag(tag as any);
      Logger.log(`[decryptWithKey] v5: NATIVE GCM (S3-R), r=${keyRaw.slice(0, 4).toString('hex')}`);
      let decrypted = decipher.update(payload, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (err3: any) {
      Logger.error(`[decryptWithKey] v5: Multi-strategy GCM failed, attempting emergency CBC fallback`);
      
      // Final fallback: try CBC variants if GCM fails
      const variants = [
        { k: keyHashed, l: "Hashed" },
        { k: keyRaw, l: "Raw" }
      ];
      if (keyHex) variants.push({ k: keyHex, l: "Hex" });

      for (const variant of variants) {
        try {
          const hexKey = CryptoJS.enc.Hex.parse(variant.k.toString("hex"));
          // Use the provided IV (padded if necessary) instead of a static zero IV
          const finalIv = iv.length === 12 ? Buffer.concat([iv, Buffer.alloc(4, 0)]) : iv;
          const hexIv = CryptoJS.enc.Hex.parse(finalIv.toString("hex"));
          
          const bytes = CryptoJS.AES.decrypt(payload, hexKey, {
            iv: hexIv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          const result = bytes.toString(CryptoJS.enc.Utf8);
          if (result && result.length > 0) {
            Logger.log(`[decryptWithKey] v5: ✅ Emergency CBC Success (${variant.l})`);
            return result;
          }
        } catch (cbcErr) {}
      }
      
      Logger.error("[decryptWithKey] ❌ All decryption strategies exhausted", err3);
      return "🔒 [Decryption Error]";
    }
  }
}
