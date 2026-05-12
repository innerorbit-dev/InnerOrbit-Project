/** Purpose: Secure login interface with support for biometric and third-party auth. */
// Privacy-First Universal Login Screen - 2026-02-16T02:15
import React, { useState, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, TextInput, Pressable, TouchableOpacity, ScrollView, Alert, StyleSheet, Animated, Dimensions, Easing, useWindowDimensions, Image, Linking } from "react-native";
import { isWeb, isMobileLayout, isDesktop, select } from "../utils/platform";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { SplitAuthLayout } from "../components/split-auth-layout";
import { Logger } from "../lib/logger";
import { useAuth } from "../context/auth-context";
import { StatusBar } from "expo-status-bar";
import { Feather, FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from 'expo-local-authentication';
import { getFriendlyErrorMessage } from "../lib/error-handler";
import { CustomAlert } from "../components/ui/custom-alert";
import { LoginPersistenceModal } from "../components/login-persistence-modal";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import SecureStorage from "../lib/secure-storage-service";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Reanimated removed to prevent Web crashes
// using standard React Native Animated API where needed
const LOGO_IMG = require("../assets/InnerOrbit-Logo.png");
import { getAuthTheme, getAuthStyles } from "../styles/auth.styles";
import { useAppTheme } from "../store/themeStore";



// Complete any pending auth sessions (for web/mobile redirects) - HANDLED IN _LAYOUT.JS
// WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallDevice = width < 380; // Target Fold/Flip outer screens
  const isCompact = height < 750;

  const { isDark } = useAppTheme();

  // Platform-Safe Theme Evaluation
  const THEME = React.useMemo(() => getAuthTheme('default', isDark), [isDark]);

  const { 
    signIn, 
    signInWithGoogle, 
    signInWithGoogleCredential, 
    initializeGoogleOneTap,
    user, 
    showPersistencePrompt, 
    handlePersistenceAccept, 
    handlePersistenceDecline, 
    isLoggingOut, 
    logout, 
    setIsDecoyMode,
    persistenceEnabled,
    welcomeData,
    setWelcomeData
  } = useAuth();
  const [loginMode, setLoginMode] = useState("email"); // Default, but updated by effect
  const [error, setError] = useState(null);
  const [googleSignInError, setGoogleSignInError] = useState(false);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });

  // Google Auth Request Configuration
  // IMPORTANT: You must replace these placeholders with your actual Client IDs from the Google Cloud Console
  // Project ID: innerorbit-bc8ce
  // Console: https://console.cloud.google.com/apis/credentials?project=innerorbit-bc8ce


  const [request, response, promptAsync] = Google.useAuthRequest({
    // Web Client ID (Required for Expo Go and Web)
    webClientId: Constants.expoConfig?.extra?.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "323992704792-vm2ufgnjecmja1vnikr7n16ihigouva0.apps.googleusercontent.com",

    // Native Android Client ID (Linked to your SHA-1 Fingerprint)
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "323992704792-ppj00cmjjn7kdg5bvb6gvfq951lnk220.apps.googleusercontent.com",

    // For iOS (Expo Go), we fallback to Web Client ID until a native iOS ID is created
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "323992704792-vm2ufgnjecmja1vnikr7n16ihigouva0.apps.googleusercontent.com",
    // STANDARD PACKAGE SCHEME (Required for Google Android Client ID validation)
    redirectUri: makeRedirectUri({
      scheme: "com.innerorbit.calcx",
    }),
  }, { skip: isWeb }); // Prune Web initialization to avoid interference with Firebase Redirect

  useEffect(() => {
    if (request) {
      Logger.log("--- GOOGLE AUTH DEBUG ---");
      Logger.log("Planned Redirect URI:", request.redirectUri);
      Logger.log("Auth URL Hash:", request.url.substring(0, 50) + "...");
      Logger.log("--------------------------");
    }
  }, [request]);

  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (response) {
      Logger.log("[Google Auth] Response received:", response.type);
      if (response.type === "success") {
        setGoogleLoading(true);
        setGoogleSignInError(false);
        const { id_token } = response.params;
        Logger.log("[Google Auth] ID Token present:", !!id_token);
        if (id_token) {
          handleMobileGoogleLogin(id_token);
        }
      } else if (response.type === "dismiss" || response.type === "error") {
        Logger.warn("[Google Auth] Canceled or Error:", response);
        setGoogleSignInError(true);
        setTimeout(() => setGoogleSignInError(false), 5000);
        setGoogleLoading(false);
      }
    }
  }, [response]);

  // Google One Tap Initialization (Web Only)
  useEffect(() => {
    if (isWeb) {
      const initOneTap = async () => {
        // Wait for potential logout/session clearing to finish
        await new Promise(resolve => setTimeout(resolve, 1000));
        initializeGoogleOneTap(loginMode === 'email' ? saveEmailLoginChecked : savePinLoginChecked);
      };
      initOneTap();
    }
  }, []);

  const handleMobileGoogleLogin = async (idToken) => {
    try {
      setGoogleLoading(true);
      setIsTransitioning(true);
      await signInWithGoogleCredential(idToken, loginMode === 'email' ? saveEmailLoginChecked : savePinLoginChecked);

      const { auth } = await import("../lib/firebase");
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        const { publishMyKeysOnLogin } = await import("../lib/ratchet-key-service");
        publishMyKeysOnLogin(currentUid).catch(e => Logger.warn("[Ratchet] Key publish failed:", e));
      }

      router.replace("/home");
    } catch (error) {
      setIsTransitioning(false);
      showError(error);
      setGoogleLoading(false);
    }
  };

  // Dynamic Styles (Moved inside to support dynamic THEME safely)
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    errorText: {
      color: '#FFF',
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      flex: 1,
      marginLeft: 12,
    },
    formCard: {
      backgroundColor: THEME.cardBg,
      borderRadius: 28,
      padding: 24,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: THEME.border,
      width: '100%',
      alignSelf: 'stretch',
      ...(isWeb ? {
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 8px 32px rgba(31,38,135,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
      } : {}),
    },
    toggleContainer: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 4,
      marginBottom: 24,
      position: 'relative',
      height: 52,
      width: '100%',
    },
    slidingPill: {
      position: 'absolute',
      width: '50%',
      height: '100%',
      borderRadius: 10,
      left: 0,
      top: 0,
      bottom: 0,
    },
    toggleOption: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    toggleText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: THEME.textSecondary,
    },
    toggleTextActive: {
      color: '#FFFFFF',
    },
    inputGroup: {
      marginBottom: 20,
      width: '100%',
    },
    label: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: THEME.text,
      marginBottom: 8,
      marginLeft: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)', // Slightly bumped from 0.03 for visibility
      borderRadius: 16,
      borderWidth: 1,
      borderColor: THEME.border,
      overflow: 'hidden',
    },
    inputContainerFocused: {
      borderColor: THEME.primary,
    },
    inputIcon: {
      marginLeft: 16,
      marginRight: 12,
    },
    inputSeparator: {
      width: 1,
      height: 24,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      marginRight: 8,
    },
    input: {
      flex: 1,
      color: THEME.text,
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      paddingVertical: 16,
      backgroundColor: 'transparent',
    },
    forgotPasswordText: {
      color: THEME.primary,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
    },
    signInButton: {
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: 10,
    },
    signInButtonLoading: {
      opacity: 0.8,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    spinner: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: THEME.background,
      borderTopColor: 'transparent',
      borderRadius: 10,
      marginRight: 12,
    },
    signInButtonText: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
    },
    footerText: {
      color: THEME.textSecondary,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
    },
    footerLink: {
      color: THEME.primary,
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
    },
    checkboxCustom: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    checkboxLabel: {
      fontSize: 14,
      color: THEME.textSecondary,
      fontFamily: 'Inter_500Medium',
    },
  }), [THEME, insets]);


  const showError = (err) => {
    const msg = typeof err === 'string' ? err : getFriendlyErrorMessage(err);
    setError(msg);
    // Auto-dismiss after 5 seconds for better readability
    setTimeout(() => setError(null), 5000);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(false); // Defer navigation until persistence modal is dismissed
  const [focusedInput, setFocusedInput] = useState(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const cardSwipeAnim = useRef(new Animated.Value(0)).current;

  // Navigate to /home after persistence modal is dismissed
  useEffect(() => {
    if (pendingNavigation && !showPersistencePrompt) {
      setPendingNavigation(false);
      router.replace("/home");
    }
  }, [pendingNavigation, showPersistencePrompt]);

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock InnerOrbit',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel'
      });
      if (result.success) {
        await AsyncStorage.setItem("isAppUnlocked", "true");
        setIsDecoyMode(false, 'Biometric-Manual');
        // Navigation is handled by _layout.js auth listener
      }
    } catch (e) { Logger.warn('Manual Bio Auth Failed', e); }
  };

  // Refs for keyboard navigation
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const userIdRef = useRef(null);
  const pinRef = useRef(null);

  // Feature flags
  const [allowUserIdLogin, setAllowUserIdLogin] = useState(false);

  // Save login checkbox state (Separate for Email and PIN)
  const [saveEmailLoginChecked, setSaveEmailLoginChecked] = useState(false);
  const [savePinLoginChecked, setSavePinLoginChecked] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);

  // Load saved login mode preference and feature flags
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem("loginMode");
        if (savedMode) {
          setLoginMode(savedMode);
          // If saved mode is PIN, animate toggle immediately (optional)
          if (savedMode === 'pin') {
            // We can't easily animate ref here inside effect without complexity, 
            // but state update will trigger the animation effect below.
          }
        }

        const savedUserIdLogin = await AsyncStorage.getItem("enableUserIdLogin");
        if (savedUserIdLogin === "true") {
          setAllowUserIdLogin(true);
        }

        const isEnabled = SecureStorage.isPersistenceEnabledSync();

        // CHECK FOR ANY EXISTING DATA (To show/hide Reset button)
        const { email: savedEmail, password: savedPass, userId: savedId } = await SecureStorage.getCredentials();
        const hasLocalPin = await AsyncStorage.getItem("localAppPin");

        // Debug visibility
        Logger.log(`[Reset Visibility Debug] ${JSON.stringify({
          savedMode,
          savedUserIdLogin,
          isEnabled,
          hasCredentials: !!(savedEmail || savedPass || savedId || hasLocalPin),
          hasLocalPin: !!hasLocalPin
        })}`);

        // Only show if there's actual login data or encryption settings, ignore default modes
        // FIX: Only show if we actually HAVE credentials, not just if persistence is enabled
        if (savedEmail || savedPass || savedId || hasLocalPin) {
          setHasExistingData(true);
        }
      } catch (e) {
        Logger.log("Failed to load login preference");
      }
    };
    loadPreference();
  }, []);

  // Biometric / App Lock Logic
  useEffect(() => {
    // 1. Pre-fill credentials if "Save Login" was enabled previously
    const prefillCredentials = async () => {
      try {
        const creds = await SecureStorage.getCredentials();
        if (creds.email) setEmail(creds.email);
        if (creds.password) {
          setPassword(creds.password);
          setSaveEmailLoginChecked(true); // Auto-check if we have saved data
        }
        if (creds.userId) setUserId(creds.userId);
        if (creds.pin) {
          setPin(creds.pin);
          setSavePinLoginChecked(true); // Auto-check if we have saved data
        }
      } catch (e) {
        Logger.warn("[Login] Pre-fill failed:", e);
      }
    };
    prefillCredentials();

    // 2. Check for Biometric App Lock
    const checkAppLock = async () => {
      // Safety delay for UI mount
      await new Promise(r => setTimeout(r, 600));

      try {
        const savedBio = await AsyncStorage.getItem("biometricsEnabled");
        if (savedBio === 'true') {
          setIsBiometricAvailable(true);

          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock InnerOrbit',
            fallbackLabel: 'Use PIN',
            disableDeviceFallback: false,
            cancelLabel: 'Cancel'
          });

          if (result.success) {
            // Unlock successful: mark session as transition-ready
            await AsyncStorage.setItem("isAppUnlocked", "true");
            setIsDecoyMode(false, 'Biometric-App-Lock');
            // Navigation is handled by _layout.js auth listener
          }
        }
      } catch (e) {
        Logger.log("Biometric Check Error:", e);
      }
    };
    checkAppLock();
  }, []);

  // Wrapper to save preference
  const handleModeSwitch = (mode) => {
    if (loginMode === mode) return;
    setLoginMode(mode);
    AsyncStorage.setItem("loginMode", mode).catch(e => Logger.log(e));
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: cardSwipeAnim } }],
    { useNativeDriver: false }
  );

  const onGestureStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      const threshold = 100;

      if (translationX > threshold && loginMode === 'pin') {
        handleModeSwitch('email');
      } else if (translationX < -threshold && loginMode === 'email') {
        handleModeSwitch('pin');
      }

      Animated.spring(cardSwipeAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }).start();
    }
  };

  // Animations
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Toggle Switch Animation
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAnimations();
  }, []);

  // Show security warning on "new" visit (not after logout)
  // Show security warning on "new" visit (not after logout)
  useEffect(() => {
    // We check if isLoggingOut is false on mount
    // If it's true, it means we just came from a logout
    if (!isLoggingOut && isWeb) {
      setSecurityWarning("Security Tip: Avoid saving passwords in your browser. This app securely manages your credentials on all platforms.");
    }
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: isWeb ? 0 : 800,
        useNativeDriver: !isWeb,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  };

  // Animate Toggle when mode changes
  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: loginMode === 'email' ? 0 : 1,
      duration: 300,
      useNativeDriver: false, // width/flex animations often need false, but here we use relative movement
    }).start();
  }, [loginMode]);

  // Spinner Animation logic
  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (loading) {
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: !isWeb,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
    }
  }, [loading]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleSignIn = async () => {
    if (!email || !password) {
      showError("Please enter your email and password to sign in.");
      return;
    }

    try {
      setLoading(true);

      // On successful manual sign-in, we MUST set this flag so AuthContext 
      // doesn't immediately snap back to Calculator on the next tick.
      await AsyncStorage.setItem("isAppUnlocked", "true");
      setIsDecoyMode(false);

      await signIn(email, password, false, saveEmailLoginChecked);

      // Fetch and display user ID after successful login
      const { getUserProfile } = await import("../lib/firestore-service");

      const { auth } = await import("../lib/firebase");
      const currentUid = auth.currentUser?.uid;

      let userId = "Unknown";
      let userPin = "Unknown";

      if (currentUid) {
        try {
          // Initialize/Publish Ratchet Keys (Invisible v4 Handshake)
          const { publishMyKeysOnLogin } = await import("../lib/ratchet-key-service");
          publishMyKeysOnLogin(currentUid).catch(e => Logger.warn("[Ratchet] Key publish failed:", e));

          let userProfile = await getUserProfile(currentUid);

          // SELF-HEALING: If profile is missing or incomplete (glitch during signup), fix it now.
          if (!userProfile || !userProfile.userId || !userProfile.pin) {
            Logger.log("⚠️ Profile incomplete, repairing...");
            const { createUserProfile } = await import("../lib/firestore-service");
            // Re-run creation to generate ID/PIN
            userProfile = await createUserProfile(auth.currentUser);
          }

          userId = userProfile?.userId || "Unknown";
          userPin = userProfile?.pin || "Unknown";
        } catch (profileError) {
          Logger.log("Error fetching profile, skipping ID display:", profileError);
          // Just let _layout handle navigation
          return;
        }
      }

      // Check if we should show the Welcome Back modal (only once every 30 days)
      const lastShownTimestamp = await AsyncStorage.getItem('lastWelcomeBackShown');
      const currentTime = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000; 

      const parsedTimestamp = lastShownTimestamp ? parseInt(lastShownTimestamp, 10) : 0;
      const shouldShowModal = !lastShownTimestamp || isNaN(parsedTimestamp) || (currentTime - parsedTimestamp) > thirtyDaysInMs;

      if (shouldShowModal) {
        // Show the modal and update the timestamp
        await AsyncStorage.setItem('lastWelcomeBackShown', currentTime.toString());

        const welcomeMsg = `Your ID: ${userId}\nYour PIN: ${userPin}\n\n⚠️ Keep your PIN secure.`;

        setAlertConfig({
          visible: true,
          title: "Welcome Back",
          message: welcomeMsg,
          type: 'success',
          buttons: [{
            text: "Continue",
            onPress: () => {
              setAlertConfig(prev => ({ ...prev, visible: false }));
              setWelcomeData(null);
              // If persistence modal is showing, defer navigation
              if (showPersistencePrompt) {
                setPendingNavigation(true);
              } else {
                router.replace("/home");
              }
            }
          }]
        });
      } else {
        // If persistence modal is showing, defer navigation until it's dismissed
        if (showPersistencePrompt) {
          setPendingNavigation(true);
        } else {
          router.replace("/home");
        }
      }
    } catch (error) {
      setIsTransitioning(false);
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSignIn = async () => {
    if (!userId) {
      showError("Please enter your 4-digit User ID to continue.");
      return;
    }

    if (!allowUserIdLogin && !pin) {
      showError("Please enter your 6-digit Recovery PIN.");
      return;
    }

    try {
      setLoading(true);
      // Mark as unlocked for this manual session
      await AsyncStorage.setItem("isAppUnlocked", "true");
      setIsDecoyMode(false);

      await signIn(userId, pin, true, savePinLoginChecked);

      const { auth } = await import("../lib/firebase");
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        const { publishMyKeysOnLogin } = await import("../lib/ratchet-key-service");
        publishMyKeysOnLogin(currentUid).catch(e => Logger.warn("[Ratchet] Key publish failed:", e));
      }

      // Defer navigation if persistence modal is showing
      if (showPersistencePrompt) {
        setPendingNavigation(true);
      } else {
        router.replace("/home");
      }
    } catch (error) {
      setIsTransitioning(false);
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isWeb) {
      try {
        setGoogleLoading(true);
        setIsTransitioning(true);
        await signInWithGoogle(loginMode === 'email' ? saveEmailLoginChecked : savePinLoginChecked);

        const { auth } = await import("../lib/firebase");
        const currentUid = auth.currentUser?.uid;
        if (currentUid) {
          const { publishMyKeysOnLogin } = await import("../lib/ratchet-key-service");
          publishMyKeysOnLogin(currentUid).catch(e => Logger.warn("[Ratchet] Key publish failed:", e));
        }

        if (showPersistencePrompt) {
          setPendingNavigation(true);
        } else {
          router.replace("/home");
        }
      } catch (error) {
        setIsTransitioning(false);
        setGoogleLoading(false);
        setGoogleSignInError(true);
        showError(error);
        // Auto-reset Google error after 5s
        setTimeout(() => setGoogleSignInError(false), 5000);
      } finally {
        // No-op
      }
    } else {
      // Mobile Logic
      setGoogleLoading(true); // Start loading when button is pressed
      promptAsync();
    }
  };


  // Keyboard navigation handler
  const handleKeyPress = (e, currentField) => {
    if (!isWeb) return; // Only for web/desktop

    const key = e.nativeEvent.key;

    // Enter key - submit or move to next field
    if (key === 'Enter') {
      e.preventDefault();
      if (loginMode === 'email') {
        if (currentField === 'email') {
          passwordRef.current?.focus();
        } else if (currentField === 'password') {
          handleSignIn();
        }
      } else {
        if (currentField === 'userId') {
          if (!allowUserIdLogin) {
            pinRef.current?.focus();
          } else {
            handlePinSignIn();
          }
        } else if (currentField === 'pin') {
          handlePinSignIn();
        }
      }
    }

    // Arrow Down - move to next field
    if (key === 'ArrowDown') {
      e.preventDefault();
      if (loginMode === 'email') {
        if (currentField === 'email') passwordRef.current?.focus();
      } else {
        if (currentField === 'userId' && !allowUserIdLogin) pinRef.current?.focus();
      }
    }

    // Arrow Up - move to previous field
    if (key === 'ArrowUp') {
      e.preventDefault();
      if (loginMode === 'email') {
        if (currentField === 'password') emailRef.current?.focus();
      } else {
        if (currentField === 'pin') userIdRef.current?.focus();
      }
    }
  };

  // Determine Focus Color dynamically based on the active mode + the platform Theme
  const getFocusColor = () => loginMode === 'pin' ? '#3b82f6' : THEME.primary;
  const getIconColor = (field) => focusedInput === field ? getFocusColor() : THEME.textSecondary;

  // Interpolate form opacity for smooth transition
  const formOpacity = toggleAnim.interpolate({
    inputRange: [0, 0.5, 1], // Fade out at mid-point
    outputRange: [1, 0, 1]
  });

  const formTranslateX = toggleAnim.interpolate({
    inputRange: [0, 0.5, 0.501, 1],
    outputRange: [0, -20, 20, 0]
  });

  // Interpolate toggle position
  const toggleLeft = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });


  const handleResetAppData = () => {
    setAlertConfig({
      visible: true,
      title: "Reset App Data?",
      message: "This will permanently delete all saved login sessions, decoy PINs, and local preferences. You will be signed out immediately.",
      type: 'warning',
      buttons: [
        {
          text: "Cancel",
          onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
        },
        {
          text: "Reset Everything",
          style: 'destructive',
          onPress: async () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            setLoading(true);
            try {
              // 1. Sign out and cleanup via Auth Context (Handles Firebase signout and local state)
              await logout();
              // 2. Clear all local secure storage AND persistence tracking
              await SecureStorage.resetPersistenceTracking();
              setIsPersistenceAlreadyEnabled(false); // Force update state
              // 3. Clear AsyncStorage keys
              await AsyncStorage.multiRemove([
                'loginMode',
                'enableUserIdLogin',
                'localAppPin',
                'lastWelcomeBackShown'
              ]);

              setAlertConfig({
                visible: true,
                title: "Reset Complete",
                message: "All local data has been cleared. Returning to calculator.",
                type: 'success',
                buttons: [{
                  text: "OK",
                  onPress: () => {
                    setAlertConfig(prev => ({ ...prev, visible: false }));
                    // Force navigation to decoy (calculator)
                    router.replace("/");
                  }
                }]
              });

              // Refresh state
              setIsPersistenceAlreadyEnabled(false);
              setHasExistingData(false);
              setEmail("");
              setPassword("");
              setUserId("");
              setPin("");
            } catch (error) {
              showError("Failed to reset application data.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    });
  };

  // Transition Overlay
  // REMOVED: Unified Transition Overlay to prevent navigation deadlocks
  // The global _layout.js now handles minimal blocking to ensure a smooth transition.

  return (
    <>
      <SplitAuthLayout
        mode="login"
        variant={loginMode === "email" ? "primary" : "secondary"}
        mobileMinimal={true}
        formMaxWidth={480}
      >
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onGestureStateChange}
          activeOffsetX={[-20, 20]} // Activation threshold to avoid conflict with vertical scroll
          enabled={isMobileLayout}
        >
          <Animated.View style={{
            width: '100%',
            alignItems: 'center',
            opacity: fadeAnim,
            transform: [
              { translateX: slideAnim }
            ]
          }}>
            <View style={{ marginTop: isWeb ? (isCompact ? 20 : 40) : 0, marginBottom: isCompact ? 12 : 16, alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: isCompact ? 28 : 34, fontFamily: 'Outfit_700Bold', color: THEME.text, marginBottom: isCompact ? 4 : 8, textAlign: 'center' }}>
                Access Your Account
              </Text>
              <Text style={{ fontSize: isCompact ? 13 : 16, color: THEME.textSecondary, textAlign: 'center', opacity: 0.9 }}>
                Secure • Private • Encrypted
              </Text>
            </View>

            {/* Animated Segmented Toggle */}
            <Animated.View style={[
              styles.toggleContainer,
              isCompact && { height: 48, marginBottom: 32, padding: 3, borderRadius: 10 },
              // Removed swipe animation to keep toggle fixed
            ]}>
              {/* The Sliding Background Pill */}
              <Animated.View
                style={[
                  styles.slidingPill,
                  isCompact && { top: 3, bottom: 3, borderRadius: 7 },
                  {
                    transform: [{ translateX: toggleLeft }],
                    backgroundColor: loginMode === 'email' ? THEME.primary : '#3b82f6',
                  }
                ]}
              />

              {/* Clickable Labels */}
              <Pressable
                style={styles.toggleOption}
                onPress={() => handleModeSwitch("email")}
              >
                <Text style={[styles.toggleText, loginMode === 'email' && styles.toggleTextActive, { fontSize: isCompact ? 13 : 15 }]}>
                  Email Login
                </Text>
              </Pressable>

              <Pressable
                style={styles.toggleOption}
                onPress={() => handleModeSwitch("pin")}
              >
                <Text style={[styles.toggleText, loginMode === 'pin' && styles.toggleTextActive, { fontSize: isCompact ? 13 : 15 }]}>
                  PIN Login
                </Text>
              </Pressable>
            </Animated.View>

            {/* Form Card */}
            <Animated.View style={[
              styles.formCard,
              {
                opacity: formOpacity,
                transform: [
                  { translateX: formTranslateX },
                  { translateX: cardSwipeAnim }
                ],
                borderColor: loginMode === 'email' ? 'rgba(251, 113, 133, 0.2)' : 'rgba(34, 211, 238, 0.3)'
              }
            ]}>
              {/* Error Notification Banner - REMOVED (Moved to Top Level Overlay) */}

              {/* Unified Notification Slot (Security Tip or Error) */}
              {(securityWarning || error) && (
                <View style={{
                  backgroundColor: error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: error ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 60 // Ensure stable height regardless of text lines
                }}>
                  <Feather 
                    name={error ? "alert-circle" : "shield"} 
                    size={18} 
                    color="#EF4444" 
                    style={{ marginRight: 10 }} 
                  />
                  <Text style={{ 
                    color: '#EF4444', 
                    flex: 1, 
                    fontFamily: 'Inter_600SemiBold', 
                    fontSize: 12, 
                    lineHeight: 18 
                  }}>
                    {error || securityWarning}
                  </Text>
                  <Pressable 
                    onPress={() => error ? setError(null) : setSecurityWarning(null)} 
                    hitSlop={10} 
                    style={{ padding: 4 }}
                  >
                    <Feather name="x" size={24} color="#EF4444" style={{ opacity: 0.8 }} />
                  </Pressable>
                </View>
              )}

              {loginMode === "email" ? (
                <>
                  {/* Email Input */}
                  <View style={[styles.inputGroup, { marginBottom: isCompact ? 4 : 6 }]}>
                    <Text style={[styles.label, { fontSize: isCompact ? 13 : 14, marginBottom: isCompact ? 2 : 4 }]}>Email Address</Text>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'email' && styles.inputContainerFocused
                    ]}>
                      <View style={styles.inputIcon}>
                        <Feather name="mail" size={isCompact ? 18 : 20} color={getIconColor('email')} />
                      </View>
                      <View style={[styles.inputSeparator, focusedInput === 'email' && { backgroundColor: THEME.primary }]} />

                      <TextInput
                        ref={emailRef}
                        selectionColor={THEME.primary}
                        cursorColor={THEME.primary}
                        selectionHandleColor={THEME.primary}
                        style={[styles.input, { fontSize: isCompact ? 14 : 16, paddingVertical: isCompact ? 12 : 16, caretColor: THEME.primary }]}
                        placeholderTextColor={THEME.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!loading}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => {
                          setFocusedInput(null);
                          // Reset selection to start so long emails are visible from the beginning
                          if (emailRef.current) {
                            if (isWeb) {
                              try {
                                emailRef.current.setSelectionRange(0, 0);
                              } catch (e) {
                                // Ignore error for input types that don't support selection (like email)
                              }
                              emailRef.current.scrollLeft = 0;
                            } else {
                              emailRef.current.setSelection(0, 0);
                            }
                          }
                        }}
                        onKeyPress={(e) => handleKeyPress(e, 'email')}
                        returnKeyType={email && password ? "go" : "next"}
                        onSubmitEditing={() => {
                          if (email && password) {
                            handleSignIn();
                          } else {
                            passwordRef.current?.focus();
                          }
                        }}
                        underlineColorAndroid="transparent"
                        textContentType="none"
                        autoComplete="off"
                      />
                    </View>
                    {/* Custom Email Validation Tooltip - Replacing native browser popup style */}
                    {focusedInput === 'email' && email.length > 0 && !email.includes('@') && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          marginTop: 8,
                          backgroundColor: 'rgba(244, 63, 94, 0.1)', // Reddish Rose Transparent
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(244, 63, 94, 0.3)', // Soft Rose Border
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{
                          width: 0,
                          height: 0,
                          backgroundColor: 'transparent',
                          borderStyle: 'solid',
                          borderLeftWidth: 6,
                          borderRightWidth: 6,
                          borderBottomWidth: 6,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderBottomColor: 'rgba(244, 63, 94, 0.3)',
                          position: 'absolute',
                          top: -6,
                          left: 20
                        }} />
                        <Feather name="info" size={14} color="#fb7185" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#fb7185', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                          Please include an '@' in the email address.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Password Input */}
                  <View style={[styles.inputGroup, { marginBottom: isCompact ? 4 : 6 }]}>
                    <Text style={[styles.label, { fontSize: isCompact ? 13 : 14, marginBottom: isCompact ? 2 : 4 }]}>Password</Text>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'password' && styles.inputContainerFocused
                    ]}>
                      <View style={styles.inputIcon}>
                        <Feather name="lock" size={isCompact ? 18 : 20} color={getIconColor('password')} />
                      </View>
                      <View style={[styles.inputSeparator, focusedInput === 'password' && { backgroundColor: THEME.primary }]} />

                        <TextInput
                          key={showPassword ? "password-visible" : "password-hidden"}
                          ref={passwordRef}
                          selectionColor={THEME.primary}
                          cursorColor={THEME.primary}
                          selectionHandleColor={THEME.primary}
                          style={[
                            styles.input,
                            {
                              fontSize: isCompact ? 14 : 16,
                              paddingVertical: isCompact ? 12 : 16,
                              caretColor: THEME.primary,
                            }
                          ]}
                          placeholderTextColor={THEME.textSecondary}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          editable={!loading}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                          onKeyPress={(e) => handleKeyPress(e, 'password')}
                          returnKeyType={email && password ? "go" : "next"}
                          onSubmitEditing={() => {
                            if (email && password) {
                              handleSignIn();
                            } else {
                              emailRef.current?.focus();
                            }
                          }}
                          underlineColorAndroid="transparent"
                          textContentType="none"
                          autoComplete="off"
                        />
                        {password.length > 0 && (
                          <Pressable
                            onPress={() => setShowPassword(!showPassword)}
                            style={{
                              padding: 12,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            accessible={true}
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            accessibilityRole="button"
                          >
                            <Feather
                              name={showPassword ? "eye" : "eye-off"}
                              size={20}
                              color={focusedInput === 'password' ? THEME.primary : THEME.textSecondary}
                            />
                          </Pressable>
                        )}
                      </View>
                    </View>


                </>
              ) : (
                <>
                  {/* PIN Login Fields */}
                  <View style={[styles.inputGroup, { marginBottom: isCompact ? 4 : 6 }]}>
                    <Text style={[styles.label, { fontSize: isCompact ? 13 : 14, marginBottom: isCompact ? 2 : 4 }]}>User ID</Text>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'userId' && styles.inputContainerFocused,
                      focusedInput === 'userId' && loginMode === 'pin' && { borderColor: '#3b82f6' }
                    ]}>
                      <View style={styles.inputIcon}>
                        <Feather name="user" size={isCompact ? 18 : 20} color={getIconColor('userId')} />
                      </View>
                      <View style={[styles.inputSeparator, focusedInput === 'userId' && { backgroundColor: '#3b82f6' }]} />

                        <TextInput
                          ref={userIdRef}
                          selectionColor="#3b82f6"
                          cursorColor="#3b82f6"
                          selectionHandleColor="#3b82f6"
                          style={[styles.input, { fontSize: isCompact ? 14 : 16, paddingVertical: isCompact ? 12 : 16, caretColor: '#3b82f6' }]}
                          placeholderTextColor={THEME.textSecondary}
                          value={userId}
                          onChangeText={setUserId}
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                          editable={!loading}
                          onFocus={() => setFocusedInput('userId')}
                          onBlur={() => setFocusedInput(null)}
                          onKeyPress={(e) => handleKeyPress(e, 'userId')}
                          returnKeyType={allowUserIdLogin ? "go" : "next"}
                          onSubmitEditing={() => allowUserIdLogin ? handlePinSignIn() : pinRef.current?.focus()}
                          underlineColorAndroid="transparent"
                          autoComplete="off"
                        />
                      </View>
                    </View>

                  <View style={[styles.inputGroup, { marginBottom: isCompact ? 4 : 6 }]}>
                    <Text style={[styles.label, { fontSize: isCompact ? 13 : 14, marginBottom: isCompact ? 2 : 4 }]}>Recovery PIN</Text>
                    <View style={[
                      styles.inputContainer,
                      focusedInput === 'pin' && styles.inputContainerFocused,
                      focusedInput === 'pin' && loginMode === 'pin' && { borderColor: '#3b82f6' }
                    ]}>
                      <View style={styles.inputIcon}>
                        <Feather name="key" size={isCompact ? 18 : 20} color={getIconColor('pin')} />
                      </View>
                      <View style={[styles.inputSeparator, focusedInput === 'pin' && { backgroundColor: '#3b82f6' }]} />

                        <TextInput
                          key={showPin ? "pin-visible" : "pin-hidden"}
                          ref={pinRef}
                          selectionColor="#3b82f6"
                          cursorColor="#3b82f6"
                          selectionHandleColor="#3b82f6"
                          style={[styles.input, { fontSize: isCompact ? 14 : 16, paddingVertical: isCompact ? 12 : 16, caretColor: '#3b82f6' }]}
                          placeholderTextColor={THEME.textSecondary}
                          value={pin}
                          onChangeText={setPin}
                          keyboardType="numeric"
                          maxLength={6}
                          secureTextEntry={!showPin}
                          editable={!loading}
                          onFocus={() => setFocusedInput('pin')}
                          onBlur={() => setFocusedInput(null)}
                          onKeyPress={(e) => handleKeyPress(e, 'pin')}
                          returnKeyType="go"
                          onSubmitEditing={handlePinSignIn}
                          underlineColorAndroid="transparent"
                          autoComplete="off"
                        />
                        {pin.length > 0 && (
                          <Pressable
                            onPress={() => setShowPin(!showPin)}
                            style={{ padding: 12 }}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                          >
                            <Feather name={showPin ? "eye" : "eye-off"} size={20} color={focusedInput === 'pin' ? '#3b82f6' : THEME.textSecondary} />
                          </Pressable>
                        )}
                      </View>
                    </View>

                </>
              )}

              {/* Actions Row: Checkbox & Helper/Link */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isCompact ? 12 : 16,
                marginTop: isCompact ? 4 : 6,
                paddingHorizontal: 4,
                minHeight: 44 // Enforce stable height for 2-line wrap
              }}>
                {/* Left: Checkbox */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  {!persistenceEnabled && (
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        if (loginMode === 'email') {
                          setSaveEmailLoginChecked(!saveEmailLoginChecked);
                        } else {
                          setSavePinLoginChecked(!savePinLoginChecked);
                        }
                      }}
                      disabled={loading}
                      hitSlop={10}
                    >
                      <View style={[
                        styles.checkboxCustom,
                        (loginMode === 'email' ? saveEmailLoginChecked : savePinLoginChecked) && {
                          backgroundColor: loginMode === 'email' ? THEME.primary : '#3b82f6',
                          borderColor: 'transparent',
                          ...select({
                            ios: {
                              shadowColor: loginMode === 'email' ? THEME.primary : '#3b82f6',
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.5,
                              shadowRadius: 4,
                            },
                            android: {
                              elevation: 4,
                            },
                            web: {
                              boxShadow: `0px 0px 4px ${loginMode === 'email' ? THEME.primary : '#3b82f6'}`,
                            },
                          }),
                        }
                      ]}>
                        {(loginMode === 'email' ? saveEmailLoginChecked : savePinLoginChecked) && <Feather name="check" size={14} color="#FFF" />}
                      </View>
                      <Text style={[styles.checkboxLabel, { fontSize: isCompact ? 13 : 14, flex: 1 }]}>Save login for faster sign-in</Text>
                    </Pressable>
                  )}
                </View>

                {/* Right: Link/Text */}
                <View>
                  {loginMode === 'email' ? (
                    <Pressable
                      onPress={() => router.push("/forgot-password")}
                      disabled={loading}
                      hitSlop={10}
                    >
                      <Text style={[styles.forgotPasswordText, { fontSize: isCompact ? 13 : 14 }]}>Forgot password?</Text>
                    </Pressable>
                  ) : (
                    <Text style={{
                      fontSize: isCompact ? 13 : 14,
                      color: '#60a5fa',
                      fontFamily: 'Inter_600SemiBold',
                      textAlign: 'right'
                    }}>
                      {allowUserIdLogin ? "PIN is optional!" : "PIN is required?"}
                    </Text>
                  )}
                </View>
              </View>

              {/* Sign In Button with Animated Theme Color */}
              <Pressable
                onPress={loginMode === "email" ? handleSignIn : handlePinSignIn}
                disabled={loading}
                style={({ pressed }) => [
                  styles.signInButton,
                  select({
                    ios: { shadowColor: loginMode === 'email' ? THEME.primary : '#3b82f6' },
                    android: { elevation: 4 }, // Add elevation for Android shadow
                    web: { boxShadow: `0px 4px 10px ${loginMode === 'email' ? THEME.primary : '#3b82f6'}` },
                  }),
                  loading && styles.signInButtonLoading,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
              >
                {/* Animated Background */}
                <Animated.View style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: loginMode === 'email' ? THEME.primary : '#60a5fa',
                    borderRadius: 16,
                  },
                ]} />

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
                    <Text style={[styles.signInButtonText, { fontSize: isCompact ? 14 : 16 }]}>Signing in...</Text>
                  </View>
                ) : (
                  <Text style={[styles.signInButtonText, { fontSize: isCompact ? 14 : 16 }]}>
                    {loginMode === "email" ? "Login Securely" : "Access with PIN"}
                  </Text>
                )}
              </Pressable>

              {/* Below-button section — fixed height container prevents footer from jumping */}
              <View style={{ minHeight: 108, marginTop: 0 }}>
                {/* PIN Mode Warning — always in tree, opacity-toggled */}
                <View
                  style={{ opacity: loginMode === 'pin' ? 1 : 0, marginTop: 24, marginBottom: 12, pointerEvents: loginMode === 'pin' ? 'auto' : 'none' }}
                >
                  <View style={{
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: 8,
                    padding: 10,
                  }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: THEME.textSecondary, textAlign: 'center', opacity: 0.9 }}>
                      <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>⚠️ NOTE: </Text>
                      First time on this device? Log in with Email & Password once to enable PIN access.
                    </Text>
                  </View>
                </View>

                {/* Google Sign-In — always in tree, opacity-toggled */}
                <View
                  style={{ opacity: loginMode === 'email' ? 1 : 0, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: loginMode === 'email' ? 'auto' : 'none' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: isCompact ? 8 : 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: THEME.border }} />
                    <Text style={{ color: THEME.textSecondary, marginHorizontal: 10, fontSize: 12 }}>OR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: THEME.border }} />
                  </View>

                  <Pressable
                    onPress={handleGoogleSignIn}
                    disabled={loginMode !== 'email' || loading || googleLoading || (!isWeb && !request)}
                    style={({ pressed }) => [
                      styles.signInButton,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        marginTop: 0,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        ...(isWeb ? { backdropFilter: 'blur(12px)' } : {})
                      },
                      { transform: [{ scale: pressed ? 0.98 : 1 }] }
                    ]}
                  >
                    {googleLoading ? (
                      <View style={styles.loadingContainer}>
                        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
                        <Text style={[styles.signInButtonText, { color: THEME.text, fontSize: isCompact ? 14 : 16 }]}>Signing in...</Text>
                      </View>
                    ) : googleSignInError ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[styles.signInButtonText, { color: '#EF4444', fontWeight: 'bold', fontSize: isCompact ? 13 : 14 }]}>
                          Sign-in failed. Try again.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[styles.signInButtonText, { color: THEME.text, fontWeight: '600', fontSize: isCompact ? 14 : 16 }]}>
                          Sign in with <Text style={{ color: '#4285F4' }}>G</Text><Text style={{ color: '#EA4335' }}>o</Text><Text style={{ color: '#FBBC05' }}>o</Text><Text style={{ color: '#4285F4' }}>g</Text><Text style={{ color: '#34A853' }}>l</Text><Text style={{ color: '#EA4335' }}>e</Text>
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>


              {/* Footer Links - Restored inside card */}
              <View style={[styles.footer, { marginTop: 12 }]}>
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.footerText, { fontSize: isCompact ? 13 : 15 }]}>New to InnerOrbit? </Text>
                    <Pressable onPress={() => router.push("/signup")} disabled={loading}>
                      <Text style={[styles.footerLink, loginMode === 'pin' && { color: '#60a5fa' }, { fontSize: isCompact ? 13 : 15 }]}>Create Account</Text>
                    </Pressable>
                  </View>

                  {hasExistingData && (
                    <Pressable onPress={handleResetAppData} disabled={loading} style={{ opacity: 0.7, marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="database-remove" size={16} color={THEME.textSecondary} style={{ marginRight: 8 }} />
                        <Text style={{ color: THEME.textSecondary, fontSize: isCompact ? 14 : 15, textDecorationLine: 'underline', fontWeight: '500' }}>Reset App Data</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* Download Portal Link — Mobile Only */}
            {!isWeb && <Pressable
              onPress={() => Linking.openURL('https://innerorbit-portal.web.app/')}
              style={({ pressed }) => ({
                marginTop: 16,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Feather name="download-cloud" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter_500Medium', letterSpacing: 0.3 }}>
                Go to portal  →
              </Text>
            </Pressable>}

          </Animated.View>
        </PanGestureHandler>

        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        />

        {/* Privacy-First Login Persistence Prompt */}
        <LoginPersistenceModal
          visible={showPersistencePrompt}
          onAccept={handlePersistenceAccept}
          onDecline={handlePersistenceDecline}
          isDarkMode={true}
        />



      </SplitAuthLayout>

      {/* Top Level Error Notification removed to prevent layout shift; unified with security banner in formCard */}
    </>
  );
}


// Styles moved inside component for dynamic THEME support and safe Platform evaluation
