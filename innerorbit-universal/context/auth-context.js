/**
 * Purpose: Manages the complex, privacy-first authentication lifecycle. Orchestrates 
 * Firebase Auth, biometric challenges, session persistence, and persistent "Decoy Mode" state.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AppState } from "react-native";
import { isWeb, isMobile, Platform } from "../utils/platform";
import { auth, firebase } from "../lib/firebase";
import { signInWithEmailAndPassword, signInWithCredential, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, EmailAuthProvider, linkWithCredential, reauthenticateWithCredential, onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from 'expo-local-authentication';
import { createUserProfile } from "../lib/firestore-service";
import { updateUserProfile } from "../lib/firestore-service";
import SecureStorage from "../lib/secure-storage-service";
import { AuthProtector, LocalPinProtector } from '../lib/security-utils';
import { Logger } from '../lib/logger';
import { IdentitySecurityService, DEV_MODE_PLAIN_IDENTITY } from "../lib/identity-security-service";
import { DEFAULT_ENCRYPTION_CAPABILITIES } from "../lib/encryption";
import { publishMyKeysOnLogin } from "../lib/ratchet-key-service";
import { PresenceService } from "../lib/presence-service";
import { useThemeStore } from "../store/themeStore";

export const AuthContext = createContext(undefined);

// --- SESSION SECURITY CONFIG ---
const SESSION_TIMEOUT = isWeb ? (48 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);

// --- JS SESSION CACHE (Survives Remounts, resets on full App Closure) ---
let lastDecoyState = !isWeb;
let lastUnlockingState = false;
let lastUserSession = null; // Store user object for PIN sessions across remounts
let sessionHasInitialized = false; // Persistent flag for the whole JS session
let gisClientInitialized = false; // track GIS initialization

export function AuthProvider({ children }) {
  const setDecoyMode = useThemeStore(state => state.setDecoyMode);
  // ─── Instant Session Recovery ────────────────────────────────────────────────
  // We use a static variable outside the component to survive remounts during navigation.
  const [user, setUser] = useState(lastUserSession || null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  // PERFORMANCE: Synchronous Session Hinting
  // Check if we previously had an active session to avoid flickering to Login on reload.
  const [sessionHint, setSessionHint] = useState(() => {
    if (isWeb && typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('__INNERORBIT_SESSION_HINT') === 'true';
    }
    return false;
  });

  // Use session cache as initial values
  const [isDecoyModeInternal, setIsDecoyModeInternal] = useState(lastDecoyState);
  const [isUnlocking, setIsUnlocking] = useState(lastUnlockingState);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [sessionPin, setSessionPin] = useState(null); // In-memory only

  // Detect if this is the absolute first mount of THIS instance of the provider
  // AND if it's the first mount of the session overall.
  const isFirstLaunchRef = useRef(!sessionHasInitialized);

  // Note: We've moved state synchronization to the setter functions (setIsDecoyMode, setIsUnlocking)
  // to ensure cache integrity even during rapid unmounts.

  // Combined loading state: True if Auth is initializing
  const loading = authLoading;

  const [error, setError] = useState(null);

  useEffect(() => {
    const isRemount = sessionHasInitialized;
    sessionHasInitialized = true;

    if (!isRemount) {
      Logger.log("[Auth] 🚀 AuthProvider FIRST MOUNT (Fresh Launch)");

      // 🛠️ DEV MODE WARNING
      if (DEV_MODE_PLAIN_IDENTITY) {
        Logger.warn("[Identity] ⚠️ DEV_MODE: Identity saved in PLAIN TEXT.");
      }

      // Initialize SecureStorage cache once per session
      SecureStorage.init();

      // Initial sync of decoy state to theme store
      setDecoyMode(lastDecoyState);
    } else {
      Logger.log("[Auth] ♻️ AuthProvider REMOUNTED (Session State Preserved)");
      // Resilience: Clear unlocking state if it was stuck in cache during remount
      setIsUnlocking(false);
      setAuthLoading(false);
    }

    return () => Logger.log("[Auth] 💀 AuthProvider UNMOUNTED");
  }, []);

  // --- GOOGLE AUTH POST-LOGIN LOGIC ---
  const handleGoogleUser = async (user, saveLogin) => {
    // 🛡️ UNLOCK GRACE PERIOD: Prevent flicker redirects during session establishment
    const expiry = Date.now() + 5000;
    globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = expiry;
    if (isWeb && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('__INNERORBIT_UNLOCK_GRACE_PERIOD', expiry.toString());
    }
    try {
      // Create/Update profile
      const profileData = await createUserProfile(user);

      // Show Welcome Modal if new user OR returning user (> 7 days) OR missing password
      if (profileData.isNewUser || profileData.isReturningUser || !profileData.hasSetPassword) {
        let type = profileData.isNewUser ? 'welcome' : 'welcome_back';

        // If not new/returning but missing password, use special type to bypass Welcome UI
        if (!profileData.isNewUser && !profileData.isReturningUser && !profileData.hasSetPassword) {
          type = 'security_onboarding';
        }

        setWelcomeData({
          userId: profileData.userId,
          pin: profileData.pin,
          type: type,
          method: 'google',
          requiresSecuritySetup: false, // Per user request: sequence handled via home.js
          hasSetPassword: profileData.hasSetPassword
        });
      }

      // Honor saveLogin preference
      if (saveLogin) {
        await SecureStorage.setPersistenceEnabled(true);
        await SecureStorage.saveCredentials(null, null, user.uid);
        Logger.trace('AUTH', 'auth-context.js', 'handleGoogleUser', 'SUCCESS', 'Google Sign-In persisted');
      }

      // Track manual login
      await SecureStorage.incrementManualLoginCount();

      // Track session start for hard timeout (Web: 48h, Mobile: 7d)
      await AsyncStorage.setItem(`session_start_${user.uid}`, Date.now().toString());

      Logger.trace('AUTH', 'auth-context.js', 'handleGoogleUser', 'SUCCESS', `User ${user.uid.substring(0, 8)}`);
      
      // PERFORMANCE: Set session hint synchronously for subsequent reloads
      if (isWeb && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('__INNERORBIT_SESSION_HINT', 'true');
      }

      return user;
    } catch (err) {
      Logger.trace('AUTH', 'auth-context.js', 'handleGoogleUser', 'FAILED', err.message);
      throw err;
    }
  };


  // --- HANDLE REDIRECT RESULT (Mobile Web) ---
  useEffect(() => {
    if (isWeb) {
      Logger.log("[Auth] 🔎 Checking for Redirect Result...");
      getRedirectResult(auth)
        .then(async (result) => {
          if (result) {
            Logger.log(`[Auth] ↩️ Recovered from Redirect Sign-In for user: ${result.user.uid}`);
            const saveLogin = sessionStorage.getItem('temp_google_auth_persist') === 'true';
            sessionStorage.removeItem('temp_google_auth_persist'); // Clean up

            try {
              await handleGoogleUser(result.user, saveLogin);
              Logger.log("[Auth] ✅ Google User handled successfully after redirect");
            } catch (handleErr) {
              Logger.error("[Auth] ❌ Failed to handle Google User after redirect:", handleErr);
              setError(handleErr.message);
            }
          } else {
            Logger.log("[Auth] ℹ️ No redirect result found (Normal load)");
          }
        })
        .catch((error) => {
          Logger.error("[Auth] ❌ Redirect Sign-In Error:", error);
          setError(error.message);
        });
    }
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPersistencePrompt, setShowPersistencePrompt] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null); // { userId, pin } for new users
  const [pendingCredentials, setPendingCredentials] = useState(null);
  // Account linking: set when user tries Google sign-in but email already has password account
  const [pendingGoogleLink, setPendingGoogleLink] = useState(null); // { email, googleCredential }
  const isLoggingOutRef = useRef(false);
  const isPermissionRequestingRef = useRef(false);
  const lockTimerRef = useRef(null);
  const presenceIntervalRef = useRef(null);

  // Wrapper for setIsDecoyMode with logging
  const setIsDecoyMode = (val, reason = 'Direct') => {
    Logger.log(`[Auth] 🔄 setIsDecoyMode(${val}) | Reason: ${reason} | From Route: ${isDecoyModeInternal ? 'Locked' : 'Unlocked'}`);
    lastDecoyState = val; // Synchronous update to session cache
    setIsDecoyModeInternal(val);
    setDecoyMode(val); // Sync to theme store to break require cycles
  };
  const isDecoyMode = isDecoyModeInternal;

  // Wrapper for setIsUnlocking with logic sync
  const setIsUnlockingSynced = (val) => {
    lastUnlockingState = val; // Synchronous update to session cache
    setIsUnlocking(val);
  };

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      Logger.error("Auth instance is missing in AuthContext!");
      setAuthLoading(false);
      return;
    }

    // CRITICAL: On Fresh Launch (Mobile), we MUST be locked.
    // We clear the session-unlock flag but we DO NOT sign out.
    // We check isFirstLaunchRef to ensure this ONLY happens on the true fresh start.
    if (!isWeb && isFirstLaunchRef.current) {
      isFirstLaunchRef.current = false;
      Logger.log("[Auth] 🧹 Fresh launch session - Clearing unlock flag");
      AsyncStorage.removeItem("isAppUnlocked").catch(() => { });
    }


    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // 🛡️ SECURITY: Check for Hard Session Expiry
          const sessionStartTime = await AsyncStorage.getItem(`session_start_${currentUser.uid}`);
          
          if (sessionStartTime) {
            const age = Date.now() - parseInt(sessionStartTime);
            if (age > SESSION_TIMEOUT) {
              Logger.trace('AUTH', 'auth-context.js', 'onAuthStateChanged', 'FAILED', 'Hard Expiry Reached');
              await logout();
              return;
            }
          } else {
            // First time seeing this user without a timestamp? Set it now.
            await AsyncStorage.setItem(`session_start_${currentUser.uid}`, Date.now().toString());
          }

          // 2. 🔐 SECURITY FIX: Publish X25519 and ML-KEM keys (Enables v4/v6 Ratchet)
          // PERFORMANCE: Run in background to avoid blocking the preloader resolution if Firestore is slow
          publishMyKeysOnLogin(currentUser.uid).catch(e => {
            Logger.warn(`[Auth] Background key publication failed: ${e.message}`);
          });

          // If a user is found, we simply set them. 
          setUser(currentUser);
          try {
            // 1. Initial Presence Update (Non-blocking)
            const sharePresence = useThemeStore.getState().sharePresence;
            PresenceService.publishPresence(sharePresence).catch(() => { });

            // 2. Start Heartbeat (Immediate & Interval)
            // Clear existing to be safe
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);

            Logger.trace('AUTH', 'auth-context.js', 'onAuthStateChanged', 'SUCCESS', `Session active: ${currentUser.uid.substring(0, 8)}`);
            presenceIntervalRef.current = setInterval(async () => {
              if (isLoggingOutRef.current) return; // Don't ping if logging out

              // Periodically check if session expired while app is open
              const sessionStartTime = await AsyncStorage.getItem(`session_start_${currentUser.uid}`);
              if (sessionStartTime && (Date.now() - parseInt(sessionStartTime) > SESSION_TIMEOUT)) {
                await logout();
                return;
              }
              const currentSharePresence = useThemeStore.getState().sharePresence;
              PresenceService.publishPresence(currentSharePresence).catch(() => { });
            }, 60000);

          } catch (e) { }

          // Update Secure Session Marker (Persistent Online Status)
          if (!isWeb) {
            await SecureStorage.setPersistenceEnabled(true).catch(() => { });
            // Store a non-sensitive marker that a session exists
            await AsyncStorage.setItem("has_active_session", "true").catch(() => { });
          }

          // Background: Cache profile
          AsyncStorage.setItem("userProfileCache", JSON.stringify(currentUser)).catch(() => { });

          // PERFORMANCE: Ensure session hint is updated on successful auth
          if (isWeb && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('__INNERORBIT_SESSION_HINT', 'true');
            setSessionHint(true);
          }
        } else {
          // User actually signed out according to Firebase
          // 🛡️ SECURITY FIX: For PIN logins, we don't have a Firebase session.
          // If we have a local JS session cache, we MUST NOT clear the user.
          if (lastUserSession && !currentUser) {
            Logger.trace('AUTH', 'auth-context.js', 'onAuthStateChanged', 'SUCCESS', 'Preserving PIN session');
            setUser(lastUserSession);
            setAuthLoading(false);
            return;
          }

          Logger.trace('AUTH', 'auth-context.js', 'onAuthStateChanged', 'SUCCESS', 'No active session');
          setUser(null);
          lastUserSession = null;
          
          // Clear the cache immediately on true sign-out
          AsyncStorage.removeItem("userProfileCache").catch(() => { });

          // PERFORMANCE: Clear session hint on sign-out
          if (isWeb && typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('__INNERORBIT_SESSION_HINT');
          }

          if (!isWeb) {
            await AsyncStorage.removeItem("has_active_session").catch(() => { });
          }
        }
      } catch (err) {
        Logger.trace('AUTH', 'auth-context.js', 'onAuthStateChanged', 'FAILED', err.message);
        setUser(null);
      } finally {
        setAuthInitialized(true);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, []);

  // Use a ref for user to avoid re-mounting AppState listeners unnecessarily
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Note: attemptAutoLogin (credential auto-fill based login) has been REMOVED as per user request.
  // The app will now persist the Firebase session, but remain behind the Calculator gate.

  // Handle app state changes (background/foreground) - INDEPENDENT EFFECT
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      Logger.log(`[Auth] 📱 AppState: ${nextAppState}`);
      const now = Date.now();
      const graceUntil = globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD || 0;
      const inGracePeriod = now < graceUntil;

      // Handle Foreground
      if (nextAppState === "active") {
        // 🔧 DEV: Re-establish Metro WebSocket connection (drops when Hermes pauses in background)
        if (__DEV__) { console.log('[InnerOrbit] 📡 Metro reconnect ping — foreground resume'); }
        Logger.trace('AUTH', 'auth-context.js', 'AppState', 'SUCCESS', `Foregrounded (Grace: ${inGracePeriod})`);
        if (lockTimerRef.current) {
          Logger.log("[Auth] 🛡️ Transient background detected - Cancelling lock timer");
          clearTimeout(lockTimerRef.current);
          lockTimerRef.current = null;
        }

        // Heartbeat Resume
        const currentUser = userRef.current;
        if ((currentUser?.uid || auth.currentUser?.uid) && !isLoggingOutRef.current) {
          const sharePresence = useThemeStore.getState().sharePresence;
          PresenceService.publishPresence(sharePresence).catch(() => { });

          if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = setInterval(() => {
            if (isLoggingOutRef.current) return;
            const currentSharePresence = useThemeStore.getState().sharePresence;
            PresenceService.publishPresence(currentSharePresence).catch(() => { });
          }, 60000);
        }
      }

      // Handle Background / Inactive
      if (nextAppState.match(/inactive|background/)) {
        Logger.trace('AUTH', 'auth-context.js', 'AppState', 'SUCCESS', 'App backgrounded');
        if (presenceIntervalRef.current) {
          clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = null;
        }
        // Note: For Sealed Presence, we just stop the heartbeat when backgrounded.
        // No need for explicit 'offline' status as per privacy goals.

        if (!isWeb && !isPermissionRequestingRef.current) {
          if (inGracePeriod) {
            Logger.log(`[Auth] 🛡️ Ignoring Background (Grace: ${graceUntil - now}ms left)`);
            return;
          }

          if (!lockTimerRef.current && !isLoggingOutRef.current) {
            Logger.log("[Auth] ⏳ App backgrounded -> Starting 2s lock timer...");
            lockTimerRef.current = setTimeout(() => {
              Logger.trace('AUTH', 'auth-context.js', 'AppState', 'SUCCESS', 'Lock timer expired -> Enforcing Decoy');
              setIsDecoyMode(true, 'AppState-Timer');
              lockTimerRef.current = null;
            }, 2000);
          }
        }
      }
    });

    return () => {
      subscription.remove();
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, []);

  // Handle web-specific visibility and initial presence
  useEffect(() => {
    const handlePresence = async (isOnline) => {
      if ((user?.uid || auth.currentUser?.uid) && !isLoggingOutRef.current) {
        const sharePresence = useThemeStore.getState().sharePresence;
        
        if (isOnline) {
          PresenceService.publishPresence(sharePresence).catch(() => { });
          
          if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = setInterval(() => {
            if (isLoggingOutRef.current) return;
            const currentSharePresence = useThemeStore.getState().sharePresence;
            PresenceService.publishPresence(currentSharePresence).catch(() => { });
          }, 60000);
        } else {
          if (presenceIntervalRef.current) {
            clearInterval(presenceIntervalRef.current);
            presenceIntervalRef.current = null;
          }
          // Note: In Sealed Sender, we simply stop the heartbeat.
        }
      }
    };

    handlePresence(true);

    const handleWebPresence = () => {
      Logger.log(`[Auth] 🌍 Web Visibility Change: ${document.visibilityState}`);
      handlePresence(document.visibilityState === 'visible');
    };

    const handlePageHide = () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };

    if (isWeb) {
      document.addEventListener('visibilitychange', handleWebPresence);
      window.addEventListener('pagehide', handlePageHide);
      return () => {
        document.removeEventListener('visibilitychange', handleWebPresence);
        window.removeEventListener('pagehide', handlePageHide);
      };
    }
  }, [user?.uid]);

  // Publish encryption capabilities for per-device capability negotiation.
  useEffect(() => {
    if (!user?.uid) return;
    const publishCapabilities = async () => {
      try {
        await updateUserProfile(user.uid, {
          encryptionCapabilities: DEFAULT_ENCRYPTION_CAPABILITIES,
          encryptionUpdatedAt: Date.now(),
        });
        Logger.trace('AUTH', 'auth-context.js', 'publishCapabilities', 'SUCCESS');
      } catch (e) {
        Logger.trace('AUTH', 'auth-context.js', 'publishCapabilities', 'FAILED', e?.message || e);
      }
    };
    publishCapabilities();
  }, [user?.uid]);

  const triggerStealthUnlock = async () => {
    Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'SUCCESS', 'Initiating sequence');

    // 🛡️ BIOMETRIC CHECK (Mobile Only)
    if (!isWeb) {
      try {
        const bioEnabled = await AsyncStorage.getItem('biometricsEnabled');
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (bioEnabled === 'true' && hasHardware && isEnrolled) {
          Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'SUCCESS', 'Challenging Biometrics');
          setIsBiometricLocked(true);
          setIsDecoyMode(false, 'Stealth-Unlock-Bio-Challenge');
          return; // Wait for BiometricLockScreen to call authenticateBiometrics
        }
      } catch (e) {
        Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'FAILED', `Biometric check: ${e.message}`);
      }
    }

    setIsUnlockingSynced(true);

    // Set 5-second immunity window using GLOBAL THIS variable
    globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = Date.now() + 5000;

    try {
      // 1. Show preloader for minimum duration
      await new Promise(resolve => setTimeout(resolve, 800));

      // 2. Perform the actual unlock
      await AsyncStorage.setItem("isAppUnlocked", "true");

      // Delay slightly to allow the storage write to flush before state triggers re-renders
      await new Promise(resolve => setTimeout(resolve, 100));

      setIsDecoyMode(false, 'Stealth-Unlock');
      Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'SUCCESS', 'Decoy Mode DISABLED');

      // 3. Keep preloader visible during the navigation slide-in
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (e) {
      Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'FAILED', e.message);
    } finally {
      // 4. Fade out preloader (Resilience: Always ensure we unblock UI)
      setIsUnlockingSynced(false);
      Logger.trace('AUTH', 'auth-context.js', 'triggerStealthUnlock', 'SUCCESS', 'Sequence Complete');
    }
  };

  const authenticateBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access InnerOrbit',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        Logger.trace('AUTH', 'auth-context.js', 'authenticateBiometrics', 'SUCCESS', 'Biometric match');
        setIsBiometricLocked(false);
        // Continue with normal unlock logic
        setIsUnlockingSynced(true);
        const expiry = Date.now() + 5000;
        globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = expiry;
        if (isWeb && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('__INNERORBIT_UNLOCK_GRACE_PERIOD', expiry.toString());
        }
        await AsyncStorage.setItem("isAppUnlocked", "true");
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsUnlockingSynced(false);
      } else {
        Logger.trace('AUTH', 'auth-context.js', 'authenticateBiometrics', 'FAILED', 'Challenge failed/cancelled');
      }
    } catch (e) {
      Logger.trace('AUTH', 'auth-context.js', 'authenticateBiometrics', 'FAILED', e.message);
    }
  };
  const signUp = async (email, password) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'SignUp');
      // Security: Ensure no stale credentials from previous sessions exist
      await SecureStorage.clearAllCredentials();

      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // 🛡️ UNLOCK GRACE PERIOD: Prevent flicker redirects during session establishment
      const expiry = Date.now() + 5000;
      globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = expiry;
      if (isWeb && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('__INNERORBIT_UNLOCK_GRACE_PERIOD', expiry.toString());
      }

      const profileData = await createUserProfile(result.user);

      // Track session start for hard timeout
      await AsyncStorage.setItem(`session_start_${result.user.uid}`, Date.now().toString());

      // Track that this is a fresh signup for onboarding
      setWelcomeData({
        userId: profileData.userId,
        pin: profileData.pin,
        type: 'welcome',
        method: 'password',
        hasSetPassword: true // Email signups always have a password at this point
      });

      // 🔐 IDENTITY SECURITY: Save encrypted identity to local hardware storage
      if (profileData.userId && profileData.pin) {
        await IdentitySecurityService.saveIdentityLocally(profileData.userId, profileData.pin);
      }

      // Don't auto-save credentials on signup - let user decide later
      await SecureStorage.incrementManualLoginCount();
      Logger.trace('AUTH', 'auth-context.js', 'signUp', 'SUCCESS', `User ${profileData.userId}`);
      return profileData;
    } catch (err) {
      // Self-Healing Loophole Fix:
      if (err.code === 'auth/email-already-in-use') {
        try {
          Logger.trace('AUTH', 'auth-context.js', 'signUp', 'SUCCESS', 'Email exists, healing profile');
          const signInResult = await signInWithEmailAndPassword(auth, email, password);
          const profileData = await createUserProfile(signInResult.user);
          return profileData;

        } catch (signInErr) {
          Logger.trace('AUTH', 'auth-context.js', 'signUp', 'FAILED', `Healing failed: ${signInErr.message}`);
          throw new Error("Account already exists. Please Log In.");
        }
      }

      const errorMessage = err?.message || "Sign up failed";
      Logger.trace('AUTH', 'auth-context.js', 'signUp', 'FAILED', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signInWithGoogle = async (saveLogin = false) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'GoogleSignIn');
      await AsyncStorage.setItem("isAppUnlocked", "true");

      await SecureStorage.clearAllCredentials();

      const provider = new GoogleAuthProvider();
      const isElectron = isWeb && /Electron/i.test(navigator.userAgent);

      if (isWeb && !isElectron) {
        Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogle', 'SUCCESS', 'Attempting Google Popup');
        try {
          const result = await signInWithPopup(auth, provider);
          return await handleGoogleUser(result.user, saveLogin);
        } catch (popupErr) {
          if (popupErr.code === 'auth/popup-blocked') {
            Logger.warn('[Auth] Popup blocked, falling back to redirect');
            sessionStorage.setItem('temp_google_auth_persist', String(saveLogin));
            await signInWithRedirect(auth, provider);
            return;
          }
          throw popupErr;
        }
      } else {
        Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogle', 'SUCCESS', 'Opening Google Popup');
        const result = await signInWithPopup(auth, provider);
        return await handleGoogleUser(result.user, saveLogin);
      }
    } catch (err) {
      // Account-exists conflict: email already registered with password
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email || '';
        Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogle', 'FAILED', `Conflict: ${email}`);
        const googleCredential = GoogleAuthProvider.credentialFromError(err);
        setPendingGoogleLink({ email, googleCredential });
        setAuthLoading(false);
        return;
      }

      const errorMessage = err?.message || "Google Sign In failed";
      Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogle', 'FAILED', errorMessage);
      setError(errorMessage);
      setAuthLoading(false);
      throw new Error(errorMessage);
    }
  };


  /**
   * Initializes Google One Tap (One-tap sign-in) for Web.
   * This provides a seamless, popup-less experience for repeating users.
   */
  const initializeGoogleOneTap = async (saveLogin = false) => {
    if (!isWeb || typeof window === 'undefined' || !window.google) {
      return;
    }

    if (gisClientInitialized) return;

    try {
      const clientId = "323992704792-vm2ufgnjecmja1vnikr7n16ihigouva0.apps.googleusercontent.com"; // Web Client ID from google-services.json

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          Logger.trace('AUTH', 'auth-context.js', 'initializeGoogleOneTap', 'SUCCESS', 'One Tap response received');
          try {
            await signInWithGoogleCredential(response.credential, saveLogin);
          } catch (err) {
            Logger.trace('AUTH', 'auth-context.js', 'initializeGoogleOneTap', 'FAILED', err.message);
          }
        },
        auto_select: true, // Seamless auth for repeating users
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          Logger.trace('AUTH', 'auth-context.js', 'initializeGoogleOneTap', 'FAILED', notification.getNotDisplayedReason());
        }
      });

      gisClientInitialized = true;
      Logger.trace('AUTH', 'auth-context.js', 'initializeGoogleOneTap', 'SUCCESS', 'Initialized');
    } catch (err) {
      Logger.trace('AUTH', 'auth-context.js', 'initializeGoogleOneTap', 'FAILED', err.message);
    }
  };

  const signInWithGoogleCredential = async (idToken, saveLogin = false) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'GoogleCredentialSignIn');
      
      // 🛡️ UNLOCK GRACE PERIOD: Prevent flicker redirects during session establishment
      const expiry = Date.now() + 5000;
      globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = expiry;
      if (isWeb && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('__INNERORBIT_UNLOCK_GRACE_PERIOD', expiry.toString());
      }

      await AsyncStorage.setItem("isAppUnlocked", "true"); // PERMANENT UNLOCK for this session

      // Security: Ensure no stale credentials
      await SecureStorage.clearAllCredentials();

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      // Create/Update profile
      const profileData = await createUserProfile(result.user);

      // Show Welcome Modal if new user OR returning user (> 7 days) OR missing password
      if (profileData.isNewUser || profileData.isReturningUser || !profileData.hasSetPassword) {
        let type = profileData.isNewUser ? 'welcome' : 'welcome_back';

        // If not new/returning but missing password, use special type to bypass Welcome UI
        if (!profileData.isNewUser && !profileData.isReturningUser && !profileData.hasSetPassword) {
          type = 'security_onboarding';
        }

        setWelcomeData({
          userId: profileData.userId,
          pin: profileData.pin,
          type: type,
          method: 'google',
          requiresSecuritySetup: !profileData.hasSetPassword, // Optional but good to keep
          hasSetPassword: profileData.hasSetPassword
        });
      }

      // CRITICAL: For Google Sign-In on Native, we MUST enable local persistence if requested
      if (saveLogin || !isWeb) {
        await SecureStorage.setPersistenceEnabled(true);
        await SecureStorage.saveCredentials(null, null, result.user.uid);
        Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogleCredential', 'SUCCESS', 'Credentials persisted');
      }

      // Track manual login
      await SecureStorage.incrementManualLoginCount();

      Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogleCredential', 'SUCCESS', `User ${result.user.uid.substring(0, 8)}`);
      return result.user;
    } catch (err) {
      // Account-exists conflict (One Tap path)
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email || '';
        Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogleCredential', 'FAILED', `Conflict: ${email}`);
        const googleCredential = GoogleAuthProvider.credentialFromError(err);
        setPendingGoogleLink({ email, googleCredential });
        return;
      }

      const errorMessage = err?.message || "Google Sign In failed";
      Logger.trace('AUTH', 'auth-context.js', 'signInWithGoogleCredential', 'FAILED', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signIn = async (emailOrUserId, passwordOrPin, isPinLogin = false, immediateSave = false) => {
    try {
      setError(null);

      // Brute Force Protection: Check if already locked out
      const protector = isPinLogin ? LocalPinProtector : AuthProtector;
      const waitTime = await protector.getRemainingWaitTime();
      if (waitTime > 0) {
        const seconds = Math.ceil(waitTime / 1000);
        const minutes = Math.ceil(seconds / 60);
        const timeStr = minutes > 1 ? `${minutes} minutes` : `${seconds} seconds`;
        Logger.trace('AUTH', 'auth-context.js', 'signIn', 'FAILED', `Locked out for ${timeStr}`);
        throw new Error(`Too many failed attempts. Please try again in ${timeStr}.`);
      }

      setIsDecoyMode(false, 'PasswordSignIn');
      await AsyncStorage.setItem("isAppUnlocked", "true"); // PERMANENT UNLOCK for this session

      if (isPinLogin) {
        // PIN-based login
        const { findUserByCredentials, findUserById } = await import("../lib/user-id-generator");
        let userProfile;

        if (passwordOrPin && passwordOrPin.trim().length > 0) {
          try {
            userProfile = await findUserByCredentials(emailOrUserId, passwordOrPin);
            if (!userProfile) {
              // Failed remote PIN check
              await protector.recordFailure();
            } else {
              // Success!
              await protector.recordSuccess();
            }
          } catch (e) {
            // Check local PIN override
            const localPin = await AsyncStorage.getItem('localAppPin');
            if (localPin && passwordOrPin === localPin) {
              userProfile = await findUserById(emailOrUserId);
              Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', 'Authenticated via Local PIN');
              await protector.recordSuccess();
            } else {
              await protector.recordFailure();
              throw e;
            }
          }
        } else {
          userProfile = await findUserById(emailOrUserId);
        }

        if (!userProfile) {
          Logger.trace('AUTH', 'auth-context.js', 'signIn', 'FAILED', 'User not found or credentials incorrect');
          throw new Error("User not found or credentials incorrect");
        }


        const persistenceEnabled = await SecureStorage.isPersistenceEnabled();

        // Handle Immediate Save if checked on form
        if (immediateSave) {
          await SecureStorage.setPersistenceEnabled(true);
          // 🛡️ CRITICAL FIX: Do NOT save PIN as password. Only save password if NOT pin login.
          const passwordToSave = isPinLogin ? null : passwordOrPin;
          await SecureStorage.saveCredentials(userProfile.email, passwordToSave, userProfile.uid);
          Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', `Persistence updated (Password saved: ${!isPinLogin})`);
        }

        // Attempt to upgrade to full Firebase session if credentials are saved
        // 🛡️ SECURITY: Do NOT attempt silent auth for Decoy/Stealth sessions
        if (!userProfile.isDecoySession) {
          if (persistenceEnabled) {
            const { email: storedEmail, password: storedPass } = await SecureStorage.getCredentials();

            // Robust check with normalized email
            if (storedEmail && storedPass && storedEmail.toLowerCase() === userProfile.email.toLowerCase()) {
              try {
                // Run in background (no await) to allow UI to proceed immediately
                signInWithEmailAndPassword(auth, storedEmail, storedPass)
                  .then(() => Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', 'PIN upgraded to Full Session'))
                  .catch(e => Logger.trace('AUTH', 'auth-context.js', 'signIn', 'FAILED', `Silent Auth: ${e.message}`));

              } catch (e) {
                Logger.trace('AUTH', 'auth-context.js', 'signIn', 'FAILED', `Silent Auth start: ${e.message}`);
              }
            }
          }
        }


        const appUser = {
          uid: userProfile.uid,
          email: userProfile.email,
          ...userProfile
        };

        setUser(appUser);
        
        // 🛡️ UNLOCK GRACE PERIOD: Prevent flicker redirects during session establishment
        globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = Date.now() + 5000;

        lastUserSession = appUser; // Cache session for remounts
        
        // Cache PIN for background key backups (Cross-Device Recovery)
        if (isPinLogin && passwordOrPin) {
          setSessionPin(passwordOrPin);
        }

        // Track session start for hard timeout
        await AsyncStorage.setItem(`session_start_${appUser.uid}`, Date.now().toString());

        setIsDecoyMode(!!userProfile.isDecoySession, 'PinSignIn');

        // Save userId only if persistence is enabled (and not already saved via immediateSave)
        if (persistenceEnabled && !immediateSave) {
          await SecureStorage.saveCredentials(null, null, userProfile.uid);
        }

        // Track manual login
        await SecureStorage.incrementManualLoginCount();

        // Check if we should show persistence prompt
        const shouldShow = !immediateSave && await SecureStorage.shouldShowPersistencePrompt();
        if (shouldShow) {
          setPendingCredentials({ email: userProfile.email, password: passwordOrPin, userId: userProfile.uid });
          setShowPersistencePrompt(true);
        }

        // 🔐 IDENTITY SECURITY: Bind session identity to hardware
        if (userProfile.userId && passwordOrPin && isPinLogin) {
          await IdentitySecurityService.saveIdentityLocally(userProfile.userId, passwordOrPin);
        }

        Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', `PIN login: ${appUser.userId}`);
        return appUser;
      } else {
        // Email/password login
        setIsDecoyMode(false, 'EmailAuth');
        const loginStartTime = Date.now();

        const userCredential = await signInWithEmailAndPassword(auth, emailOrUserId, passwordOrPin);
        
        // 🛡️ UNLOCK GRACE PERIOD: Prevent flicker redirects during session establishment
        globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = Date.now() + 5000;

        await protector.recordSuccess();

        // Success! Now we know they have a password. Update Firestore.
        const { updateUserProfile } = await import("../lib/firestore-service");

        // Fire both requests at once
        const [_, profileData] = await Promise.all([
          updateUserProfile(userCredential.user.uid, { hasSetPassword: true }),
          createUserProfile(userCredential.user)
        ]);

        // Ensure local state reflects this immediately
        profileData.hasSetPassword = true;

        // 🔐 IDENTITY SECURITY: Bind session identity to hardware
        if (profileData.userId && profileData.pin) {
          await IdentitySecurityService.saveIdentityLocally(profileData.userId, profileData.pin);
        }

        // Modal logic:
        if (profileData.isNewUser || profileData.isReturningUser) {
          setWelcomeData({
            userId: profileData.userId,
            pin: profileData.pin,
            type: profileData.isNewUser ? 'welcome' : 'welcome_back',
            method: 'password',
            hasSetPassword: true
          });
        }

        // Handle Immediate Save if checked on form
        if (immediateSave) {
          await SecureStorage.setPersistenceEnabled(true);
          await SecureStorage.saveCredentials(emailOrUserId, passwordOrPin, null);
          Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', 'Persistence enabled via form (Email)');
        }

        // Track manual login
        await SecureStorage.incrementManualLoginCount();

        // Check if we should show persistence prompt
        const shouldShow = !immediateSave && await SecureStorage.shouldShowPersistencePrompt();
        const persistenceEnabled = await SecureStorage.isPersistenceEnabled();

        if (shouldShow) {
          setPendingCredentials({ email: emailOrUserId, password: passwordOrPin, userId: null });
          setShowPersistencePrompt(true);
        } else {
          if (persistenceEnabled && !immediateSave) {
            await SecureStorage.saveCredentials(emailOrUserId, passwordOrPin, null);
          }
        }
        Logger.trace('AUTH', 'auth-context.js', 'signIn', 'SUCCESS', `Email login: ${userCredential.user.uid.substring(0, 8)} (${Date.now() - loginStartTime}ms)`);
      }
    } catch (err) {
      // Record failure if it's a credentials error
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.message?.includes('credentials incorrect')) {
        const protector = isPinLogin ? LocalPinProtector : AuthProtector;
        await protector.recordFailure();
      }

      const errorMessage = err?.message || "Sign in failed";
      Logger.trace('AUTH', 'auth-context.js', 'signIn', 'FAILED', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      setIsLoggingOut(true);
      isLoggingOutRef.current = true;

      // Clear local cache FIRST to prevent race conditions on remount
      lastUserSession = null;
      Logger.trace('AUTH', 'auth-context.js', 'logout', 'SUCCESS', 'Starting sequence');

      // 0. Hard-Kill Presence Heartbeat immediately
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }

      // 1. Attempt Server-Side Cleanup (Presence & Auth)
      try {
        if (user?.uid && auth.currentUser) {
          try {
            // First, send an explicit 'offline' status via Sealed Presence if possible
            const sharePresence = useThemeStore.getState().sharePresence;
            await PresenceService.publishPresence(sharePresence, false).catch(() => { });

            // Fallback: raw publicProfiles fields (unencrypted)
            const { updateUserPresence } = await import("../lib/firestore-service");
            await updateUserPresence(user.uid, false, true).catch(() => { });
          } catch (e) {
            // Silent catch for presence update
          }
        }
        await signOut(auth);
      } catch (e) {
        Logger.trace('AUTH', 'auth-context.js', 'logout', 'FAILED', `Server logout: ${e.message}`);
      }

      // 2. Local State Cleanup (Critical)
      const currentUid = user?.uid || auth.currentUser?.uid;
      if (currentUid) {
        await AsyncStorage.removeItem(`session_start_${currentUid}`).catch(() => { });
      }
      
      setUser(null);
      // Force "Stealth Mode" (Calculator) on mobile so redirect goes to Calculator, not Login
      setIsDecoyMode(!isWeb, 'Logout');
      if (isWeb && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('__INNERORBIT_SESSION_HINT');
        setSessionHint(false);
      }
      await AsyncStorage.removeItem("isAppUnlocked"); // RELOCK permanently
      await AsyncStorage.removeItem("has_active_session"); // Clear online status

      // 3. Secure Storage Cleanup
      try {
        const persistenceEnabled = await SecureStorage.isPersistenceEnabled();
        if (!persistenceEnabled) {
          await SecureStorage.clearAllCredentials();
        }
      } catch (e) {
        Logger.trace('AUTH', 'auth-context.js', 'logout', 'FAILED', `SecureStorage: ${e.message}`);
      }

      Logger.trace('AUTH', 'auth-context.js', 'logout', 'SUCCESS', 'Complete');
    } catch (err) {
      const errorMessage = err?.message || "Logout failed";
      Logger.trace('AUTH', 'auth-context.js', 'logout', 'FAILED', errorMessage);
      setError(errorMessage);
      setUser(null); // Force clear
    } finally {
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }
  };

  const handlePersistenceAccept = async () => {
    await SecureStorage.setPersistenceEnabled(true);

    if (pendingCredentials) {
      await SecureStorage.saveCredentials(
        pendingCredentials.email,
        pendingCredentials.password,
        pendingCredentials.userId
      );
    }

    setShowPersistencePrompt(false);
    setPendingCredentials(null);
    Logger.log('[Auth] ✅ Login persistence enabled');
  };

  const handlePersistenceDecline = async () => {
    await SecureStorage.incrementDeclineCount();
    setShowPersistencePrompt(false);
    setPendingCredentials(null);
    Logger.log('[Auth] ℹ️ Login persistence declined');
  };

  const setPermissionRequesting = (isRequesting) => {
    isPermissionRequestingRef.current = isRequesting;
    if (isRequesting) Logger.log("[Auth] 🛡️ Auto-lock paused for permission request");
    else Logger.log("[Auth] 🛡️ Auto-lock resumed");
  };

  /**
   * Links a pending Google credential to an existing email/password account.
   * Called from AccountLinkModal after user enters their password.
   * @param {string} password – the user's existing email account password
   */
  const linkGoogleToEmailAccount = async (password) => {
    if (!pendingGoogleLink) throw new Error('No pending Google link found.');
    const { email, googleCredential } = pendingGoogleLink;

    try {
      Logger.trace('AUTH', 'auth-context.js', 'linkGoogleToEmailAccount', 'SUCCESS', `Linking ${email}`);

      // 1. Sign in with email+password to get a valid Firebase user
      const result = await signInWithEmailAndPassword(auth, email, password);

      // 2. Link Google provider to this account
      await linkWithCredential(result.user, googleCredential);
      Logger.trace('AUTH', 'auth-context.js', 'linkGoogleToEmailAccount', 'SUCCESS', 'Linked successfully');

      // 3. Create/update Firestore profile (account already exists)
      await createUserProfile(result.user);

      // 4. Clear pending state
      setPendingGoogleLink(null);

      return result.user;
    } catch (err) {
      Logger.trace('AUTH', 'auth-context.js', 'linkGoogleToEmailAccount', 'FAILED', err.message);
      throw err;
    }
  };

  const clearPendingGoogleLink = () => setPendingGoogleLink(null);



  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithGoogleCredential,
      initializeGoogleOneTap,
      logout,
      isLoggingOut,
      error,
      isDecoyMode,
      setIsDecoyMode,
      triggerStealthUnlock,
      isBiometricLocked,
      authenticateBiometrics,
      sessionPin,
      setSessionPin,
      isUnlocking,
      setIsUnlocking: setIsUnlockingSynced,
      welcomeData,
      setWelcomeData,
      showPersistencePrompt,
      setShowPersistencePrompt,
      handlePersistenceAccept,
      handlePersistenceDecline,
      setPermissionRequesting,
      persistenceEnabled: SecureStorage.isPersistenceEnabledSync(),
      pendingGoogleLink,
      linkGoogleToEmailAccount,
      clearPendingGoogleLink,
      hasSessionHint: sessionHint,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
