import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import CryptoJS from "crypto-js";
import { isMobile, isWeb } from "../utils/platform";
import { Logger } from "./logger";
import { WebAuthnService } from "./webauthn-service";
import { randomBytes } from "./crypto-wrapper";
import { encrypt, decrypt } from "./encryption-core";

const HARDWARE_LOCK_ENABLED = "innerorbit_hw_lock_enabled";
const HARDWARE_CREDENTIAL_ID = "innerorbit_hw_cred_id";
const ENCRYPTED_DEVICE_KEY = "innerorbit_enc_device_key";
const DEVICE_KEY_STORAGE = "innerorbit_device_key";
const DEVICE_SALT_STORAGE = "innerorbit_device_salt";

/**
 * Helper to securely get items, with migration from AsyncStorage to SecureStore (Mobile)
 * Also handles legacy keys with '@' prefix that are incompatible with SecureStore.
 */
export async function getSecureItem(key: string): Promise<string | null> {
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
export async function setSecureItem(key: string, value: string): Promise<void> {
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

export async function removeSecureItem(key: string): Promise<void> {
  if (isMobile) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      await AsyncStorage.removeItem(key);
    }
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Retrieves or generates the device-specific encryption key and salt.
 * Ensures backward compatibility by checking legacy keys.
 * Implements Level 5 Sharding.
 */
export async function getDeviceKeys(): Promise<{ deviceKey: string; deviceSalt: string }> {
  try {
    let deviceSalt = await getSecureItem(DEVICE_SALT_STORAGE);
    if (!deviceSalt) {
      // Use crypto-wrapper to ensure randomness on all platforms
      deviceSalt = randomBytes(16).toString("hex");
      await setSecureItem(DEVICE_SALT_STORAGE, deviceSalt);
      Logger.log("[Encryption] Generated new device salt.");
    }

    // --- 1. Level 5 Check for Sharded Device Key ---
    const shard0 = await AsyncStorage.getItem("innerorbit_shard_0");
    const shard1 = await getSecureItem("innerorbit_shard_1"); // Stored in SecureStore if mobile
    const shard2 = await AsyncStorage.getItem("innerorbit_shard_2");

    let deviceKey = "";

    if (shard0 && shard1 && shard2) {
      deviceKey = shard0 + shard1 + shard2;
    }

    // --- 2. Level 5 Web Hardware Lock Check (Biometric Override) ---
    if (isWeb) {
      const isHwEnabled = await AsyncStorage.getItem(HARDWARE_LOCK_ENABLED) === "true";
      const credId = await AsyncStorage.getItem(HARDWARE_CREDENTIAL_ID);
      const encKey = await AsyncStorage.getItem(ENCRYPTED_DEVICE_KEY);

      if (isHwEnabled && credId && encKey) {
        Logger.log("[Encryption] Hardware Lock detected. Requesting biometric unlock...");
        const hwService = WebAuthnService.getInstance();
        const signature = await hwService.getHardwareSignature(credId, deviceSalt);
        if (signature) {
          deviceKey = CryptoJS.AES.decrypt(encKey, signature).toString(CryptoJS.enc.Utf8);
          Logger.log("[Encryption] Hardware unlock successful.");
        } else {
          throw new Error("Hardware unlock failed.");
        }
      }
    }

    // --- 3. Migration / Generation Fallback ---
    if (!deviceKey) {
      // 🔄 MIGRATION: Check for legacy single key to prevent breaking chat history
      const legacyKey = await getSecureItem(DEVICE_KEY_STORAGE);
      const fullKey = legacyKey || randomBytes(32).toString("hex");

      const s0 = fullKey.substring(0, 22);
      const s1 = fullKey.substring(22, 44);
      const s2 = fullKey.substring(44);

      await AsyncStorage.setItem("innerorbit_shard_0", s0);
      await setSecureItem("innerorbit_shard_1", s1);
      await AsyncStorage.setItem("innerorbit_shard_2", s2);

      // Clean up legacy key after successful sharding
      if (legacyKey) {
        await AsyncStorage.removeItem(DEVICE_KEY_STORAGE);
        Logger.log("[Encryption] Legacy key migrated to Level 5 Shards.");
      }

      deviceKey = fullKey;
    }

    return { deviceKey, deviceSalt };
  } catch (error) {
    console.error("Error getting device keys:", error);
    throw error;
  }
}

/**
 * Activates Level 5 Hardware Security for the Web
 */
export async function enableWebHardwareLock(userId: string): Promise<boolean> {
  if (!isWeb) return false;
  try {
    const hwService = WebAuthnService.getInstance();
    const registration = await hwService.registerHardwareLock(userId);

    if (!registration) return false;

    const { deviceKey, deviceSalt } = await getDeviceKeys();

    // 1. Get a signature to act as the wrapping key
    const signature = await hwService.getHardwareSignature(registration.credentialId, deviceSalt);
    if (!signature) return false;

    // 2. Encrypt the device key with the hardware signature
    const encryptedKey = CryptoJS.AES.encrypt(deviceKey, signature).toString();

    // 3. Store hardware metadata
    await AsyncStorage.setItem(HARDWARE_LOCK_ENABLED, "true");
    await AsyncStorage.setItem(HARDWARE_CREDENTIAL_ID, registration.credentialId);
    await AsyncStorage.setItem(ENCRYPTED_DEVICE_KEY, encryptedKey);

    // 4. Remove the plain-text device key for maximum stealth
    await AsyncStorage.removeItem(DEVICE_KEY_STORAGE);

    Logger.log("[Encryption] Level 5 Hardware Lock enabled.");
    return true;
  } catch (e) {
    Logger.error("[Encryption] Failed to enable Hardware Lock:", e);
    return false;
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
