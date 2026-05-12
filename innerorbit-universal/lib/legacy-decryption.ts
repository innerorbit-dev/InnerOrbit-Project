import CryptoJS from "crypto-js";
import { Buffer } from "buffer";
import { createHash, createDecipheriv } from "./crypto-wrapper";
import { Logger } from "./logger";
import { isMobile, isWeb } from "../utils/platform";

/**
 * 📦 LEGACY DECRYPTION SHIM
 * 
 * PURPOSE:
 * This module contains the archived decryption logic for Protocol versions v1, v2, v3, and v3.5.
 * It is maintained only for reading historical messages and should NEVER be used for new messages.
 */

export function decryptLegacy(ciphertext: string, secretKey: string): string {
  try {
    const parts = ciphertext.split(":");
    const version = parts[0];

    // --- STRATEGY: Web Fallback Detection ---
    if (parts[1] === 'web') {
      return attemptWebLegacyDecryption(parts, secretKey, version);
    }

    // --- STRATEGY: Quantum Hybrid CTR Recovery (v5 / v5.5 — 5 parts) ---
    // Web's old sync path encrypts v5/v5.5 with CryptoJS AES-CTR + zero auth tag.
    // Mobile native GCM rejects them. We re-derive the hybrid key and try CTR.
    if ((version === 'v5' || version === 'v5.5') && parts.length >= 5) {
      return attemptQuantumLegacyDecryption(parts, secretKey, version);
    }

    // --- STRATEGY: Native GCM Recovery (v2, v3, v3.5) ---
    if (parts.length >= 4) {
      return attemptNativeLegacyDecryption(parts, secretKey, version);
    }

    // --- STRATEGY: Absolute Legacy (v1 - CryptoJS CBC) ---
    return attemptAbsoluteLegacyDecryption(ciphertext, secretKey);

  } catch (error) {
    Logger.error("[legacy-decryption] Critical failure in legacy path:", error);
    return "🔒 [Legacy Decryption Error]";
  }
}


/**
 * Attempt to decrypt legacy web-formatted messages
 */
function attemptWebLegacyDecryption(parts: string[], secretKey: string, version: string): string {
  try {
    const ivBase64 = parts.length === 4 ? parts[2] : null;
    const encryptedData = parts.length === 4 ? parts[3] : parts[2];

    // 1. Check for legacy Salted format (CryptoJS default)
    if (encryptedData.startsWith("U2FsdGVkX1")) {
      try {
        const saltedRes = CryptoJS.AES.decrypt(encryptedData, secretKey).toString(CryptoJS.enc.Utf8);
        if (saltedRes) return saltedRes;
      } catch (e) { }
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
            Logger.log(`[legacy-decryption] ✅ Web ${v.name} (${label}) succeeded`);
            return res;
          }
        } catch (e) { }
      }
    }
    return "🔒 [Web Legacy Fail]";
  } catch (e) {
    return "🔒 [Web Legacy Fail]";
  }
}

/**
 * Attempt to recover v5/v5.5 ciphertexts produced by the old Web CTR sync path.
 * Format: v5:iv_b64:tag_b64:pqcCt_b64:payload_b64
 * The "tag" is 16 zero bytes (dummy). Mobile GCM fails; we fall back to CTR.
 */
function attemptQuantumLegacyDecryption(parts: string[], secretKey: string, version: string): string {
  try {
    const iv = Buffer.from(parts[1], "base64");
    // parts[2] = dummy zero tag (ignored in CTR recovery)
    const pqcCt = Buffer.from(parts[3], "base64");
    const dataBase64 = parts[4];

    // We can't call ml_kem768.decapsulate without the private key here (legacy shim is key-agnostic).
    // Fall back to non-PQC hybrid key: SHA-256(hashedSecretKey) — matches the CTR path
    // used by the old Web encrypt() which did not correctly mix the PQC shared secret.
    const keyHashed = createHash('sha256').update(secretKey).digest();

    const suffixes = ["00000002", "00000001", "00000000"];
    const keysToTry = [keyHashed, Buffer.from(secretKey, 'utf8')];

    for (const key of keysToTry) {
      for (const suffix of suffixes) {
        try {
          const hexKey = CryptoJS.enc.Hex.parse(Buffer.from(key).toString("hex"));
          const paddedIv = iv.length === 12 ? Buffer.from(iv.toString("hex") + suffix, "hex") : iv;
          const hexIv = CryptoJS.enc.Hex.parse(paddedIv.toString("hex"));
          const bytes = CryptoJS.AES.decrypt(dataBase64, hexKey, {
            iv: hexIv, mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.NoPadding
          });
          let res = bytes.toString(CryptoJS.enc.Utf8);
          if (res) res = res.replace(/\0/g, '').trim();
          if (res && res.length > 0 && !/[\x01-\x08\x0E-\x1F]/.test(res)) {
            Logger.log(`[legacy-decryption] ✅ Quantum CTR Recovery (${version}, suffix=${suffix})`);
            return res;
          }
        } catch (e) { }
      }
    }

    Logger.warn(`[legacy-decryption] Quantum CTR recovery exhausted for ${version}`);
    return "🔒 [Quantum Legacy Fail]";
  } catch (e) {
    return "🔒 [Quantum Legacy Fail]";
  }
}

