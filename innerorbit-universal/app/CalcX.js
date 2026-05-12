/** Purpose: Stealth calculator shell providing the "front" for the mobile application. */
import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { isWeb, select } from "../utils/platform";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Logger } from "../lib/logger";

import CalculatorComponent from "../components/Calculator";
import FabMenuOptions from "../components/ui/FabMenu";

import { useAppTheme } from "../store/themeStore";
import { LoadingDots } from "../components/ui/loading-dots";
import { useUpdates } from "../hooks/useUpdates";
import UpdateWalkthrough from "../components/update-walkthrough";
import { ErrorBoundary as LocalErrorBoundary } from '../components/error-boundary';
import { DEV_MODE_PLAIN_IDENTITY } from "../lib/identity-security-service";

// Accept onSwitchMode prop for seamless state-based switching
export default function GameScreen({ onSwitchMode }) {
  // Wrap MobileGames in a local ErrorBoundary so render crashes are caught
  // HERE — before Expo Router's route-level handler can show the native RedBox.
  return (
    <LocalErrorBoundary>
      <MobileGames onSwitchMode={onSwitchMode} />
    </LocalErrorBoundary>
  );
}

// ===== MOBILE GAMES COMPONENT (Calculator Only) =====
function MobileGames({ onSwitchMode }) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, isDark, decoyThemePreference: themePreference, toggleTheme } = useAppTheme();
  const updates = useUpdates(false);

  const [savePreference, setSavePreference] = useState(false)
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  const [showInitialLoader, setShowInitialLoader] = useState(true)
  const [shouldCrash, setShouldCrash] = useState(false); // TEST CRASH STATE

  // TRIGGER RENDER CRASH
  if (shouldCrash) {
    throw new Error("Simulated Render Crash");
  }

  // Force Portrait on Mobile (or handle rotation)
  const isLandscape = width > height; // Valid for mobile rotation

  const platformType = isWeb ? 'web' : 'mobile';

  // STRICT RESTRICTION: Mobile Only (Android/iOS)
  // Redirect Desktop/Web users to Home (Chat)
  useEffect(() => {
    if (platformType !== 'mobile') {
      router.replace("/home");
    }
  }, [platformType]);

  // Prevent rendering on non-mobile platforms
  if (platformType !== 'mobile') {
    return <View style={{ flex: 1, backgroundColor: '#0F172A' }} />;
  }

  useEffect(() => {
    const loadState = async () => {
      try {
        // Load Save Preference
        const savedSavePref = await AsyncStorage.getItem("savePreference");
        const isPersistEnabled = savedSavePref === 'true';
        setSavePreference(isPersistEnabled);

      } catch (e) {
        Logger.error("Error loading state", e);
      } finally {
        setIsSettingsLoaded(true);
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    if (isSettingsLoaded) {
      setShowInitialLoader(false);
    }
  }, [isSettingsLoaded])

  // 100% Strict Platform Color Variables (Mobile Only for this component)
  // THEME COLOR GUIDE: Edit these to change the overall look and feel
  const MOBILE_DARK = {
    bg: "#000000",              // [⬛] Main screen background (AMOLED black)
    display: "#000000",         // [⬛] Calculator result area background
    keypad: "#050505",          // [⬛] Near-black depth
    keypadGradient: ["#0a0a0a", "#000000"], // [🌌] Subtle deep space gradient
    btnNumber: ["#1e1e1e", "#0f0f0f"], // [🌑] Premium metallic slate
    btnOp: ["#ec4899", "#9d174d"],     // [🌸] Vibrant Pink -> Deep Rose
    btnEqual: ["#06b6d4", "#0891b2"], // [💎] Electric Cyan -> Deep Teal
    btnTop: ["#334155", "#1e293b"],    // [🌑] Sophisticated Slate
    btnSci: ["#1e293b", "#0a0a0a"],    // [🌑] Slate -> Deep Space
    textMain: "#F8FAFC",               // [⬜] Off-white for comfort
    textAlt: "#94A3B8",                // [🩶] Muted slate text
    border: "transparent",             // [🚫] No borders
  };

  const MOBILE_LIGHT = {
    bg: "#F8FAFC",              // [⬜] Ultra-clean slate white
    display: "#FFFFFF",         // [⬜] Pure white for display
    keypad: "#F1F5F9",          // [⬜] Light slate for depth
    keypadGradient: ["#FFFFFF", "#F1F5F9"], // [⬜] Soft sheen
    btnNumber: ["#FFFFFF", "#F8FAFC"], // [⬜] Pure white top
    btnOp: ["#F472B6", "#DB2777"],     // [🌸] Vibrant Pink -> Rose
    btnEqual: ["#22D3EE", "#0891B2"],  // [💎] Cyan -> Deep Teal
    btnTop: ["#CBD5E1", "#94A3B8"],    // [🩶] Soft silver -> Muted slate
    btnSci: ["#F1F5F9", "#E2E8F0"],    // [⬜] Slate sheen
    textMain: "#0F172A",               // [⬛] Deep slate for contrast
    textAlt: "#64748B",                // [🌑] Slate secondary text
    border: "transparent",             // [🚫] No borders
  };

  const THEME = isDark ? MOBILE_DARK : MOBILE_LIGHT;

  if (!isSettingsLoaded || showInitialLoader) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.bg }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LoadingDots color={THEME.btnOp[0]} size={8} gap={4} />
      </View>
    );
  }

  const updateSavePreference = async (val) => {
    setSavePreference(val);
    await AsyncStorage.setItem("savePreference", String(val));
    if (!val) {
      // Clear history if turned off
      await AsyncStorage.multiRemove(["lastGame", "lastCalcMode", "lastDisplay", "lastHistory"]);
    }
  };

  const switchGame = async (game) => {
    Logger.log(`[CalcX] switchGame called with: ${game}`);
    if (game === 'calculator') {
      setIsFabOpen(false);
      return;
    }

    if (game === 'crash-test') {
      setShouldCrash(true);
      setIsFabOpen(false);
      return;
    }

    try {
      Logger.log(`[CalcX] Pushing route: /game/${game}`);
      router.push(`/game/${game}`);
    } catch (e) {
      console.error('[CalcX] Navigation error:', e);
    }
    setIsFabOpen(false);
  };


  // Main Container
  return (
    <View style={[
      styles.container,
      { paddingHorizontal: 0, backgroundColor: THEME.bg, width: '100%', paddingTop: insets.top } // Dynamic Safe Area
    ]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Main Container */}
      <>
        {DEV_MODE_PLAIN_IDENTITY && (
          <View style={{
            backgroundColor: '#EF4444',
            paddingVertical: 8,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <MaterialCommunityIcons name="shield-off" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
              SECURITY ALERT: Identity saved in PLAIN TEXT (Dev Mode)
            </Text>
          </View>
        )}
        <View style={{ flex: 1, width: '100%', flexDirection: isLandscape ? 'row' : 'column' }}>
          <CalculatorComponent
            onSwitchMode={onSwitchMode}
            setIsHistoryOpen={setIsHistoryOpen}
            themeProps={{
              THEME, isDark, themePreference, toggleTheme, platformType,
              savePreference, updateSavePreference, MOBILE_DARK, MOBILE_LIGHT,
              onTriggerUpdate: () => updates.setShowUpdateWalkthrough(true)
            }}
          />
        </View>

        {/* Floating Game Switcher (FAB) - Bottom Left */}
        {platformType === 'mobile' && !isHistoryOpen && (
          <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 20) + 10, left: 24, alignItems: 'flex-start', zIndex: 50 }}>
            {/* Expanded Menu Items (Animated) */}
            {isFabOpen && <FabMenuOptions switchGame={switchGame} setIsFabOpen={setIsFabOpen} isDark={isDark} THEME={THEME} currentGame={'calculator'} />}

            {/* Main FAB Toggle */}
            <Pressable
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: isFabOpen ? THEME.textMain : (isDark ? '#334155' : '#FFFFFF'),
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 60,
                ...select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  },
                  android: {
                    elevation: 50,
                  },
                  web: {
                    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
                  }
                })
              }}
              onPress={() => setIsFabOpen(!isFabOpen)}
            >
              <MaterialCommunityIcons
                name={isFabOpen ? "close" : "apps"}
                size={28}
                color={isFabOpen ? THEME.bg : '#A855F7'} // Electric Violet
              />
            </Pressable>
          </View>
        )}
      </>
      <UpdateWalkthrough
        visible={updates.showUpdateWalkthrough}
        onClose={updates.handleCloseWalkthrough}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
  },
});
