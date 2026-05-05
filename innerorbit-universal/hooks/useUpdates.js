/**
 * Purpose: Orchestrates the application's update lifecycle. Interfaces with UpdateManager
 * to handle version checking, APK downloads, and OTA reloads.
 */
import { useState, useEffect, useRef } from 'react';
import { UpdateManager } from '../lib/update-manager';
import { Logger } from '../lib/logger';

export function useUpdates(autoShow = true) {
  const [showUpdateWalkthrough, setShowUpdateWalkthrough] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState('idle'); // idle, checking, available, none, error
  const [updateManifest, setUpdateManifest] = useState(null);
  const [updatePrefs, setUpdatePrefs] = useState({});
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

  const handleCheckForUpdate = async (isManual = false, callback) => {
    try {
      setUpdateCheckStatus('checking');
      const res = await UpdateManager.checkForUpdate(isManual);
      setUpdateCheckStatus(res.isAvailable ? 'available' : 'none');
      setUpdateManifest(res.manifest || null);
      if (callback) {
        // If it's a generic success callback, pass a friendly message
        if (typeof callback === 'function') {
          callback(res.isAvailable ? 'New update available!' : 'App is up to date');
        }
      }
    } catch (e) {
      Logger.error("[useUpdates] Check error:", e);
      setUpdateCheckStatus('error');
      if (callback) callback('Failed to check for updates');
    }
  };

  useEffect(() => {
    const checkUpdateIntro = async () => {
      const status = await UpdateManager.getVersionStatus();
      Logger.log(`[Updates] Version Status: ${status}`);

      if (status === 'FIRST_LAUNCH') {
        await UpdateManager.markVersionAsViewed();
      } else if (status === 'NEW_VERSION' && autoShow) {
        setShowUpdateWalkthrough(true);
      }
    };
    checkUpdateIntro();

    // Check for push updates on mount
    handleCheckForUpdate();

    // Load Prefs
    UpdateManager.getPreferences()
      .then(setUpdatePrefs)
      .catch(e => Logger.error("[useUpdates] Failed to load preferences:", e));
  }, []);

  const [downloadProgress, setDownloadProgress] = useState(0);
  const downloadIntervalRef = useRef(null);
  const reloadTimeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (downloadIntervalRef.current) clearInterval(downloadIntervalRef.current);
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    };
  }, []);

  const handleUpdatePrefChange = async (key, value) => {
    let storeKey = key;
    if (key === 'autoUpdateEnabled') storeKey = UpdateManager.CONSTANTS.KEY_AUTO_UPDATE_ENABLED;
    if (key === 'mobilePref') storeKey = UpdateManager.CONSTANTS.KEY_MOBILE_PREF;
    if (key === 'desktopAuto') storeKey = UpdateManager.CONSTANTS.KEY_DESKTOP_AUTO;

    setUpdatePrefs(prev => ({ ...prev, [key]: value }));
    await UpdateManager.setPreferences(storeKey, value);
  };

  const handleAcknowledge = async () => {
    if (updateManifest?.lastUpdated) {
      await UpdateManager.acknowledgeUpdate(updateManifest.lastUpdated);
    } else {
      await UpdateManager.acknowledgeUpdate();
    }
    setUpdateCheckStatus('none');
  };

  const handleDownloadUpdate = async () => {
    setUpdateCheckStatus('downloading');
    setDownloadProgress(0);

    try {
      if (updateManifest?.isApk) {
        // Actual APK Download Progress
        const uri = await UpdateManager.downloadApk(updateManifest.apkUrl, setDownloadProgress);
        setUpdateManifest(prev => ({ ...prev, localUri: uri }));
        setDownloadProgress(100);

        // Brief pause for UX before "Ready"
        await new Promise(resolve => setTimeout(resolve, 500));
        setUpdateCheckStatus('ready');
      } else {
        // Simulated Progress for OTA (Expo doesn't give fine-grained progress easily)
        if (downloadIntervalRef.current) clearInterval(downloadIntervalRef.current);
        downloadIntervalRef.current = setInterval(() => {
          setDownloadProgress(prev => {
            if (prev >= 95) return 95;
            return Math.min(prev + Math.random() * 10, 95);
          });
        }, 300);

        await UpdateManager.fetchUpdate();
        setDownloadProgress(100);
        if (downloadIntervalRef.current) clearInterval(downloadIntervalRef.current);

        reloadTimeoutRef.current = setTimeout(async () => {
          await UpdateManager.reload();
        }, 800);
      }
    } catch (e) {
      Logger.error("[useUpdates] Download failed:", e);
      if (downloadIntervalRef.current) clearInterval(downloadIntervalRef.current);
      // Fallback or error state
      setUpdateCheckStatus('none');
    }
  };

  const handleInstallUpdate = async () => {
    if (updateManifest?.isApk && updateManifest?.localUri) {
      try {
        setUpdateCheckStatus('installing');
        await UpdateManager.installApk(updateManifest.localUri);
      } catch (e) {
        setUpdateCheckStatus('ready');
        Logger.error("[useUpdates] Install error:", e);
      }
    } else {
      // OTA Reload
      await UpdateManager.reload();
    }
  };

  const handleCloseWalkthrough = async () => {
    setShowUpdateWalkthrough(false);
    await UpdateManager.markVersionAsViewed();
  };

  return {
    showUpdateWalkthrough, setShowUpdateWalkthrough,
    handleCloseWalkthrough,
    updateCheckStatus, setUpdateCheckStatus,
    updateManifest, setUpdateManifest,
    updatePrefs, setUpdatePrefs,
    isUpdatingPrefs, setIsUpdatingPrefs,
    handleUpdatePrefChange,
    downloadProgress,
    handleDownloadUpdate,
    handleInstallUpdate,
    handleAcknowledge,
    handleCheckForUpdate
  };
}