/**
 * Attempt to decrypt legacy native GCM messages (Strategies 1-4)
 */
function attemptNativeLegacyDecryption(parts: string[], secretKey: string, version: string): string {
  const ivBase64 = parts[1];
  const tagBase64 = parts[2];
  const dataBase64 = parts[3];

  const keyHashed = createHash('sha256').update(secretKey).digest();
  const keyHex = secretKey.length === 64 ? Buffer.from(secretKey, 'hex') : null;
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");

  // Strategy 1: Hashed Key (Native GCM)
  if (isMobile) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", keyHashed as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(dataBase64, "base64", "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted.replace(/\0/g, '').trim();
    } catch (e: any) {
      Logger.warn(`[legacy-decryption] ⚠️ Strategy1 GCM failed | version=${version} | ivLen=${iv.length} | tagLen=${tag.length} | reason=${e?.message ?? e}`);
    }
  }

  // Strategy 1b: Double-hashed key (covers case where web hashed an already-hashed key)
  if (isMobile) {
    try {
      const doubleHashed = createHash('sha256').update(keyHashed).digest();
      const decipher = createDecipheriv("aes-256-gcm", doubleHashed as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(dataBase64, "base64", "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) {
        Logger.log(`[legacy-decryption] ✅ Strategy1b double-hash GCM succeeded`);
        return decrypted.replace(/\0/g, '').trim();
      }
    } catch (e) { }
  }

  // Strategy 2: Legacy Hex (Native GCM)
  if (keyHex && isMobile) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", keyHex as any, iv as any);
      decipher.setAuthTag(tag as any);
      let decrypted = decipher.update(dataBase64, "base64", "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted.replace(/\0/g, '').trim();
    } catch (e) { }
  }

  // Strategy 3: CTR Mode Recovery
  const tryCTR = (keyBuf: any) => {
    const suffixes = ["00000002", "00000001", "00000000"];
    for (const suffix of suffixes) {
      try {
        const hexKey = CryptoJS.enc.Hex.parse(Buffer.from(keyBuf).toString("hex"));
        const hexIv = CryptoJS.enc.Hex.parse(Buffer.from(iv).toString("hex") + suffix);
        const bytes = CryptoJS.AES.decrypt(dataBase64, hexKey, { iv: hexIv, mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.NoPadding });
        let res = bytes.toString(CryptoJS.enc.Utf8);
        if (res) res = res.replace(/\0/g, '').trim();
        if (res && res.length > 0 && !/[\x01-\x08\x0E-\x1F]/.test(res)) return res;
      } catch (e) { }
    }
    return null;
  };

  let res = tryCTR(keyHashed);
  if (res) return res;
  if (keyHex) {
    res = tryCTR(keyHex);
    if (res) return res;
  }

  // Strategy 4: Raw UTF-8 Key fallback (some very early sync web shims used raw keys)
  res = tryCTR(Buffer.from(secretKey, 'utf8'));
  if (res) return res;

  return "🔒 [Native Legacy Fail]";
}

/**
 * Absolute last resort (v1 - CryptoJS CBC)
 */
function attemptAbsoluteLegacyDecryption(ciphertext: string, secretKey: string): string {
  const tryCBC = (key: any) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, key);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (plaintext && plaintext.length > 0) return plaintext;
    } catch (e) { }
    return null;
  };

  const keyHashed = createHash('sha256').update(secretKey).digest().toString('hex');
  let res = tryCBC(CryptoJS.enc.Hex.parse(keyHashed));
  if (res) return res;

  if (secretKey.length === 64) {
    res = tryCBC(CryptoJS.enc.Hex.parse(secretKey));
    if (res) return res;
  }

  res = tryCBC(secretKey);
  if (res) return res;

  return "🔒 [Absolute Legacy Fail]";
}
