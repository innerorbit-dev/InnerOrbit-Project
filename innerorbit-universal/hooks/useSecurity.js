/**
 * Purpose: Implements device-level security features including biometric authentication 
 * and screenshot protection/blocking for both mobile (ScreenCapture) and desktop (Electron).
 */
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { isWeb } from '../utils/platform';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Logger } from '../lib/logger';
import { WebAuthnService } from '../lib/webauthn-service';

// Safe import for Native Modules
let ScreenCapture;
try {
  if (!isWeb) {
    ScreenCapture = require('expo-screen-capture');
  }
} catch (e) { }

export function useSecurity(settingsStealthExpanded) {
  const [screenshotsBlocked, setScreenshotsBlocked] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [hardwareLockEnabled, setHardwareLockEnabled] = useState(false);
  const [hardwareSupported, setHardwareSupported] = useState(false);
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(true);
  const [keyBackupEnabled, setKeyBackupEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // Init Biometrics and Hardware Security
  useEffect(() => {
    (async () => {
      try {
        const savedScreenshots = await AsyncStorage.getItem('screenshotsBlocked');
        if (savedScreenshots !== null) {
          setScreenshotsBlocked(savedScreenshots === 'true');
        }

        const savedBio = await AsyncStorage.getItem('biometricsEnabled');
        if (savedBio === 'true') setBiometricsEnabled(true);

        const savedHardware = await AsyncStorage.getItem('hardwareLockEnabled');
        if (savedHardware === 'true') setHardwareLockEnabled(true);

        const compatible = await LocalAuthentication.hasHardwareAsync();
        setBiometricsSupported(compatible);

        // Check WebAuthn support for Level 5 Hardware Binding
        if (isWeb) {
          const webauthn = WebAuthnService.getInstance();
          const hwSupported = await webauthn.isSupported();
          setHardwareSupported(hwSupported);
        }

        // Load Firestore-based security settings
        const { auth } = require('../lib/firebase');
        if (auth.currentUser) {
          const { getUserProfile } = await import('../lib/firestore-service');
          const profile = await getUserProfile(auth.currentUser.uid);
          if (profile?.settings) {
            setKeyBackupEnabled(profile.settings.keyBackupEnabled !== false);
            setAutoRecoveryEnabled(profile.settings.autoRecoveryEnabled !== false);
            setBackgroundSyncEnabled(profile.settings.backgroundSyncEnabled !== false);
          }
        }
      } catch (e) {
        Logger.log('Error initializing security state:', e);
      }
    })();
  }, []);

  const handleToggleHardwareLock = async (val, userId, showSuccess, showError) => {
    if (val) {
      if (!isWeb) {
        if (showError) showError("Hardware Security (Level 5) is currently Web-only. Native support coming soon.");
        return;
      }

      try {
        const webauthn = WebAuthnService.getInstance();
        const result = await webauthn.registerHardwareLock(userId || 'current-user');

        if (result) {
          setHardwareLockEnabled(true);
          await AsyncStorage.setItem('hardwareLockEnabled', 'true');
          if (showSuccess) showSuccess("Elite Level 5 Hardware Binding Activated!");
        }
      } catch (error) {
        if (showError) showError("Hardware registration failed or was cancelled.");
      }
    } else {
      setHardwareLockEnabled(false);
      await AsyncStorage.setItem('hardwareLockEnabled', 'false');
      if (showSuccess) showSuccess("Hardware Security Level 5 Disabled.");
    }
  };

  const handleToggleBiometrics = async (val, showSuccess, showError) => {
    if (val) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        if (showError) showError("Device does not support biometrics");
        return;
      }
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        if (showError) showError("No biometrics enrolled on this device");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
        fallbackLabel: 'Use Passcode'
      });
      if (!result.success) {
        if (showError) showError("Authentication failed");
        return;
      }
      setBiometricsEnabled(true);
      await AsyncStorage.setItem('biometricsEnabled', 'true');
      if (showSuccess) showSuccess("Biometric App Lock Enabled");
    } else {
      setBiometricsEnabled(false);
      await AsyncStorage.setItem('biometricsEnabled', 'false');
      if (showSuccess) showSuccess("Biometric App Lock Disabled");
    }
  };

  // Persistence (Not explicitly in bak? Yes it is, in handleToggleScreenshots)

  const handleToggleScreenshots = async (val, showSuccess) => {
    setScreenshotsBlocked(val);
    await AsyncStorage.setItem('screenshotsBlocked', JSON.stringify(val));
    if (showSuccess) showSuccess(val ? "Screenshots Blocked" : "Screenshots Allowed");
  };

  const handleToggleKeyBackup = async (value) => {
    try {
      setLoading(true);
      const { auth } = require('../lib/firebase');
      const { updateUserProfile } = await import('../lib/firestore-service');
      await updateUserProfile(auth.currentUser.uid, {
        'settings.keyBackupEnabled': value
      });
      setKeyBackupEnabled(value);
    } catch (error) {
      Logger.error('Error toggling key backup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRecovery = async (value) => {
    try {
      setLoading(true);
      const { auth } = require('../lib/firebase');
      const { updateUserProfile } = await import('../lib/firestore-service');
      await updateUserProfile(auth.currentUser.uid, {
        'settings.autoRecoveryEnabled': value
      });
      setAutoRecoveryEnabled(value);
    } catch (error) {
      Logger.error('Error toggling auto recovery:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBackgroundSync = async (value) => {
    try {
      setLoading(true);
      const { auth } = require('../lib/firebase');
      const { updateUserProfile } = await import('../lib/firestore-service');
      await updateUserProfile(auth.currentUser.uid, {
        'settings.backgroundSyncEnabled': value
      });
      setBackgroundSyncEnabled(value);
    } catch (error) {
      Logger.error('Error toggling background sync:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detect if running in Electron (Windows .exe)
    const isElectron = isWeb &&
      typeof navigator !== 'undefined' &&
      navigator.userAgent.toLowerCase().includes('electron');

    // Skip on web browsers (but allow on Electron desktop)
    if (isWeb && !isElectron) return;

    let subscription;
    if (screenshotsBlocked) {
      // Native apps (Android/iOS)
      if (!isWeb && ScreenCapture) {
        ScreenCapture.preventScreenCaptureAsync().catch(err => {
          Logger.log('Failed to prevent screen capture:', err);
        });

        // Notify if they try (some devices support this event)
        subscription = ScreenCapture.addScreenshotListener(() => {
          Alert.alert("Privacy Warning", "Screenshots are blocked for security.");
        });
      }

      // Electron (Windows .exe) - Use Electron API
      if (isElectron && window.electron) {
        // Call Electron's setContentProtection API
        window.electron.setScreenshotProtection(true)
          .then(() => Logger.log('Screenshot protection enabled on Windows desktop'))
          .catch(err => Logger.log('Failed to enable screenshot protection:', err));
      }
    } else {
      // Allow screenshots
      if (!isWeb && ScreenCapture) {
        ScreenCapture.allowScreenCaptureAsync().catch(err => {
          Logger.log('Failed to allow screen capture:', err);
        });
      }

      // Electron - disable protection
      if (isElectron && window.electron) {
        window.electron.setScreenshotProtection(false)
          .then(() => Logger.log('Screenshot protection disabled on Windows desktop'))
          .catch(err => Logger.log('Failed to disable screenshot protection:', err));
      }
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [screenshotsBlocked]);

  return {
    screenshotsBlocked,
    handleToggleScreenshots,
    biometricsEnabled,
    handleToggleBiometrics,
    biometricsSupported,
    hardwareLockEnabled,
    hardwareSupported,
    handleToggleHardwareLock,
    autoRecoveryEnabled,
    handleToggleAutoRecovery,
    backgroundSyncEnabled,
    handleToggleBackgroundSync,
    keyBackupEnabled,
    handleToggleKeyBackup
  };
}
