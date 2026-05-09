/**
 * Purpose: Manages high-level privacy settings including privacy levels, decoy PIN rotation,
 * and panic trigger configurations by bridging state with the app-wide ThemeStore.
 */
import { useAppStore } from '../store/themeStore';

export function usePrivacy(showSuccess) {
  const {
    privacyLevel,
    setPrivacyLevel,
    decoyPin,
    setDecoyPin,
    panicTrigger,
    setPanicTrigger,
    autoSafetySettings,
    setAutoSafetySettings,
    updateAutoSafetySetting,
    emergencyAutoActivation,
    setEmergencyAutoActivation,
    sharePresence,
    setSharePresence
  } = useAppStore();

  const handlePrivacyLevel = async (level) => {
    setPrivacyLevel(level);
    if (showSuccess) showSuccess("Privacy Level Updated");
  };

  const handleUpdateDecoyPin = async (pin) => {
    setDecoyPin(pin);
    if (showSuccess) showSuccess("Decoy PIN Updated");
  };

  const handleTogglePanicTrigger = async (val) => {
    setPanicTrigger(val);
  };

  const handleUpdateAutoSafety = async (key, val) => {
    updateAutoSafetySetting(key, val);
  };

  const handleToggleEmergencyAuto = async (val) => {
    setEmergencyAutoActivation(val);
  };

  const handleToggleSharePresence = async (val) => {
    setSharePresence(val);
    if (showSuccess) showSuccess(val ? "Presence Sharing Enabled" : "Presence Sharing Disabled");
  };

  return {
    privacyLevel,
    handlePrivacyLevel,
    decoyPin,
    handleUpdateDecoyPin,
    panicTrigger,
    handleTogglePanicTrigger,
    autoSafetySettings,
    handleUpdateAutoSafety,
    emergencyAutoActivation,
    handleToggleEmergencyAuto,
    sharePresence,
    handleToggleSharePresence
  };
}
