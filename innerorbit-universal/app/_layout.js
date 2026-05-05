/** Purpose: Global layout wrapper managing providers, fonts, auth redirects, and shared UI. */
import '../lib/suppress-redbox';
import React, { useState, useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, View, Text, StyleSheet, Keyboard, LogBox, Alert, Animated, Easing, NativeModules, Image } from "react-native";
import { isWeb } from "../utils/platform";
import { AuthProvider, useAuth } from "../context/auth-context";
import { useAppTheme } from "../store/themeStore";
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { NetworkProvider } from '../context/network-context';
import { SessionExpiredModal } from '../components/session-expired-modal';
import { NetworkStatusBanner } from '../components/ui/network-status-banner';
import { UpdatePillNotification } from '../components/ui/update-pill-notification';
import { ShieldOverlay } from '../components/ui/ShieldOverlay';
import { requestNotificationPermissions } from '../lib/notification-service';
import { Logger } from '../lib/logger';
import { registerBackgroundUpdateTask } from '../lib/background-tasks';
import InstallerWizard from '../components/setup/InstallerWizard';
import DesktopTitleBar from '../components/ui/DesktopTitleBar';
import { LOGO_BASE64 } from '../lib/logo-base64';

import { ErrorBoundary as CustomErrorBoundary } from '../components/error-boundary';
export { CustomErrorBoundary as ErrorBoundary };

// --- MAIN LAYOUT ---
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CustomErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NetworkProvider>
            <AuthProvider>
              <BottomTabBarHeightContext.Provider value={0}>
                <RootLayoutNav />
              </BottomTabBarHeightContext.Provider>
              <StatusBar style="auto" />
            </AuthProvider>
          </NetworkProvider>
        </GestureHandlerRootView>
      </CustomErrorBoundary>
    </SafeAreaProvider>
  );
}

