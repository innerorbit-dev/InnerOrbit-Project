/**
 * Purpose: Manages the "Stealth" access logic, including biometric verification for 
 * administrative settings and the 7-day security lock policy for stealth mode changes.
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/themeStore';
import { updateUserProfile } from '../lib/firestore-service';
import * as LocalAuthentication from 'expo-local-authentication';

export function useStealth(user, showSuccess, showError) {
  const [settingsStealthExpanded, setSettingsStealthExpanded] = useState(false);
  const {
    stealthMode,
    setStealthMode,
    stealthButton,
    setStealthButton,
    stealthCode,
    setStealthCode,
    biometricsEnabled,
    setBiometricsEnabled,
    appLockEnabled,
    setAppLockEnabled,
    lastStealthChange
  } = useAppStore();

  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [stealthLockedUntil, setStealthLockedUntil] = useState(null);

  // Biometrics & Lock Logic
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setBiometricsSupported(compatible);

      // Helper to check stealth lock
      if (lastStealthChange) {
        const nextTime = parseInt(lastStealthChange) + (7 * 24 * 60 * 60 * 1000);
        if (Date.now() < nextTime) {
          setStealthLockedUntil(new Date(nextTime));
        } else {
          setStealthLockedUntil(null);
        }
      }
    })();
  }, [settingsStealthExpanded, lastStealthChange]);

  const checkLock = () => {
    if (lastStealthChange) {
      const diff = Date.now() - parseInt(lastStealthChange);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (diff < sevenDays) {
        const daysLeft = Math.ceil((sevenDays - diff) / (86400000));
        showError(`Security Lock: Changes allowed in ${daysLeft} days.`);
        return true; // Locked
      }
    }
    return false; // Not locked
  };

  const handleUpdateStealth = async (mode) => {
    if (mode === 'custom') {
      showSuccess("Custom Modes are Coming Soon!");
      return;
    }
    if (mode === stealthMode) return;

    if (checkLock()) return;

    setStealthMode(mode);

    // Cloud Sync
    if (user?.uid) {
      try { await updateUserProfile(user.uid, { stealthMode: mode }); } catch (e) { }
    }
    showSuccess("Stealth Access Updated. Locked for 7 days.");
    
    // Update lock state immediately
    setStealthLockedUntil(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleUpdateStealthButton = async (btn) => {
    if (checkLock()) return;
    setStealthButton(btn);
    if (user?.uid) {
      try { await updateUserProfile(user.uid, { stealthButton: btn }); } catch (e) { }
    }
  };

  const handleUpdateStealthCode = async (code) => {
    if (checkLock()) return;
    setStealthCode(code);
    if (user?.uid) {
      try { await updateUserProfile(user.uid, { stealthCode: code }); } catch (e) { }
    }
  };

  return {
    settingsStealthExpanded,
    setSettingsStealthExpanded,
    stealthMode,
    stealthButton,
    stealthCode,
    biometricsEnabled,
    appLockEnabled,
    biometricsSupported,
    stealthLockedUntil,
    handleUpdateStealth,
    handleUpdateStealthButton,
    handleUpdateStealthCode,
    setBiometricsEnabled,
    setAppLockEnabled
  };
}
