/** Purpose: Privacy-first secure storage for credentials (Keychain/Keystore on mobile, Encrypted AsyncStorage on web). */
import { isWeb, isMobile } from '../utils/platform';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Logger } from './logger';
import { encryptWithDeviceKey, decryptWithDeviceKey } from './encryption';

/**
 * Privacy-First Secure Storage Service
 * 
 * Handles credential storage with strict respect for user consent.
 * - Mobile (iOS/Android): Uses Keychain/Keystore via expo-secure-store
 * - Web: Uses secure cookies or session storage (no persistent storage without consent)
 * - Desktop: Uses OS-level secure storage
 */

const STORAGE_KEYS = {
    // User preference (non-sensitive, always stored)
    PERSISTENCE_ENABLED: 'loginPersistenceEnabled',
    PERSISTENCE_DECLINED_COUNT: 'loginPersistenceDeclinedCount',
    PERSISTENCE_LAST_ASKED: 'loginPersistenceLastAsked',
    MANUAL_LOGIN_COUNT: 'manualLoginCount',

    // Sensitive credentials (only stored if user consents)
    SAVED_EMAIL: 'secure_savedEmail',
    SAVED_PASSWORD: 'secure_savedPassword',
    USER_ID: 'secure_userId',
};

export interface UserCredentials {
    email: string | null;
    password: string | null;
    userId: string | null;
}

class SecureStorageServiceClass {

    private _persistenceEnabled: boolean | null = null;

    constructor() {
    }

