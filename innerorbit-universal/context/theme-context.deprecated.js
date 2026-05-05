import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { isMobile } from '../utils/platform';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './auth-context';

const ThemeContext = createContext();

// ----------------------------------------------------------------------------
// 1. DECOY PALETTE (Calculator & Games)
// ----------------------------------------------------------------------------
const DECOY_PALETTE = {
    dark: {
        background: "#0F172A",
        surface: "#1E293B",
        primary: "#fb7185",
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        border: "#334155",
        separator: "rgba(251, 113, 133, 0.1)",
        receivedMsg: "#1E293B",
        sentMsg: "#be185d",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#020617",
        inputBg: "rgba(255,255,255,0.05)",
        card: "#1E293B",
    },
    light: {
        background: "#F1F5F9",
        surface: "#FFFFFF",
        primary: "#fb7185",
        text: "#0F172A",
        textSecondary: "#64748B",
        border: "#CBD5E1",
        separator: "rgba(251, 113, 133, 0.1)",
        receivedMsg: "#E2E8F0",
        sentMsg: "#fb7185",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#F8FAFC",
        inputBg: "rgba(0,0,0,0.05)",
        card: "#FFFFFF",
    }
};

// ----------------------------------------------------------------------------
// 2. CHAT PALETTE (Main Application) - Preserving Current Slate Aesthetic
// ----------------------------------------------------------------------------
const CHAT_PALETTE = {
    dark: {
        background: "#0F172A", // Current Slate
        surface: "#1E293B",
        primary: "#fb7185",
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        border: "#334155",
        separator: "rgba(251, 113, 133, 0.1)",
        receivedMsg: "#1E293B",
        sentMsg: "#be185d",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#020617",
        inputBg: "rgba(255,255,255,0.05)",
        card: "#1E293B",
    },
    light: {
        background: "#F8FAFC", // Ultra clean light slate for Chat
        surface: "#FFFFFF",
        primary: "#fb7185",
        text: "#020617",
        textSecondary: "#475569",
        border: "#E2E8F0",
        separator: "rgba(251, 113, 133, 0.1)",
        receivedMsg: "#F1F5F9",
        sentMsg: "#fb7185",
        success: "#059669",
        error: "#DC2626",
        navRail: "#F1F5F9",
        inputBg: "#FFFFFF",
        card: "#FFFFFF",
    }
};

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [decoyThemePreference, setDecoyThemePreference] = useState('system');
    const [chatThemePreference, setChatThemePreference] = useState('dark');
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        const loadThemes = async () => {
            try {
                let savedDecoy, savedChat;
                if (isMobile) {
                    savedDecoy = await SecureStore.getItemAsync('decoyThemePreference');
                    savedChat = await SecureStore.getItemAsync('chatThemePreference');
                } else {
                    savedDecoy = await AsyncStorage.getItem('decoyThemePreference');
                    savedChat = await AsyncStorage.getItem('chatThemePreference');
                }

                if (savedDecoy) setDecoyThemePreference(savedDecoy);
                if (savedChat) setChatThemePreference(savedChat);
            } catch (e) {
                console.error('Failed to load theme preferences', e);
            } finally {
                setLoading(false);
            }
        };
        loadThemes();
    }, []);

    const toggleTheme = async (pref, side = 'decoy') => {
        try {
            if (side === 'decoy') {
                setDecoyThemePreference(pref);
                if (isMobile) {
                    await SecureStore.setItemAsync('decoyThemePreference', pref);
                } else {
                    await AsyncStorage.setItem('decoyThemePreference', pref);
                }
            } else {
                setChatThemePreference(pref);
                if (isMobile) {
                    await SecureStore.setItemAsync('chatThemePreference', pref);
                } else {
                    await AsyncStorage.setItem('chatThemePreference', pref);
                }
            }
        } catch (e) {
            console.error("Theme save error:", e);
        }
    };

    const getIsDark = (pref) => {
        return pref === 'system' ? systemColorScheme === 'dark' : pref === 'dark';
    };

    const auth = useAuth();
    const isDecoyMode = auth ? auth.isDecoyMode : true;

    // Resolve isolated colors
    const isDark = isDecoyMode ? getIsDark(decoyThemePreference) : getIsDark(chatThemePreference);
    const activePalette = isDecoyMode ? DECOY_PALETTE : CHAT_PALETTE;
    const theme = isDark ? activePalette.dark : activePalette.light;

    const value = {
        theme,
        isDark,
        COLORS: activePalette, // Exports the ACTIVE palette
        decoyTheme: getIsDark(decoyThemePreference) ? DECOY_PALETTE.dark : DECOY_PALETTE.light,
        chatTheme: getIsDark(chatThemePreference) ? CHAT_PALETTE.dark : CHAT_PALETTE.light,
        isDecoyDark: getIsDark(decoyThemePreference),
        isChatDark: getIsDark(chatThemePreference),
        themePreference: isDecoyMode ? decoyThemePreference : chatThemePreference,
        decoyThemePreference,
        chatThemePreference,
        toggleTheme,
        loading
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
