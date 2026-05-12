import { Buffer } from "buffer";
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv, ml_kem768 } from "./crypto-wrapper";
import { decryptLegacy } from "./legacy-decryption";
import { Logger } from "./logger";

export const GCM_IV_LENGTH = 12;
export const ENC_VERSION_ELITE = "v3";
export const ENC_VERSION_GCM = "v2";
export const ENC_VERSION_SIV = "v3.5";
export const ENC_VERSION_RATCHET = "v4";
export const ENC_VERSION_QUANTUM = "v5";
export const ENC_VERSION_QUANTUM_CHACHA = "v5.5";
export const ENC_VERSION_PQXDH = "v6";
export const ENC_VERSION_VAULT_V1 = "vault_v1";

/**
 * Core Synchronous Encryption (Level 3-6)
 */
export function encrypt(text: string, secretKey: string, pqcPublicKey?: Uint8Array, version: string = ENC_VERSION_SIV): string {
  if (!secretKey) throw new Error("Encryption key is required");

  // Enforce Protocol v3.5 (AES-GCM-SIV) as the mandatory baseline for legacy requests
  if (version === "v1" || version === "v2" || version === "v3") {
    Logger.warn(`[encrypt] Unsupported or legacy version ${version} requested. Defaulting to ${ENC_VERSION_SIV}.`);
    version = ENC_VERSION_SIV;
  }

  const iv = randomBytes(GCM_IV_LENGTH);
  const keyHashed = createHash("sha256").update(secretKey).digest();

  // 1. Quantum Hybrid (v5 / v5.5)
  if (pqcPublicKey && (version === ENC_VERSION_QUANTUM || version === ENC_VERSION_QUANTUM_CHACHA)) {
    try {
      const { cipherText: pqcCt, sharedSecret } = ml_kem768.encapsulate(pqcPublicKey);
      const hybridKey = createHash("sha256").update(Buffer.concat([keyHashed, Buffer.from(sharedSecret)])).digest();
      const cipherAlg = version === ENC_VERSION_QUANTUM_CHACHA ? "chacha20-poly1305" : "aes-256-gcm";

      const cipher = createCipheriv(cipherAlg as any, hybridKey as any, iv as any);
      let encrypted = cipher.update(text, "utf8", "base64");
      encrypted += cipher.final("base64");
      const tag = cipher.getAuthTag().toString("base64");

      return `${version}:${iv.toString("base64")}:${tag}:${Buffer.from(pqcCt).toString("base64")}:${encrypted}`;
    } catch (e) {
      if (version === ENC_VERSION_QUANTUM_CHACHA) {
        Logger.warn("[encrypt] Hybrid v5.5 failed, falling back to v5", e);
        return encrypt(text, secretKey, pqcPublicKey, ENC_VERSION_QUANTUM);
      }
      Logger.error(`[encrypt] Hybrid ${version} failed, falling back to ${ENC_VERSION_SIV}`, e);
      return encrypt(text, secretKey, undefined, ENC_VERSION_SIV);
    }
  }

  // 2. Standard Baseline: AES-GCM-SIV (v3.5)
  try {
    const ivSiv = createHmac('sha256', keyHashed).update(text).digest().slice(0, GCM_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", keyHashed as any, ivSiv as any);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    const tag = cipher.getAuthTag().toString("base64");

    return `${ENC_VERSION_SIV}:${ivSiv.toString("base64")}:${tag}:${encrypted}`;
  } catch (error) {
    Logger.error("[encrypt] Total encryption failure", error);
    throw new Error("CHAT_SERVICE_UNAVAILABLE");
  }
}

/**
 * 🛠️ BINARY-SAFE AES-GCM-SIV (v3.5)
 * Specialized for high-throughput media payloads.
 */
export async function encryptSivBinary(data: Uint8Array, secretKey: Buffer): Promise<{ ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array }> {
  try {
    // Derive deterministic IV from payload (Synthetic IV)
    const iv = createHmac('sha256', secretKey).update(data).digest().slice(0, GCM_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", secretKey as any, iv as any);

    const encrypted = cipher.update(data);
    const final = cipher.final();
    const tag = cipher.getAuthTag();

    const combined = new Uint8Array(encrypted.length + final.length);
    combined.set(encrypted);
    combined.set(final, encrypted.length);

    return { ciphertext: combined, iv, tag };
  } catch (e) {
    Logger.error("[encryptSivBinary] Critical failure", e);
    throw e;
  }
}

/**
 * Core Synchronous Decryption (Level 3-6)
 */
export function decrypt(ciphertext: string, secretKey: string, pqcSecretKey?: Uint8Array, silent: boolean = true): string {
  if (!secretKey) throw new Error("Decryption key is required");
  if (!ciphertext) return "";

  try {
    const parts = ciphertext.split(":");
    const version = parts[0];

    // 1. Quantum Hybrid Decryption (v5 / v5.5)
    if ((version === ENC_VERSION_QUANTUM || version === ENC_VERSION_QUANTUM_CHACHA) && parts.length >= 5) {
      if (!pqcSecretKey) {
        Logger.warn(`[decrypt] ${version} detected but no PQC secret key provided.`);
        return decryptLegacy(ciphertext, secretKey);
      }
      const iv = Buffer.from(parts[1], "base64");
      const tag = Buffer.from(parts[2], "base64");
      const pqcCt = Buffer.from(parts[3], "base64");
      const payload = parts[4];

      const sharedSecret = ml_kem768.decapsulate(pqcCt, pqcSecretKey);
      const keyHashed = createHash("sha256").update(secretKey).digest();
      const hybridKey = createHash("sha256").update(Buffer.concat([keyHashed, Buffer.from(sharedSecret)])).digest();

      const cipherAlg = version === ENC_VERSION_QUANTUM_CHACHA ? "chacha20-poly1305" : "aes-256-gcm";
      const decipher = createDecipheriv(cipherAlg as any, hybridKey as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(payload, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // 2. Standard AES-GCM-SIV (v3.5)
    if (version === ENC_VERSION_SIV && parts.length >= 4) {
      const iv = Buffer.from(parts[1], "base64");
      const tag = Buffer.from(parts[2], "base64");
      const payload = parts[3];
      const keyHashed = createHash("sha256").update(secretKey).digest();

      const decipher = createDecipheriv("aes-256-gcm", keyHashed as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(payload, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // 2b. Elite AES-256-GCM (v3) — dedicated path to avoid falling into legacy shim.
    // v3 uses the same SHA-256 hashed key as v3.5 but with a random IV (not SIV-derived).
    // Without this path, v3 messages fall to decryptLegacy → attemptNativeLegacyDecryption
    // which exhausts 4 strategies and returns "🔒 [Native Legacy Fail]".
    if (version === ENC_VERSION_ELITE && parts.length >= 4) {
      const iv = Buffer.from(parts[1], "base64");
      const tag = Buffer.from(parts[2], "base64");
      const payload = parts[3];
      const keyHashed = createHash("sha256").update(secretKey).digest();

      const decipher = createDecipheriv("aes-256-gcm", keyHashed as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(payload, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // 3. Graceful Legacy Fallback (v1, v2, and any unrecognized formats)
    return decryptLegacy(ciphertext, secretKey);

  } catch (error) {
    if (!silent) {
      Logger.error("[decrypt] Primary decryption failed, trying legacy recovery...", error);
    }
    return decryptLegacy(ciphertext, secretKey);
  }
}

/**
 * 🛠️ BINARY-SAFE AES-GCM-SIV DECRYPTION
 */
export async function decryptSivBinary(ciphertext: Uint8Array, secretKey: Buffer, iv: Uint8Array, tag: Uint8Array): Promise<Uint8Array> {
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey as any, iv as any);
    decipher.setAuthTag(tag as any);

    const decrypted = decipher.update(ciphertext);
    const final = decipher.final();

    const combined = new Uint8Array(decrypted.length + final.length);
    combined.set(decrypted);
    combined.set(final, decrypted.length);

    return combined;
  } catch (e) {
    Logger.error("[decryptSivBinary] Decryption failed", e);
    throw new Error("MEDIA_DECRYPTION_FAILED");
  }
}

/**
 * 📊 Encryption Capability Matrix
 */
export interface EncryptionCapabilities {
  v3_5: boolean; // AES-GCM-SIV (Hardened Baseline)
  v4: boolean;   // Double Ratchet
  v5: boolean;   // Quantum Resistant (ML-KEM + AES-GCM)
  v5_5: boolean; // Quantum Resistant (ML-KEM + ChaCha20)
  v6: boolean;   // PQXDH (Quantum-Hybrid)
  minReadable: number;
  maxWritable: number;
}

/**
 * Default capabilities for new users and fallbacks.
 * Tier 6 represents the current bleeding-edge secure state.
 */
export const DEFAULT_ENCRYPTION_CAPABILITIES: EncryptionCapabilities = {
  v3_5: true,
  v4: true,
  v5: true,
  v5_5: true,
  v6: true, // Enabled: PQXDH transition
  minReadable: 1,
  maxWritable: 6, // v6 is the new standard
};
