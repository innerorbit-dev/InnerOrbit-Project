/** Purpose: Root entry point handles platform-specific gating (Biometrics, Stealth/Decoy Mode). */
import React, { useEffect } from "react";
import { View } from "react-native";
import { isWeb } from "../utils/platform";
import { useRouter } from "expo-router";
import CalculatorScreen from "./CalcX";
import { BiometricLockScreen } from "../components/auth/BiometricLockScreen";
import { Logger } from "../lib/logger";

import { useAuth } from "../context/auth-context";
import { useAppTheme } from "../store/themeStore";
import { LoadingDots } from "../components/ui/loading-dots";

export default function AppContainer() {
    const { isDecoyMode, isBiometricLocked, authenticateBiometrics, user } = useAuth();
    const { theme: THEME } = useAppTheme();
    const router = useRouter();

    // Redirect unauthenticated users to login (all platforms).
    // Without this, users land on index.js which shows a dead spinner forever
    // because _layout.js routing guard skips the root route for decoy mode.
    useEffect(() => {
        if (!user && !isDecoyMode) {
            Logger.log("[Index] 🚪 User not authenticated → Redirecting to /login");
            router.replace("/login");
        } else if (user && !isDecoyMode) {
            Logger.log("[Index] ✅ User authenticated → Redirecting to /home");
            router.replace("/home");
        }
    }, [user, isDecoyMode]);

    // MOBILE: Biometric Lock Challenge
    if (!isWeb && isBiometricLocked) {
        return <BiometricLockScreen onAuthenticate={authenticateBiometrics} />;
    }

    // MOBILE: Stealth Mode (Calculator)
    if (!isWeb && isDecoyMode) {
        Logger.log("[System] Stealth Active: Loading Calculator UI");
        return <CalculatorScreen />;
    }

    // MOBILE: Return null — _layout.js already shows the single preloader (logo + spinner).
    // Adding a second preloader here caused the duplicate spinner issue on Android.
    if (!isWeb) {
        return null;
    }

    // WEB: Brief transition state while useEffect redirect fires (unchanged)
    return (
        <View style={{ flex: 1, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' }}>
            <LoadingDots color={THEME.primary} size={8} gap={4} />
        </View>
    );
}
