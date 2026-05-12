/** Purpose: Multi-channel update orchestration (Expo OTA, Firebase Hosting APK, and Firestore feature flags). */
import { isWeb, isAndroid, isIOS, select } from '../utils/platform';
import * as Updates from 'expo-updates';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Logger } from './logger';
import { VersionHelper } from './version-helper';

// Lazy load IntentLauncher to avoid top-level crash if native module is missing
const getIntentLauncher = () => {
    try {
        return require('expo-intent-launcher');
    } catch (e) {
        Logger.warn("[UpdateManager] IntentLauncher not available:", e.message);
        return null;
    }
};

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const KEY_MOBILE_PREF = 'update_pref_mobile'; // 'wifi', 'all', 'cellular'
const KEY_DESKTOP_AUTO = 'update_pref_desktop_auto'; // 'true'/'false'
const KEY_DESKTOP_METERED = 'update_pref_desktop_metered'; // 'true'/'false'
const KEY_AUTO_UPDATE_ENABLED = 'update_pref_auto_master'; // 'true'/'false'
const KEY_LAST_VERSION = 'last_viewed_version';
const KEY_ACK_TIMESTAMP = 'last_update_ack_timestamp';

// Dynamically read version from app.json via expo-constants
const CURRENT_VERSION = Constants.expoConfig?.version || "1.0.0";
const UPDATE_JSON_URL = "https://innerorbit-bc8ce.web.app/update.json";
const APK_STORAGE_PATH = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}update.apk` : null;

export const UpdateManager = {
    getCurrentVersion: () => CURRENT_VERSION,

    getVersionStatus: async () => {
        try {
            const lastVersion = await AsyncStorage.getItem(KEY_LAST_VERSION);
            if (!lastVersion) return 'FIRST_LAUNCH';
            return lastVersion === CURRENT_VERSION ? 'VIEWED' : 'NEW_VERSION';
        } catch { return 'ERROR'; }
    },

    markVersionAsViewed: async () => {
        try {
            await AsyncStorage.setItem(KEY_LAST_VERSION, CURRENT_VERSION);
            // Also mark the current time as acknowledged for push updates
            await AsyncStorage.setItem(KEY_ACK_TIMESTAMP, new Date().toISOString());
            return true;
        } catch (e) {
            Logger.error("[UpdateManager] Failed to mark version as viewed:", e);
            return false;
        }
    },

    // Acknowledge a specific patch/push
    acknowledgeUpdate: async (timestamp) => {
        try {
            await AsyncStorage.setItem(KEY_ACK_TIMESTAMP, timestamp || new Date().toISOString());
            return true;
        } catch (e) {
            return false;
        }
    },

    // === Preferences ===
    getPreferences: async () => {
        try {
            const master = await AsyncStorage.getItem(KEY_AUTO_UPDATE_ENABLED);
            const autoUpdateEnabled = master !== 'false';

            if (isWeb) {
                const auto = await AsyncStorage.getItem(KEY_DESKTOP_AUTO);
                const metered = await AsyncStorage.getItem(KEY_DESKTOP_METERED);
                return {
                    autoUpdateEnabled,
                    desktopAuto: auto !== 'false', // Default ON
                    desktopMetered: metered === 'true' // Default OFF? OR Check Metered toggle
                };
            } else {
                const pref = await AsyncStorage.getItem(KEY_MOBILE_PREF);
                return {
                    autoUpdateEnabled,
                    mobilePref: pref || 'wifi'
                }; // Default wifi only
            }
        } catch { return { autoUpdateEnabled: true }; }
    },

    setPreferences: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, String(value));
        } catch (e) {
            Logger.error("[UpdateManager] Failed to set preference:", e);
        }
    },

    CONSTANTS: {
        KEY_MOBILE_PREF,
        KEY_DESKTOP_AUTO,
        KEY_DESKTOP_METERED,
        KEY_AUTO_UPDATE_ENABLED,
        MOBILE_OPTS: {
            WIFI: 'wifi',
            ALL: 'all',
            CELLULAR: 'cellular'
        }
    },

    // === Core Logic ===
    checkForUpdate: async (isManual = false) => {
        const result = { isAvailable: false, type: 'none' };

        // 0. Offline Guard (Skip network checks if offline)
        try {
            const netState = await Network.getNetworkStateAsync();
            if (!netState.isConnected) {
                if (isManual) Logger.warn("[UpdateManager] Update check skipped: No internet connection.");
                return result;
            }
        } catch (e) {
            // Ignore network state error and proceed anyway
        }

        // Helper for timeouts
        const withTimeout = (promise, timeoutMs, errorMsg) =>
            Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
            ]);

        try {
            // 1. Check Firestore for "Push" Updates (Force or Timestamp)
            // Limit to 5s to avoid long hangs on poor connections
            const versionDoc = await withTimeout(
                getDoc(doc(db, "app", "version")),
                5000,
                "Firestore timeout"
            );

            if (versionDoc.exists()) {
                const remoteData = versionDoc.data();
                const lastAck = await AsyncStorage.getItem(KEY_ACK_TIMESTAMP);

                // Logic A: Explicit Force
                if (remoteData.forceUpdate === true) {
                    return { isAvailable: true, type: 'mandatory', manifest: remoteData };
                }

                // Logic B: Timestamp Comparison (Newer than last seen)
                if (remoteData.lastUpdated && lastAck) {
                    const remoteTime = new Date(remoteData.lastUpdated).getTime();
                    const localTime = new Date(lastAck).getTime();
                    if (remoteTime > localTime) {
                        return { isAvailable: true, type: 'push', manifest: remoteData };
                    }
                }
            }
        } catch (err) {
            // Log as info/debug rather than error for background checks
            if (isManual) Logger.warn("[UpdateManager] Firestore check failed:", err.message);
            else Logger.log("[UpdateManager] Firestore check skipped:", err.message);
        }

        if (isWeb) {
            if (isManual) window.location.reload();
            return result;
        }

        // 2. New APK Update Logic (Firebase Hosting JSON)
        try {
            // Use AbortController for fetch timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const resp = await fetch(`${UPDATE_JSON_URL}?t=${Date.now()}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!resp.ok) {
                Logger.log(`[UpdateManager] APK check skipped: ${resp.status} ${resp.statusText}`);
                return result;
            }

            const apkMeta = await resp.json();
            if (apkMeta.version && VersionHelper.isNewer(apkMeta.version, CURRENT_VERSION)) {
                return {
                    isAvailable: true,
                    type: 'apk',
                    manifest: {
                        ...apkMeta,
                        isApk: true
                    }
                };
            }
        } catch (err) {
            const msg = err.name === 'AbortError' ? 'Fetch timed out' : err.message;
            if (isManual) Logger.warn("[UpdateManager] APK check failed:", msg);
            else Logger.log("[UpdateManager] APK check skipped:", msg);
        }

        // 3. OTA Logic (Only for Mobile)
        try {
            if (!Updates || !Updates.checkForUpdateAsync) return result;
            if (__DEV__ || !Updates.isEnabled) return result;

            // Optional: Also add timeout to OTA check if desired
            const update = await withTimeout(
                Updates.checkForUpdateAsync(),
                8000,
                "OTA timeout"
            );

            if (update && update.isAvailable) {
                return { isAvailable: true, type: 'ota', manifest: update.manifest };
            }
            return result;
        } catch (e) {
            Logger.log("[UpdateManager] OTA check error:", e.message);
            return result;
        }
    },

    // Should we download automatically?
    shouldAutoDownload: async () => {
        const master = await AsyncStorage.getItem(KEY_AUTO_UPDATE_ENABLED);
        if (master === 'false') return false;

        const netState = await Network.getNetworkStateAsync();

        // Desktop/Web Logic
        if (isWeb) {
            const auto = await AsyncStorage.getItem(KEY_DESKTOP_AUTO);
            if (auto === 'false') return false;
            return true;
        }

        // Mobile Logic
        const pref = (await AsyncStorage.getItem(KEY_MOBILE_PREF)) || 'wifi';
        const isWifi = netState.type === Network.NetworkStateType.WIFI;
        const isCellular = netState.type === Network.NetworkStateType.CELLULAR;

        if (pref === 'wifi' && isWifi) return true;
        if (pref === 'all' && (isWifi || isCellular)) return true;
        if (pref === 'cellular' && isCellular) return true;

        return false;
    },

    // Check for updates silently in the background
    performSilentUpdateCheck: async () => {
        try {
            const pref = await UpdateManager.shouldAutoDownload();
            if (!pref) return { status: 'skipped_due_to_preferences' };

            const check = await UpdateManager.checkForUpdate();
            if (!check.isAvailable) return { status: 'no_update' };

            Logger.log(`[UpdateManager] Silent update check found: ${check.type}`);

            if (check.type === 'ota') {
                // Silently fetch OTA update
                await Updates.fetchUpdateAsync();
                Logger.log("[UpdateManager] OTA update fetched silently in background.");
                return { status: 'ota_ready' };
            } else if (check.type === 'apk') {
                // Silently pre-download APK only if it doesn't exist
                const fileInfo = await FileSystem.getInfoAsync(APK_STORAGE_PATH);
                if (!fileInfo.exists) {
                    await UpdateManager.downloadApk(check.manifest.url);
                    Logger.log("[UpdateManager] APK downloaded silently in background.");
                    return { status: 'apk_cached' };
                }
            }
            return { status: 'update_checked' };
        } catch (e) {
            Logger.error("[UpdateManager] Silent update check failed:", e);
            return { status: 'error', error: e.message };
        }
    },

    fetchUpdate: async () => {
        if (isWeb || !Updates.isEnabled) return;
        try {
            await Updates.fetchUpdateAsync();
        } catch (e) {
            Logger.log("[UpdateManager] Fetch Error:", e.message);
            throw e;
        }
    },

    // Unified Download for APK with Progress
    downloadApk: async (url, onProgress) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(APK_STORAGE_PATH);
            if (fileInfo.exists) await FileSystem.deleteAsync(APK_STORAGE_PATH);

            const downloadResumable = FileSystem.createDownloadResumable(
                url,
                APK_STORAGE_PATH,
                {},
                (progress) => {
                    const percent = (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100;
                    if (onProgress) onProgress(Math.floor(percent));
                }
            );

            const { uri } = await downloadResumable.downloadAsync();

            // Verify checksum if provided in manifest
            if (url.includes('update.apk') && uri) {
                // We'll call verify in installApk to keep download simple
            }

            return uri;
        } catch (e) {
            Logger.error("[UpdateManager] APK Download failed:", e);
            throw e;
        }
    },

    verifyApk: async (uri, expectedHash) => {
        if (!expectedHash) return true;
        try {
            const hash = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
            );
            return hash === expectedHash;
        } catch (e) {
            Logger.error("[UpdateManager] APK verification failed:", e);
            return false;
        }
    },

    installApk: async (uri) => {
        if (!isAndroid) return;
        try {
            const launcher = getIntentLauncher();
            if (!launcher) {
                Logger.error("[UpdateManager] IntentLauncher not available. Manual install required.");
                return;
            }
            const contentUri = await FileSystem.getContentUriAsync(uri || APK_STORAGE_PATH);
            await launcher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
                data: contentUri,
                flags: 1,
                type: 'application/vnd.android.package-archive',
            });
        } catch (e) {
            Logger.error("[UpdateManager] APK Install failed:", e);
            throw e;
        }
    },

    reload: async () => {
        if (isWeb) {
            window.location.reload();
            return;
        }
        try {
            await Updates.reloadAsync();
        } catch (e) {
            Logger.log("Reload Error", e);
        }
    }
};
export default UpdateManager;
