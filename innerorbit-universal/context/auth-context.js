/**
 * Purpose: Manages the complex, privacy-first authentication lifecycle. Orchestrates 
 * Firebase Auth, biometric challenges, session persistence, and persistent "Decoy Mode" state.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AppState } from "react-native";
import { isWeb, isMobile, Platform } from "../utils/platform";
import { auth, firebase } from "../lib/firebase";
import { signInWithEmailAndPassword, signInWithCredential, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from 'expo-local-authentication';
import { createUserProfile } from "../lib/firestore-service";
import { updateUserProfile } from "../lib/firestore-service";
import SecureStorage from "../lib/secure-storage-service";
import { AuthProtector, LocalPinProtector } from '../lib/security-utils';
import { Logger } from '../lib/logger';
import { DEFAULT_ENCRYPTION_CAPABILITIES } from "../lib/encryption";

export const AuthContext = createContext(undefined);

// --- JS SESSION CACHE (Survives Remounts, resets on full App Closure) ---
let lastDecoyState = !isWeb;
let lastUnlockingState = false;
let lastUserSession = null; // Store user object for PIN sessions across remounts
let sessionHasInitialized = false; // Persistent flag for the whole JS session
let gisClientInitialized = false; // track GIS initialization

export function AuthProvider({ children }) {
  const [user, setUser] = useState(lastUserSession);
  const [authLoading, setAuthLoading] = useState(true);
  const [autoLoginLoading, setAutoLoginLoading] = useState(true);

  // Use session cache as initial values
  const [isDecoyModeInternal, setIsDecoyModeInternal] = useState(lastDecoyState);
  const [isUnlocking, setIsUnlocking] = useState(lastUnlockingState);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);

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
      // Initialize SecureStorage cache once per session
      SecureStorage.init().finally(() => {
        setAuthLoading(false);
      });
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
        Logger.log("[Auth] ✅ Google Sign-In persisted");
      }

      // Track manual login
      await SecureStorage.incrementManualLoginCount();

      return user;
    } catch (err) {
      Logger.error("Google Post-Login Error:", err);
      throw err;
    }
  };


  // --- HANDLE REDIRECT RESULT (Mobile Web) ---
  useEffect(() => {
    if (isWeb) {
      getRedirectResult(auth)
        .then(async (result) => {
          if (result) {
            Logger.log("[Auth] ↩️ Recovered from Redirect Sign-In");
            const saveLogin = sessionStorage.getItem('temp_google_auth_persist') === 'true';
            sessionStorage.removeItem('temp_google_auth_persist'); // Clean up

            await handleGoogleUser(result.user, saveLogin);
          }
        })
        .catch((error) => {
          Logger.error("Redirect Sign-In Error:", error);
          setError(error.message);
        });
    }
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPersistencePrompt, setShowPersistencePrompt] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null); // { userId, pin } for new users
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const isLoggingOutRef = useRef(false);
  const isPermissionRequestingRef = useRef(false);
  const lockTimerRef = useRef(null);
  const presenceIntervalRef = useRef(null);

  // Wrapper for setIsDecoyMode with logging
  const setIsDecoyMode = (val, reason = 'Direct') => {
    Logger.log(`[Auth] 🔄 setIsDecoyMode(${val}) | Reason: ${reason} | From Route: ${isDecoyModeInternal ? 'Locked' : 'Unlocked'}`);
    lastDecoyState = val; // Synchronous update to session cache
    setIsDecoyModeInternal(val);
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
          // If a user is found, we simply set them. 
          setUser(currentUser);
          try {
            const { updateUserPresence } = await import("../lib/firestore-service");
            // 1. Initial Presence Update
            await updateUserPresence(currentUser.uid, true, true).catch(() => { });

            // 2. Start Heartbeat (Immediate & Interval)
            // Clear existing to be safe
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);

            Logger.log("[Auth] ❤️ Starting Session Heartbeat...");
            presenceIntervalRef.current = setInterval(() => {
              // Silenced repetitive log
              // Logger.log("[Auth] ❤️ Sending Presence Heartbeat...");
              updateUserPresence(currentUser.uid, true, true).catch(() => { });
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
        } else {
          // User actually signed out according to Firebase
          // 🛡️ SECURITY FIX: For PIN logins, we don't have a Firebase session.
          // If we have a local JS session cache, we MUST NOT clear the user.
          if (lastUserSession && !currentUser) {
            Logger.log('[Auth] ℹ️ Firebase session empty, but PIN session found. Preserving.');
            setUser(lastUserSession);
            setAuthLoading(false);
            return;
          }

          Logger.log('[Auth] ℹ️ No active session found');
          setUser(null);
          lastUserSession = null;

          if (!isWeb) {
            await AsyncStorage.removeItem("has_active_session").catch(() => { });
          }
        }
      } catch (err) {
        Logger.error("Auth state change error:", err);
        setUser(null);
      } finally {
        // Only disable loading if SecureStorage is also initialized
        const isReady = sessionHasInitialized;
        if (isReady) setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [user?.uid]);

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
        Logger.log(`[Auth] ☀️ App foregrounded (Grace: ${inGracePeriod})`);
        if (lockTimerRef.current) {
          Logger.log("[Auth] 🛡️ Transient background detected - Cancelling lock timer");
          clearTimeout(lockTimerRef.current);
          lockTimerRef.current = null;
        }

        // Heartbeat Resume
        const currentUser = userRef.current;
        if (currentUser?.uid || auth.currentUser?.uid) {
           import("../lib/firestore-service").then(({ updateUserPresence }) => {
            const uid = auth.currentUser?.uid || currentUser?.uid;
            updateUserPresence(uid, true, true).catch(() => {});
            
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
            presenceIntervalRef.current = setInterval(() => {
              updateUserPresence(uid, true, true).catch(() => { });
            }, 60000);
          });
        }
      }

      // Handle Background / Inactive
      if (nextAppState.match(/inactive|background/)) {
        if (presenceIntervalRef.current) {
          clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = null;
        }

        const currentUser = userRef.current;
        if (currentUser?.uid || auth.currentUser?.uid) {
          import("../lib/firestore-service").then(({ updateUserPresence }) => {
            const uid = auth.currentUser?.uid || currentUser?.uid;
            updateUserPresence(uid, false, true).catch(() => {});
          });
        }

        if (!isWeb && !isPermissionRequestingRef.current) {
          if (inGracePeriod) {
            Logger.log(`[Auth] 🛡️ Ignoring Background (Grace: ${graceUntil - now}ms left)`);
            return;
          }

          if (!lockTimerRef.current && !isLoggingOutRef.current) {
            Logger.log("[Auth] ⏳ App backgrounded -> Starting 2s lock timer...");
            lockTimerRef.current = setTimeout(() => {
              Logger.log("[Auth] 🔒 2s timer EXPIRED -> Enforcing DecoyMode");
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
      if (user?.uid || auth.currentUser?.uid) {
        const { updateUserPresence } = await import("../lib/firestore-service");
        const uid = auth.currentUser?.uid || user?.uid;
        updateUserPresence(uid, isOnline, true).catch(() => {});

        if (isOnline) {
          if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = setInterval(() => {
            updateUserPresence(uid, true, true).catch(() => { });
          }, 60000);
        } else {
          if (presenceIntervalRef.current) {
            clearInterval(presenceIntervalRef.current);
            presenceIntervalRef.current = null;
          }
        }
      }
    };

    handlePresence(true);

    const handleWebPresence = () => {
      Logger.log(`[Auth] 🌍 Web Visibility Change: ${document.visibilityState}`);
      handlePresence(document.visibilityState === 'visible');
    };

    const handleBeforeUnload = () => {
      const { updateUserPresence } = require("../lib/firestore-service");
      const uid = auth.currentUser?.uid || user?.uid;
      if (uid) {
        updateUserPresence(uid, false, true).catch(() => { });
      }
    };

    if (isWeb) {
      document.addEventListener('visibilitychange', handleWebPresence);
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        document.removeEventListener('visibilitychange', handleWebPresence);
        window.removeEventListener('beforeunload', handleBeforeUnload);
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
      } catch (e) {
        Logger.warn("[Auth] Failed to publish encryption capabilities:", e?.message || e);
      }
    };
    publishCapabilities();
  }, [user?.uid]);

  const triggerStealthUnlock = async () => {
    Logger.log("[Auth] 🔑 Initiating Stealth Unlock (V4-GlobalThis)...");

    // 🛡️ BIOMETRIC CHECK (Mobile Only)
    if (!isWeb) {
      try {
        const bioEnabled = await AsyncStorage.getItem('biometricsEnabled');
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (bioEnabled === 'true' && hasHardware && isEnrolled) {
          Logger.log("[Auth] 🛡️ Biometrics enabled - Challenging user...");
          setIsBiometricLocked(true);
          setIsDecoyMode(false, 'Stealth-Unlock-Bio-Challenge');
          return; // Wait for BiometricLockScreen to call authenticateBiometrics
        }
      } catch (e) {
        Logger.error("[Auth] Biometric check failed:", e);
      }
    }

    setIsUnlockingSynced(true);

    // Set 5-second immunity window using GLOBAL THIS variable
    globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = Date.now() + 5000;

    try {
      // 1. Show preloader for minimum duration
      await new Promise(resolve => setTimeout(resolve, 800));

      // 2. Perform the actual unlock
      // We set the storage item AND wait for it to be absolutely certain it's there 
      // although we no longer depend on it in the listener, it's good for system integrity.
      await AsyncStorage.setItem("isAppUnlocked", "true");

      // Delay slightly to allow the storage write to flush before state triggers re-renders
      await new Promise(resolve => setTimeout(resolve, 100));

      setIsDecoyMode(false, 'Stealth-Unlock');
      Logger.log('[Auth] 🔓 Stealth Unlock -> Decoy Mode DISABLED');

      // 3. Keep preloader visible during the navigation slide-in
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (e) {
      Logger.error("[Auth] Unlock sequence error:", e);
    } finally {
      // 4. Fade out preloader (Resilience: Always ensure we unblock UI)
      setIsUnlockingSynced(false);
      // Note: We DO NOT reset the grace period here. We let it expire naturally.
      Logger.log("[Auth] ✅ Unlock Sequence Complete.");
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
        Logger.log("[Auth] ✅ Biometric Authentication SUCCESS");
        setIsBiometricLocked(false);
        // Continue with normal unlock logic
        setIsUnlockingSynced(true);
        globalThis.__INNERORBIT_UNLOCK_GRACE_PERIOD = Date.now() + 5000;
        await AsyncStorage.setItem("isAppUnlocked", "true");
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsUnlockingSynced(false);
      } else {
        Logger.warn("[Auth] ❌ Biometric Authentication FAILED/CANCELLED");
        // Stay locked
      }
    } catch (e) {
      Logger.error("[Auth] Biometric Auth Error:", e);
      // Fallback: if biometrics crash, we shouldn't lock the user out entirely?
      // Actually, security-wise, they should re-calculate or try again.
    }
  };
  const signUp = async (email, password) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'SignUp');
      // Security: Ensure no stale credentials from previous sessions exist
      await SecureStorage.clearAllCredentials();

      const result = await createUserWithEmailAndPassword(auth, email, password);
      const profileData = await createUserProfile(result.user);

      // Track that this is a fresh signup for onboarding
      setWelcomeData({
        userId: profileData.userId,
        pin: profileData.pin,
        type: 'welcome',
        method: 'password',
        hasSetPassword: true // Email signups always have a password at this point
      });

      // Don't auto-save credentials on signup - let user decide later
      await SecureStorage.incrementManualLoginCount();
      Logger.log(`[Auth] ✅ Sign Up SUCCESS: ${profileData.userId}`);
      return profileData;
    } catch (err) {
      Logger.error("Sign Up Error:", err);

      // Self-Healing Loophole Fix:
      if (err.code === 'auth/email-already-in-use') {
        try {
          Logger.log("[Auth] Email exists, attempting automatic login to heal profile...");
          const signInResult = await signInWithEmailAndPassword(auth, email, password);
          const profileData = await createUserProfile(signInResult.user);
          return profileData;

        } catch (signInErr) {
          Logger.error("Auto-login failed:", signInErr);
          throw new Error("Account already exists. Please Log In.");
        }
      }

      const errorMessage = err?.message || "Sign up failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signInWithGoogle = async (saveLogin = false) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'GoogleSignIn');
      await AsyncStorage.setItem("isAppUnlocked", "true"); // PERMANENT UNLOCK for this session

      // Security: Ensure no stale credentials
      await SecureStorage.clearAllCredentials();

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Detect Mobile Web Environment
      const isMobileWeb = isWeb && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobileWeb) {
        // Use Redirect Flow for Mobile Web
        Logger.log("[Auth] 📱 Mobile Web detected -> Using signInWithRedirect");
        // Save persistence preference to session storage to retrieve after redirect
        sessionStorage.setItem('temp_google_auth_persist', String(saveLogin));
        await signInWithRedirect(auth, provider);
        // Page will reload, handling continues in useEffect -> getRedirectResult
        return;
      } else {
        // Use Popup Flow for Desktop
        const result = await signInWithPopup(auth, provider);
        return await handleGoogleUser(result.user, saveLogin);
      }
    } catch (err) {
      Logger.error("Google Sign In Error:", err);
      const errorMessage = err?.message || "Google Sign In failed";
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
          Logger.log("[Auth] 🎯 Google One Tap Response received");
          try {
            await signInWithGoogleCredential(response.credential, saveLogin);
          } catch (err) {
            Logger.error("[Auth] One Tap Sign-In Failed:", err);
          }
        },
        auto_select: true, // Seamless auth for repeating users
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          Logger.warn("[Auth] ⚠️ One Tap not displayed:", notification.getNotDisplayedReason());
        } else if (notification.isSkippedMoment()) {
          Logger.log("[Auth] ⏭️ One Tap skipped:", notification.getSkippedReason());
        } else if (notification.isDismissedMoment()) {
          Logger.log("[Auth] ❌ One Tap dismissed:", notification.getDismissedReason());
        }
      });

      gisClientInitialized = true;
      Logger.log("[Auth] ✨ Google One Tap Initialized");
    } catch (err) {
      Logger.error("[Auth] One Tap Init Error:", err);
    }
  };

  const signInWithGoogleCredential = async (idToken, saveLogin = false) => {
    try {
      setError(null);
      setIsDecoyMode(false, 'GoogleCredentialSignIn');
      await AsyncStorage.setItem("isAppUnlocked", "true"); // PERMANENT UNLOCK for this session

      // Security: Ensure no stale credentials
      await SecureStorage.clearAllCredentials();

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      // Create/Update profile
      const profileData = await createUserProfile(result.user);

      // Show Welcome Modal if new user OR returning user (>7 days)
      // Show Welcome Modal if new user OR returning user OR missing password
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
        Logger.log("[Auth] ✅ Google Sign-In persisted locally");
      }

      // Track manual login
      await SecureStorage.incrementManualLoginCount();

      return result.user;
    } catch (err) {
      Logger.error("Google Credential Sign In Error:", err);
      const errorMessage = err?.message || "Google Sign In failed";
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
              Logger.log("Authenticated via Local PIN");
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
          throw new Error("User not found or credentials incorrect");
        }


        const persistenceEnabled = await SecureStorage.isPersistenceEnabled();

        // Handle Immediate Save if checked on form
        if (immediateSave) {
          await SecureStorage.setPersistenceEnabled(true);
          // 🛡️ CRITICAL FIX: Do NOT save PIN as password. Only save password if NOT pin login.
          const passwordToSave = isPinLogin ? null : passwordOrPin;
          await SecureStorage.saveCredentials(userProfile.email, passwordToSave, userProfile.uid);
          Logger.log(`[Auth] ✅ Login persistence updated (Password saved: ${!isPinLogin})`);
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
                  .then(() => Logger.log("[Auth] 🔐 PIN Login upgraded to Full Session"))
                  .catch(e => Logger.warn("[Auth] ⚠️ Silent Auth Failed (Pwd changed/invalid):", e.message));

              } catch (e) {
                Logger.warn("[Auth] Silent Auth Start Error:", e?.message || String(e));
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
        lastUserSession = appUser; // Cache session for remounts
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

        Logger.log(`[Auth] ✅ PIN Sign-In SUCCESS: ${appUser.userId}`);
        return appUser;
      } else {
        // Email/password login
        setIsDecoyMode(false, 'EmailAuth');
        // Sanitize login log
        const sanitizedId = typeof emailOrUserId === 'string' && emailOrUserId.includes('@')
          ? emailOrUserId.split('@')[0].substring(0, 3) + '***'
          : 'ID: ' + (emailOrUserId?.substring?.(0, 4) || 'hidden');

        Logger.log(`[Auth] 🔐 Attempting login for: ${sanitizedId} (Password len: ${passwordOrPin?.length})`);
        const loginStartTime = Date.now();

        const userCredential = await signInWithEmailAndPassword(auth, emailOrUserId, passwordOrPin);
        await protector.recordSuccess();

        // Success! Now we know they have a password. Update Firestore.
        // OPTIMIZATION: Run Firestore updates in parallel with fetching the profile
        // This saves ~300-500ms on login
        const { updateUserProfile } = await import("../lib/firestore-service");

        // Fire both requests at once
        const [_, profileData] = await Promise.all([
          updateUserProfile(userCredential.user.uid, { hasSetPassword: true }),
          createUserProfile(userCredential.user)
        ]);

        // Ensure local state reflects this immediately
        profileData.hasSetPassword = true;

        // Modal logic:
        // 1. New user -> 'welcome'
        // 2. Returning user (> 7 days) -> 'welcome_back'
        // 3. (Implicit) Returning user (< 7 days) with password -> No modal
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
          Logger.log("[Auth] ✅ Immediate login persistence enabled via form (Email)");
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
        Logger.log(`[Auth] ✅ Email Sign-In SUCCESS (${Date.now() - loginStartTime}ms)`);
      }
    } catch (err) {
      // Record failure if it's a credentials error
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.message?.includes('credentials incorrect')) {
        const protector = isPinLogin ? LocalPinProtector : AuthProtector;
        await protector.recordFailure();
      }

      Logger.error("Sign In Error:", err.code, err.message);
      const errorMessage = err?.message || "Sign in failed";
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
      Logger.log("[Auth] 🏃 Starting Logout sequence...");

      // 1. Attempt Server-Side Cleanup (Presence & Auth)
      try {
        if (user?.uid && auth.currentUser) {
          try {
            const { updateUserPresence } = await import("../lib/firestore-service");
            // Use silent=true to suppress "Permission Denied" errors if the session is flaky
            await updateUserPresence(user.uid, false, true);
          } catch (e) {
            // Silent catch for presence update
          }
        }
        await signOut(auth);
      } catch (e) {
        Logger.warn("[Auth] Server logout incomplete (network/permission issue):", e.message);
      }

      // 2. Local State Cleanup (Critical)
      setUser(null);
      // Force "Stealth Mode" (Calculator) on mobile so redirect goes to Calculator, not Login
      setIsDecoyMode(!isWeb, 'Logout');
      await AsyncStorage.removeItem("isAppUnlocked"); // RELOCK permanently
      await AsyncStorage.removeItem("has_active_session"); // Clear online status

      // 3. Secure Storage Cleanup
      try {
        const persistenceEnabled = await SecureStorage.isPersistenceEnabled();
        if (!persistenceEnabled) {
          await SecureStorage.clearAllCredentials();
        }
      } catch (e) {
        Logger.warn("[Auth] SecureStorage cleanup failed:", e.message);
      }

      Logger.log('[Auth] ✅ Logged out successfully (Local state cleared)');
    } catch (err) {
      // Fallback for any unexpected errors
      Logger.error("Logout critical error:", err);
      const errorMessage = err?.message || "Logout failed";
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
