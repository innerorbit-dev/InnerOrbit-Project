/**
 * Purpose: Comprehensive UI state hub. Manages global alerts, modal visibilities, search 
 * queries, and success/error notification timers across all views.
 */
import { useState } from 'react';

export function useUI(isDesktop) {
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [] });
  const [activeSettingsSubPage, setActiveSettingsSubPage] = useState(null);
  const [desktopDetailView, setDesktopDetailView] = useState(null);
  const [privacyPlatformTab, setPrivacyPlatformTab] = useState('mobile');

  // Modals
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState({ id: null, currentName: '' });

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityStep, setSecurityStep] = useState(1);
  const [securityInputPin, setSecurityInputPin] = useState('');
  const [securityMode, setSecurityMode] = useState('password'); // 'password' | 'pin'
  const [securityNewPin, setSecurityNewPin] = useState('');
  const [securityNewPass, setSecurityNewPass] = useState('');
  const [showSecurityNewPass, setShowSecurityNewPass] = useState(false);
  const [isSecuritySkippable, setIsSecuritySkippable] = useState(false);

  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Lock Confirmation
  const [showLockConfirmation, setShowLockConfirmation] = useState(false);

  // User Search
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [showScannedModal, setShowScannedModal] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [showNotificationsView, setShowNotificationsView] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const showError = (msg) => {
    if (!msg) return;
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (!text || text === 'undefined' || text === 'null') return;
    setError(text);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg) => {
    if (!msg) return;
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (!text || text === 'undefined' || text === 'null') return;
    setSuccess(text);
    setTimeout(() => setSuccess(null), 3000);
  };

  return {
    alertConfig, setAlertConfig,
    showError,
    showSuccess,
    error, setError,
    success, setSuccess,
    activeSettingsSubPage, setActiveSettingsSubPage,
    desktopDetailView, setDesktopDetailView,
    privacyPlatformTab, setPrivacyPlatformTab,

    // Modals
    showRenameModal, setShowRenameModal,
    renameTarget, setRenameTarget,

    showSecurityModal, setShowSecurityModal,
    securityStep, setSecurityStep,
    securityInputPin, setSecurityInputPin,
    securityMode, setSecurityMode,
    securityNewPin, setSecurityNewPin,
    securityNewPass, setSecurityNewPass,
    showSecurityNewPass, setShowSecurityNewPass,
    isSecuritySkippable, setIsSecuritySkippable,

    showQRModal, setShowQRModal,
    showScanner, setShowScanner,
    showAboutModal, setShowAboutModal,
    showFeedbackModal, setShowFeedbackModal,
    showLockConfirmation, setShowLockConfirmation,

    // Search
    showSearchModal, setShowSearchModal,
    userSearchQuery, setUserSearchQuery,
    isSearching, setIsSearching,
    searchResult, setSearchResult,
    showScannedModal, setShowScannedModal,
    scannedUser, setScannedUser,
    showNotificationsView, setShowNotificationsView
  };
}