// --- CONFIGURATION ---
WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading: authLoading, isLoggingOut, isDecoyMode, isUnlocking, welcomeData } = useAuth();
  const { theme, loading: themeLoading } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontsError] = useFonts({
    Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsError) throw fontsError;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        require('../global.css');
        document.title = "InnerOrbit";
        const style = document.createElement('style');
        style.textContent = `
            #webpack-dev-server-client-overlay-div { display: none !important; }
            #expo-error-overlay { display: none !important; }
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #0F172A; }
            ::-webkit-scrollbar-thumb { background: #F43F5E; border-radius: 10px; border: 2px solid #0F172A; }
            ::-webkit-scrollbar-thumb:hover { background: #FB7185; }
            input:-webkit-autofill {
                -webkit-text-fill-color: white !important;
                -webkit-box-shadow: 0 0 0px 1000px #0F172A inset !important;
                transition: background-color 5000s ease-in-out 0s;
            }
          `;
        document.head.appendChild(style);
      } catch (e) { }
    }
  }, [fontsError]);

  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const prevUser = useRef(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    isNavigatingRef.current = false;
    Logger.log(`[Layout] 🧭 Navigation Segment: ${segments.join('/') || 'Root'}`);
  }, [segments]);

  useEffect(() => {
    if (prevUser.current && !user && !isLoggingOut) {
      if (isWeb) setShowExpiredModal(true);
    }
    prevUser.current = user;
  }, [user, isLoggingOut]);

  // --- INSTALLER MODE LOGIC ---
  const [isSetupMode, setIsSetupMode] = useState(false);
  useEffect(() => {
    // Safe check for platform
    // isWeb is already imported

    if (isWeb && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);

      // ONLY show setup if it's Electron AND Windows
      const isWindowsElectron = window.electron && window.electron.platform === 'win32';
      const mode = urlParams.get('mode');

      if (mode === 'setup' && isWindowsElectron) {
        setIsSetupMode(true);
      } else if (window.electron) {
        // Just in case we bypassed setup, ensure window controls are enabled
        // Calling this ensures maximize/minimize are enabled for the login screen
        window.electron.completeSetup().catch(() => { });
      }
    }
  }, []);

  const handleSetupComplete = async () => {
    if (isWeb && window.electron) {
      try {
        await window.electron.completeSetup();
        setIsSetupMode(false);
        // Force refresh to clear mode=setup from URL
        if (typeof window !== 'undefined') {
          window.location.search = '';
        }
      } catch (e) {
        Logger.error('Setup completion failed:', e);
      }
    } else {
      setIsSetupMode(false);
    }
  };

  useEffect(() => {
    requestNotificationPermissions().catch(err => Logger.log('Perms denied:', err));
    if (!isWeb) {
      registerBackgroundUpdateTask().catch(err => Logger.error('Background task error:', err));
    }
  }, []);

  const isReady = fontsLoaded && !authLoading && !themeLoading;
  const isPublicRoute = segments.length === 0 || segments[0] === "login" || segments[0] === "signup";
  const shouldBlockRender = isReady && user && isPublicRoute && !(isDecoyMode && segments.length === 0) && !welcomeData;

  useEffect(() => {
    if (!isReady || isLoggingOut) return;
    const isPrivate = segments[0] === "home" || segments[0] === "chat-detail";
    const isDecoy = segments.length === 0 || segments[0] === "CalcX";
    const isAuth = segments[0] === "login" || segments[0] === "signup";

    if (!user) {
      if (isPrivate && !isNavigatingRef.current) {
        Logger.log(`[Layout] 👮 Private route [${segments[0]}] protected -> Redirecting to Root`);
        isNavigatingRef.current = true;
        router.replace("/");
      } else if (!isDecoyMode && isDecoy && segments[0] !== 'login' && !isNavigatingRef.current) {
        Logger.log("[Layout] 👮 Public route protected -> Redirecting to Login");
        isNavigatingRef.current = true;
        router.replace("/login");
      }
    } else {
      if (isWeb || !isDecoyMode) {
        if ((isDecoy || isAuth) && !isNavigatingRef.current && !welcomeData) {
          Logger.log("[Layout] 🛡️ Auth/Decoy route detected while logged in -> Redirecting to Home");
          isNavigatingRef.current = true;
          router.replace("/home");
        }
      }
    }
  }, [user, segments, isReady, isDecoyMode]);

  useEffect(() => {
    if (isReady) {
      Logger.log("[Layout] ✨ Everything Ready (Fonts, Auth, Theme) -> Hiding Splash");
      SplashScreen.hideAsync();
      if (typeof window !== 'undefined' && window.electron && typeof window.electron.hidePreloader === 'function') {
        window.electron.hidePreloader();
      }
    }
  }, [isReady]);

  // --- PRELOADER ANIMATION ---
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isReady || shouldBlockRender) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: !isWeb
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: !isWeb
          })
        ])
      ).start();
    }
  }, [isReady, shouldBlockRender]);

  if (isSetupMode) {
    return <InstallerWizard onComplete={handleSetupComplete} />;
  }

  if (!isReady || shouldBlockRender) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}>
        <StatusBar style={theme.background === '#000000' ? "light" : "dark"} />
        <View style={{ marginBottom: 32, padding: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 32 }}>
          <Animated.Image
            source={{ uri: LOGO_BASE64 }}
            style={{
              width: 100,
              height: 100,
              transform: [{ scale: pulseAnim }]
            }}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  try {
    return (
      <>
        <DesktopTitleBar THEME={theme} />
        <NetworkStatusBanner isDecoyMode={isDecoyMode} />
        <UpdatePillNotification isDecoyMode={isDecoyMode} />
        <ShieldOverlay visible={isUnlocking} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'none' }} />
          <Stack.Screen name="login" options={{ gestureEnabled: false, animation: 'none' }} />
          <Stack.Screen name="signup" options={{ gestureEnabled: false, animation: 'none' }} />
          <Stack.Screen name="home" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat-detail" options={{ animation: 'none' }} />
          <Stack.Screen name="game/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="CalcX" options={{ animation: 'fade' }} />
          <Stack.Screen name="user-profile" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <SessionExpiredModal
          visible={showExpiredModal}
          onConfirm={() => setShowExpiredModal(false)}
          theme={theme}
        />
      </>
    );
  } catch (e) {
    // If Stack or custom components crash during render, 
    // we return a minimal UI so the outer ErrorBoundary can catch it or we show this.
    return (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 40, justifyContent: 'center' }}>
        <Text style={{ color: '#FF5555', fontSize: 24, fontWeight: 'bold' }}>Navigation Error</Text>
        <Text style={{ color: '#FFF', marginTop: 10 }}>{e.message}</Text>
      </View>
    );
  }
}
