/**
 * 🔐 KEY BACKUP SERVICE
 *
 * Cross-platform key backup using only primitives available on both Web & Mobile:
 * - Key Derivation: Manual PBKDF2 via createHmac (exported by both crypto-wrappers)
 * - Encryption: Native AES-GCM on mobile, SubtleCrypto AES-GCM on web
 */

import { Buffer } from "buffer";
import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "./crypto-wrapper";
import { Logger } from "./logger";

const PBKDF2_ITERATIONS = 10_000; // Balanced: fast enough sync, strong enough security
const BACKUP_SALT_PREFIX = "io_kb_v4";

// ─── Key Derivation (Manual PBKDF2-HMAC-SHA256) ────────────────────────────────
// Uses only createHmac which is available in BOTH crypto-wrapper.ts and crypto-wrapper.web.ts

function deriveBackupKey(pin: string, uid: string): Buffer {
  const pinBuf = Buffer.from(pin, "utf8");
  const salt = Buffer.concat([
    Buffer.from(BACKUP_SALT_PREFIX, "utf8"),
    Buffer.from(":", "utf8"),
    Buffer.from(uid, "utf8"),
    Buffer.from([0, 0, 0, 1]), // PBKDF2 block index = 1
  ]);

  // U1 = HMAC(pin, salt)
  let U = Buffer.from((createHmac("sha256", pinBuf as any) as any).update(salt as any).digest());
  let T = Buffer.from(U);

  // Iterate: Ui = HMAC(pin, U_{i-1}), T ^= Ui
  for (let i = 1; i < PBKDF2_ITERATIONS; i++) {
    U = Buffer.from((createHmac("sha256", pinBuf as any) as any).update(U as any).digest());
    for (let j = 0; j < 32; j++) T[j] ^= U[j];
  }

  return T.slice(0, 32);
}

// ─── Encrypt ───────────────────────────────────────────────────────────────────

async function aesEncrypt(data: Uint8Array, key: Buffer): Promise<string> {
  const iv = randomBytes(12);

  // Try native GCM (mobile)
  try {
    const cipher = createCipheriv("aes-256-gcm", key as any, iv as any);
    const ciphertext = Buffer.concat([(cipher as any).update(data), (cipher as any).final()] as any[]);
    const tag = (cipher as any).getAuthTag();
    const combined = Buffer.concat([iv as any, tag as any, ciphertext as any]);
    return combined.toString("base64");
  } catch (e: any) {
    if (!e?.message?.includes("GCM_NOT_SUPPORTED_ON_WEB")) throw e;
  }

  // Web fallback: SubtleCrypto AES-GCM
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw", new Uint8Array(key), { name: "AES-GCM" }, false, ["encrypt"]
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv), tagLength: 128 },
    cryptoKey, new Uint8Array(data).buffer.slice(0) as ArrayBuffer
  );
  const result = new Uint8Array(encrypted);
  // SubtleCrypto appends the 16-byte auth tag at the end
  // Store as: IV(12) + TAG(16) + CIPHERTEXT to match mobile format
  const ctBytes = result.slice(0, -16);
  const tagBytes = result.slice(-16);
  const combined = Buffer.concat([
    Buffer.from(iv), Buffer.from(tagBytes), Buffer.from(ctBytes)
  ]);
  return combined.toString("base64");
}

// ─── Decrypt ───────────────────────────────────────────────────────────────────

