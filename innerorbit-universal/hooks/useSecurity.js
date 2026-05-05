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

// Safe import for Native Modules
let ScreenCapture;
try {
  if (!isWeb) {
    ScreenCapture = require('expo-screen-capture');
  }
} catch (e) { }

export function useSecurity(settingsStealthExpanded) {
  const [screenshotsBlocked, setScreenshotsBlocked] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);

  // Init Biometrics
  useEffect(() => {
    (async () => {
      try {
        const savedBio = await AsyncStorage.getItem('biometricsEnabled');
        if (savedBio === 'true') setBiometricsEnabled(true);

        const compatible = await LocalAuthentication.hasHardwareAsync();
        setBiometricsSupported(compatible);
      } catch (e) { }
    })();
  }, []);

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

  // Logic from lines 513-561
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
    biometricsSupported
  };
}
