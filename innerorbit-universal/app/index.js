/** Purpose: Root entry point handles platform-specific gating (Biometrics, Stealth/Decoy Mode). */
import React, { useEffect } from "react";
import { View, ActivityIndicator, Image } from "react-native";
import { isWeb } from "../utils/platform";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import CalculatorScreen from "./CalcX";
import { BiometricLockScreen } from "../components/auth/BiometricLockScreen";
import { Logger } from "../lib/logger";

import { useAuth } from "../context/auth-context";
import { useAppTheme } from "../store/themeStore";

export default function AppContainer() {
    const { isDecoyMode, isBiometricLocked, authenticateBiometrics, user } = useAuth();
    const { theme: THEME } = useAppTheme();
    const router = useRouter();


    // Keep logic lean: index.js is a gate. _layout.js handles redirects.

    // MOBILE: Biometric Lock Challenge
    if (!isWeb && isBiometricLocked) {
        return <BiometricLockScreen onAuthenticate={authenticateBiometrics} />;
    }

    // MOBILE: Stealth Mode (Calculator)
    if (!isWeb && isDecoyMode) {
        Logger.log("[System] Stealth Active: Loading Calculator UI");
        return <CalculatorScreen />;
    }

    // While redirecting or on web, show nothing (or a splash/loader)
    // On Mobile, after unlock, we bridge the transition with the premium loader
    if (!isWeb) {
        return (
            <View style={{ flex: 1, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style={THEME.background === '#000000' ? "light" : "dark"} />
                <View style={{ marginBottom: 32, padding: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 32 }}>
                    <Image
                        source={require("../assets/InnerOrbit-Logo.png")}
                        style={{ width: 100, height: 100 }}
                        resizeMode="contain"
                    />
                </View>
                <ActivityIndicator size="large" color={THEME.primary} />
            </View>
        );
    }

    // WEB: Explicitly redirect to Login (or Home) to prevent white screen
    if (isWeb) {
        Logger.log("[Index] 🌍 Web Platform detected in index.js");
        // If we are here, _layout hasn't redirected us yet, or we need to nudge it.
        // We use the router to replace, but returning a Loader is safer while it happens.
        setTimeout(() => {
            Logger.log("[Index] ⏳ Redirecting to /login from index fallback...");
            router.replace("/login");
        }, 100);
        return (
            <View style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#fb7185" />
            </View>
        );
    }

    return null;
}