async function aesDecrypt(b64: string, key: Buffer): Promise<Buffer | null> {
  try {
    const combined = Buffer.from(b64, "base64");
    if (combined.length < 28) return null;

    const iv = combined.slice(0, 12);
    const tag = combined.slice(12, 28);
    const ciphertext = combined.slice(28);

    // Try native GCM (mobile)
    try {
      const decipher = createDecipheriv("aes-256-gcm", key as any, iv as any);
      (decipher as any).setAuthTag(tag);
      const plain = Buffer.concat([(decipher as any).update(ciphertext), (decipher as any).final()] as any[]);
      return plain;
    } catch (e: any) {
      if (!e?.message?.includes("GCM_NOT_SUPPORTED_ON_WEB")) throw e;
    }

    // Web fallback: SubtleCrypto AES-GCM (expects ciphertext + tag concatenated)
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw", new Uint8Array(key), { name: "AES-GCM" }, false, ["decrypt"]
    );
    const ctWithTag = Buffer.concat([ciphertext, tag]);
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv), tagLength: 128 },
      cryptoKey, new Uint8Array(ctWithTag)
    );
    return Buffer.from(decrypted);
  } catch (e) {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function backupRatchetSession(
  uid: string,
  convId: string,
  sharedSecret: Buffer,
  isAlice: boolean,
  pin: string
): Promise<void> {
  try {
    const key = deriveBackupKey(pin, uid);
    const payload = Buffer.alloc(33);
    sharedSecret.copy(payload, 0);
    payload[32] = isAlice ? 1 : 0;

    const encryptedB64 = await aesEncrypt(new Uint8Array(payload), key);
    const { saveKeyBackup } = await import("./firestore-service") as any;
    await saveKeyBackup(uid, convId, encryptedB64);
    Logger.log(`[KeyBackup] ✅ Ratchet backup saved for conv=${convId.substring(0, 8)}`);
  } catch (e: any) {
    Logger.warn(`[KeyBackup] ⚠️ Failed to save backup: ${e?.message}`);
  }
}

export async function restoreRatchetSession(
  uid: string,
  convId: string,
  partnerUid: string,
  pin: string
): Promise<boolean> {
  try {
    const { fetchKeyBackup } = await import("./firestore-service") as any;
    const encryptedB64: string | null = await fetchKeyBackup(uid, convId);
    if (!encryptedB64) return false;

    const key = deriveBackupKey(pin, uid);
    const payload = await aesDecrypt(encryptedB64, key);
    if (!payload) return false;

    const sharedSecret = payload.slice(0, 32);
    const isAlice = payload[32] === 1;

    const { initializeRatchet } = await import("./ratchet") as any;
    const { saveRatchetSession } = await import("./encryption") as any;
    const { getOrCreateMyDhKeyPair } = await import("./ratchet-key-service") as any;
    const { fetchDhPublicKey } = await import("./firestore-service") as any;

    const partnerPubB64: string | null = await fetchDhPublicKey(partnerUid);
    if (!partnerPubB64) return false;

    const partnerPub = Buffer.from(partnerPubB64, "base64");
    const rawPartnerPub = partnerPub.length > 32 ? partnerPub.slice(-32) : partnerPub;
    const { publicKey: myDhPub, privateKey: myDhPriv } = await getOrCreateMyDhKeyPair();
    const rawMyPub = myDhPub.length > 32 ? myDhPub.slice(-32) : myDhPub;
    const rawMyPriv = myDhPriv.length > 32 ? myDhPriv.slice(-32) : myDhPriv;

    const state = await initializeRatchet(isAlice, sharedSecret, rawPartnerPub, {
      publicKey: rawMyPub, privateKey: rawMyPriv
    });
    await saveRatchetSession(convId, state);
    return true;
  } catch (e: any) {
    Logger.error(`[KeyBackup] ❌ Restore failed: ${e?.message}`);
    return false;
  }
}

export async function hasKeyBackup(uid: string, convId: string): Promise<boolean> {
  try {
    const { fetchKeyBackup } = await import("./firestore-service") as any;
    const val = await fetchKeyBackup(uid, convId);
    return val !== null;
  } catch {
    return false;
  }
}

export async function backupAccountIdentity(
  uid: string,
  pin: string,
  keys: {
    dh: { pub: string; priv: string };
    pqc: { pub: string; priv: string };
    identity: { pub: string; priv: string };
  }
): Promise<void> {
  try {
    const key = deriveBackupKey(pin, uid);
    const payload = Buffer.from(JSON.stringify(keys), "utf8");
    const encryptedB64 = await aesEncrypt(new Uint8Array(payload), key);

    const mod = await import("./firestore-service") as any;
    const svc = mod.default || mod;
    await svc.saveAccountKeyBackup(uid, { encryptedKeys: encryptedB64 });
    Logger.log("[KeyBackup] ✅ Account identity backup saved to Firestore");
  } catch (e: any) {
    Logger.warn(`[KeyBackup] ⚠️ Failed to backup identity: ${e?.message}`);
  }
}

export async function restoreAccountIdentity(uid: string, pin: string): Promise<boolean> {
  try {
    const mod = await import("./firestore-service") as any;
    const svc = mod.default || mod;
    const backupData = await svc.fetchAccountKeyBackup(uid);

    if (!backupData?.encryptedKeys) return false;

    const key = deriveBackupKey(pin, uid);
    const payload = await aesDecrypt(backupData.encryptedKeys, key);
    if (!payload) return false;

    const keys = JSON.parse(payload.toString("utf8"));

    const {
      DH_PUBLIC_KEY_STORAGE, DH_PRIVATE_KEY_STORAGE,
      PQC_PUBLIC_KEY_STORAGE, PQC_PRIVATE_KEY_STORAGE,
      IDENTITY_PUBLIC_KEY_STORAGE, IDENTITY_PRIVATE_KEY_STORAGE
    } = await import("./ratchet-key-service") as any;

    const storageMod = await import("./device-storage-service") as any;
    const { setSecureItem } = storageMod;

    await Promise.all([
      setSecureItem(DH_PUBLIC_KEY_STORAGE, keys.dh.pub),
      setSecureItem(DH_PRIVATE_KEY_STORAGE, keys.dh.priv),
      setSecureItem(PQC_PUBLIC_KEY_STORAGE, keys.pqc.pub),
      setSecureItem(PQC_PRIVATE_KEY_STORAGE, keys.pqc.priv),
      setSecureItem(IDENTITY_PUBLIC_KEY_STORAGE, keys.identity.pub),
      setSecureItem(IDENTITY_PRIVATE_KEY_STORAGE, keys.identity.priv),
    ]);

    Logger.log("[KeyBackup] ✅ Account identity RESTORED to local storage");
    return true;
  } catch (e: any) {
    Logger.error(`[KeyBackup] ❌ Identity restore failed: ${e?.message}`);
    return false;
  }
}
