import { getSecureItem, setSecureItem, encryptWithDeviceKey, decryptWithDeviceKey } from "./device-storage-service";
import { encrypt, decrypt, ENC_VERSION_QUANTUM_CHACHA } from "./encryption-core";
import { Logger } from "./logger";
import CryptoJS from "crypto-js";

/**
 * IdentitySecurityService
 * Handles hardware-backed encryption and v5.5 Post-Quantum cloud sync
 * for sensitive credentials (User ID and Recovery PIN).
 */

const LOCAL_ENC_PIN = "innerorbit_enc_pin";
const LOCAL_ENC_USERID = "innerorbit_enc_userid";
const CLOUD_SYNC_ENABLED = "innerorbit_cloud_sync_identity";

/**
 * 🛠️ DEVELOPMENT TOGGLE
 * Set to 'true' to disable hardware encryption for User ID/PIN during dev.
 */
export const DEV_MODE_PLAIN_IDENTITY = false; 

if (DEV_MODE_PLAIN_IDENTITY) {
  Logger.warn("[Identity] ⚠️ DEV_MODE: Identity saved in PLAIN TEXT.");
}

export const IdentitySecurityService = {
  /**
   * Encrypts and saves identity locally using hardware keys (Secure Enclave/Strongbox).
   * This is used for "Zero-Hurdle" logins on the same device.
   */
  async saveIdentityLocally(userId: string, pin: string): Promise<void> {
    try {
      // 🛠️ DEV BYPASS: Save in plain text if enabled
      if (DEV_MODE_PLAIN_IDENTITY) {
        await setSecureItem(LOCAL_ENC_PIN, pin);
        await setSecureItem(LOCAL_ENC_USERID, userId);
        Logger.warn("[Identity] ⚠️ DEV_MODE: Identity saved in PLAIN TEXT.");
        return;
      }

      const encPin = await encryptWithDeviceKey(pin);
      const encUserId = await encryptWithDeviceKey(userId);
      
      await setSecureItem(LOCAL_ENC_PIN, encPin);
      await setSecureItem(LOCAL_ENC_USERID, encUserId);
      
      Logger.log("[Identity] 🔐 Identity hardware-encrypted and saved locally.");
    } catch (e) {
      Logger.error("[Identity] Failed to save local identity:", e);
      throw e;
    }
  },

  /**
   * Retrieves and decrypts identity from local hardware storage.
   */
  async getLocalIdentity(): Promise<{ userId: string | null; pin: string | null }> {
    try {
      const encPin = await getSecureItem(LOCAL_ENC_PIN);
      const encUserId = await getSecureItem(LOCAL_ENC_USERID);
      
      if (!encPin || !encUserId) return { userId: null, pin: null };
      
      // 🛠️ DEV BYPASS: Return as-is if enabled
      if (DEV_MODE_PLAIN_IDENTITY) {
        return { userId: encUserId, pin: encPin };
      }

      const pin = await decryptWithDeviceKey(encPin);
      const userId = await decryptWithDeviceKey(encUserId);
      
      return { userId, pin };
    } catch (e) {
      Logger.error("[Identity] Hardware decryption failed:", e);
      return { userId: null, pin: null };
    }
  },

  /**
   * Encrypts identity for cloud storage (Firestore) using v5.5 Standard.
   * Standard: ChaCha20-Poly1305 + ML-KEM-768
   */
  encryptForCloud(value: string, userUid: string, pqcPublicKey?: Uint8Array): string {
    try {
      // 🛠️ DEV BYPASS
      if (DEV_MODE_PLAIN_IDENTITY) return value;

      // We use a deterministic key derived from the UID for the sync layer
      const cloudMasterKey = CryptoJS.SHA256(`cloud-vault-${userUid}`).toString();
      return encrypt(value, cloudMasterKey, pqcPublicKey, ENC_VERSION_QUANTUM_CHACHA);
    } catch (e) {
      Logger.error("[Identity] Cloud encryption failure:", e);
      throw e;
    }
  },

  /**
   * Decrypts identity from cloud storage using v5.5 Standard.
   */
  decryptFromCloud(encryptedValue: string, userUid: string, pqcSecretKey?: Uint8Array): string {
    try {
      // 🛠️ DEV BYPASS
      if (DEV_MODE_PLAIN_IDENTITY || !encryptedValue.includes(":")) return encryptedValue;

      const cloudMasterKey = CryptoJS.SHA256(`cloud-vault-${userUid}`).toString();
      return decrypt(encryptedValue, cloudMasterKey, pqcSecretKey);
    } catch (e) {
      Logger.error("[Identity] Cloud decryption failure:", e);
      return "";
    }
  },

  /**
   * PURGE: Immediately wipes decrypted values from the service state.
   * Call this when the Settings tab loses focus.
   */
  clearSensitiveMemory(): void {
    // In React components, this is handled by nulling the local state.
    // This service is stateless to ensure no accidental persistence in RAM.
    Logger.log("[Identity] 🧹 Sensitive memory cleared.");
  },

  async setCloudSync(enabled: boolean): Promise<void> {
    await setSecureItem(CLOUD_SYNC_ENABLED, enabled ? "true" : "false");
  },

  async isCloudSyncEnabled(): Promise<boolean> {
    const val = await getSecureItem(CLOUD_SYNC_ENABLED);
    return val !== "false"; // Default to sync on
  },

  /**
   * Derives a deterministic 256-bit Profile Key from the user's Identity Private Key.
   * Used for v3.5 (SIV) encryption of presence and last-seen data.
   */
  async getOrCreateProfileKey(): Promise<string> {
    try {
      // 1. Get the identity private key (stored securely in ratchet-key-service logic)
      const storedPriv = await getSecureItem("innerorbit_identity_priv");
      if (!storedPriv) {
        Logger.warn("[Identity] No identity key found for profile key derivation.");
        return "";
      }

      // 2. Derive key using SHA-256 with a static salt
      const salt = "InnerOrbit:Presence:v1";
      const profileKey = CryptoJS.HmacSHA256(storedPriv, salt).toString();
      
      return profileKey;
    } catch (e) {
      Logger.error("[Identity] Profile key derivation failed:", e);
      return "";
    }
  }
};