    /**
     * Initializes the service by pre-loading critical non-sensitive configuration.
     * Use this to avoid asynchronous flickers on initial mount.
     */
    async init(): Promise<void> {
        try {
            const enabled = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENCE_ENABLED);
            this._persistenceEnabled = enabled === 'true';
            Logger.log(`[SecureStorage] Initialized persistence cache: ${this._persistenceEnabled}`);
        } catch (e) {
            Logger.error('Error initializing SecureStorage cache:', e);
            this._persistenceEnabled = false;
        }
    }

    /**
     * Check if user has consented to login persistence
     */
    async isPersistenceEnabled(): Promise<boolean> {
        if (this._persistenceEnabled !== null) return this._persistenceEnabled;
        try {
            const enabled = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENCE_ENABLED);
            this._persistenceEnabled = enabled === 'true';
            return this._persistenceEnabled;
        } catch (e) {
            Logger.error('Error checking persistence status:', e);
            return false;
        }
    }

    /**
     * Synchronous getter for persistence state. 
     * Requires init() or a previous async call to have completed.
     */
    isPersistenceEnabledSync(): boolean {
        return !!this._persistenceEnabled;
    }

    /**
     * Set user's login persistence preference
     */
    async setPersistenceEnabled(enabled: boolean): Promise<void> {
        try {
            this._persistenceEnabled = enabled;
            await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENCE_ENABLED, String(enabled));

            if (!enabled) {
                // User declined - clear all sensitive data immediately
                await this.clearAllCredentials();
            }
        } catch (e) {
            Logger.error('Error setting persistence preference:', e);
        }
    }

    /**
     * Track how many times user has declined the persistence prompt
     */
    async incrementDeclineCount(): Promise<void> {
        try {
            const count = await this.getDeclineCount();
            await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENCE_DECLINED_COUNT, String(count + 1));
            await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENCE_LAST_ASKED, String(Date.now()));
        } catch (e) {
            Logger.error('Error incrementing decline count:', e);
        }
    }

    async getDeclineCount(): Promise<number> {
        try {
            const count = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENCE_DECLINED_COUNT);
            return count ? parseInt(count, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Check if we should show the persistence prompt
     * Only show if:
     * 1. User hasn't explicitly declined multiple times (3+)
     * 2. User has completed 3-5 manual logins
     * 3. Hasn't been asked in the last 7 days
     */
    async shouldShowPersistencePrompt(): Promise<boolean> {
        try {
            const enabled = await this.isPersistenceEnabled();
            if (enabled !== null && (enabled as any) !== undefined) {
                // User has already made a choice
                // Wait, if enabled is false, we already have a choice.
                // But if it's explicitly null, it hasn't been set.
                // Re-checking...
                const raw = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENCE_ENABLED);
                if (raw !== null) return false;
            }

            const declineCount = await this.getDeclineCount();
            if (declineCount >= 3) {
                // User has declined 3+ times, respect their decision permanently
                return false;
            }

            const manualLoginCount = await this.getManualLoginCount();
            if (manualLoginCount < 3) {
                // Not enough manual logins yet
                return false;
            }

            const lastAsked = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENCE_LAST_ASKED);
            if (lastAsked) {
                const daysSinceAsked = (Date.now() - parseInt(lastAsked, 10)) / (1000 * 60 * 60 * 24);
                if (daysSinceAsked < 7) {
                    // Asked too recently
                    return false;
                }
            }

            return true;
        } catch (e) {
            Logger.error('Error checking if should show prompt:', e);
            return false;
        }
    }

    /**
     * Track manual login attempts
     */
    async incrementManualLoginCount(): Promise<void> {
        try {
            const count = await this.getManualLoginCount();
            await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_LOGIN_COUNT, String(count + 1));
        } catch (e) {
            Logger.error('Error incrementing manual login count:', e);
        }
    }

    async getManualLoginCount(): Promise<number> {
        try {
            const count = await AsyncStorage.getItem(STORAGE_KEYS.MANUAL_LOGIN_COUNT);
            return count ? parseInt(count, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Securely store credentials (only if user has consented)
     */
    async saveCredentials(email: string | null, password: string | null, userId: string | null): Promise<void> {
        const enabled = await this.isPersistenceEnabled();
        if (!enabled) {
            Logger.log('[SecureStorage] Persistence disabled, not saving credentials');
            return;
        }

        try {
            if (isMobile) {
                // Use Keychain/Keystore on mobile
                if (email) await SecureStore.setItemAsync(STORAGE_KEYS.SAVED_EMAIL, email);
                if (password) await SecureStore.setItemAsync(STORAGE_KEYS.SAVED_PASSWORD, password);
                if (userId) await SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId);
            } else {
                // Check if we are in Electron and have safeStorage
                const electron = (globalThis as any).window?.electron;
                if (electron && electron.safeStorage) {
                    // Level 5 Hardware Hardening for Desktop (TPM/DPAPI)
                    if (email) {
                        const res = await electron.safeStorage.encrypt(email);
                        if (res.success) await AsyncStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, res.encrypted);
                    }
                    if (password) {
                        const res = await electron.safeStorage.encrypt(password);
                        if (res.success) await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PASSWORD, res.encrypted);
                    }
                    if (userId) {
                        const res = await electron.safeStorage.encrypt(userId);
                        if (res.success) await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, res.encrypted);
                    }
                } else {
                    // Standard Web: Use AsyncStorage with software encryption
                    if (email) {
                        const encryptedEmail = await encryptWithDeviceKey(email);
                        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, encryptedEmail);
                    }
                    if (password) {
                        const encryptedPassword = await encryptWithDeviceKey(password);
                        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PASSWORD, encryptedPassword);
                    }
                    if (userId) {
                        const encryptedUserId = await encryptWithDeviceKey(userId);
                        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, encryptedUserId);
                    }
                }
            }
            Logger.log('[SecureStorage] Credentials saved securely');
        } catch (e) {
            Logger.error('Error saving credentials:', e);
        }
    }

    /**
     * Retrieve stored credentials (only if persistence is enabled)
     */
    async getCredentials(): Promise<UserCredentials> {
        const enabled = await this.isPersistenceEnabled();
        if (!enabled) {
            return { email: null, password: null, userId: null };
        }

        try {
            let email: string | null = null;
            let password: string | null = null;
            let userId: string | null = null;

            if (isMobile) {
                email = await SecureStore.getItemAsync(STORAGE_KEYS.SAVED_EMAIL);
                password = await SecureStore.getItemAsync(STORAGE_KEYS.SAVED_PASSWORD);
                userId = await SecureStore.getItemAsync(STORAGE_KEYS.USER_ID);
            } else {
                const encryptedEmail = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_EMAIL);
                const encryptedPassword = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PASSWORD);
                const encryptedUserId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);

                // Check for Electron Hardware Decryption
                const electron = (globalThis as any).window?.electron;
                if (electron && electron.safeStorage) {
                    if (encryptedEmail) {
                        const res = await electron.safeStorage.decrypt(encryptedEmail);
                        email = res.success ? res.decrypted : null;
                    }
                    if (encryptedPassword) {
                        const res = await electron.safeStorage.decrypt(encryptedPassword);
                        password = res.success ? res.decrypted : null;
                    }
                    if (encryptedUserId) {
                        const res = await electron.safeStorage.decrypt(encryptedUserId);
                        userId = res.success ? res.decrypted : null;
                    }
                } else {
                    // Standard Web Software Decryption
                    email = encryptedEmail ? await decryptWithDeviceKey(encryptedEmail) : null;
                    password = encryptedPassword ? await decryptWithDeviceKey(encryptedPassword) : null;
                    userId = encryptedUserId ? await decryptWithDeviceKey(encryptedUserId) : null;
                }
            }

            return { email, password, userId };
        } catch (e) {
            Logger.error('Error retrieving credentials:', e);
            return { email: null, password: null, userId: null };
        }
    }

    /**
     * Clear all stored credentials
     */
    async clearAllCredentials(): Promise<void> {
        try {
            if (isMobile) {
                await SecureStore.deleteItemAsync(STORAGE_KEYS.SAVED_EMAIL).catch(() => { });
                await SecureStore.deleteItemAsync(STORAGE_KEYS.SAVED_PASSWORD).catch(() => { });
                await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID).catch(() => { });
            } else {
                await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
                await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PASSWORD);
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_ID);
            }

            // Also clear legacy keys for migration
            await AsyncStorage.removeItem('savedEmail');
            await AsyncStorage.removeItem('savedPassword');
            await AsyncStorage.removeItem('userId');

            Logger.log('[SecureStorage] All credentials cleared');
        } catch (e) {
            Logger.error('Error clearing credentials:', e);
        }
    }

    /**
     * Reset all persistence tracking (for testing or user request)
     */
    async resetPersistenceTracking(): Promise<void> {
        try {
            this._persistenceEnabled = false;
            await AsyncStorage.removeItem(STORAGE_KEYS.PERSISTENCE_ENABLED);
            await AsyncStorage.removeItem(STORAGE_KEYS.PERSISTENCE_DECLINED_COUNT);
            await AsyncStorage.removeItem(STORAGE_KEYS.PERSISTENCE_LAST_ASKED);
            await AsyncStorage.removeItem(STORAGE_KEYS.MANUAL_LOGIN_COUNT);
            await this.clearAllCredentials();
        } catch (e) {
            Logger.error('Error resetting persistence tracking:', e);
        }
    }
}

export const SecureStorageService = new SecureStorageServiceClass();
export default SecureStorageService;
