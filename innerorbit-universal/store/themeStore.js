/**
 * Purpose: Central Zustand store for application-wide persistent state. Manages theme 
 * palettes (Decoy vs Chat), privacy settings, and stealth configuration with secure storage.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'react-native';
import { isWeb } from '../utils/platform';
import React from 'react';

// ----------------------------------------------------------------------------
// 1. DECOY PALETTE (Calculator & Games)
// ----------------------------------------------------------------------------
export const DECOY_PALETTE = {
    dark: {
        background: "#000000",
        surface: "#000000",
        primary: "#fb7185", // Rose Pink
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        border: "#fb7185", // Rose Pink
        separator: "rgba(251, 113, 133, 0.2)",
        receivedMsg: "#1E293B",
        sentMsg: "#be185d",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#000000",
        inputBg: "rgba(255,255,255,0.05)",
        card: "#1E293B",
        warning: "#EAB308",
        info: "#3B82F6",
        subInfo: "rgba(59, 130, 246, 0.1)",
        actionBackground: "rgba(255,255,255,0.05)",
    },
    light: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        primary: "#fb7185",
        text: "#0F172A",
        textSecondary: "#64748B",
        border: "#fb7185", // Rose Pink
        separator: "rgba(251, 113, 133, 0.2)",
        receivedMsg: "#E2E8F0",
        sentMsg: "#fb7185",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#F8FAFC",
        inputBg: "rgba(0,0,0,0.05)",
        card: "#FFFFFF",
        warning: "#CA8A04",
        info: "#2563EB",
        subInfo: "rgba(37, 99, 235, 0.08)",
        actionBackground: "rgba(0,0,0,0.03)",
    }
};

// ----------------------------------------------------------------------------
// 2. CHAT PALETTE (Main Application) - Preserving Current Slate Aesthetic
// ----------------------------------------------------------------------------
export const CHAT_PALETTE = {
    dark: {
        background: "#000000", // AMOLED Black
        surface: "#000000",
        primary: "#fb7185",
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        border: "#fb7185", // Rose Pink
        separator: "rgba(251, 113, 133, 0.2)",
        receivedMsg: "#1E293B",
        sentMsg: "#be185d",
        success: "#10B981",
        error: "#EF4444",
        navRail: "#020617",
        inputBg: "rgba(255,255,255,0.05)",
        card: "#1E293B",
        warning: "#EAB308",
        info: "#3B82F6",
        subInfo: "rgba(59, 130, 246, 0.1)",
        actionBackground: "rgba(255,255,255,0.05)",
    },
    light: {
        background: "#F8FAFC", // Ultra clean light slate for Chat
        surface: "#FFFFFF",
        primary: "#fb7185",
        text: "#020617",
        textSecondary: "#475569",
        border: "#fb7185", // Rose Pink
        separator: "rgba(251, 113, 133, 0.2)",
        receivedMsg: "#1E293B",
        sentMsg: "#fb7185",
        success: "#059669",
        error: "#DC2626",
        navRail: "#F1F5F9",
        inputBg: "#FFFFFF",
        card: "#FFFFFF",
        warning: "#B45309",
        info: "#2563EB",
        subInfo: "rgba(37, 99, 235, 0.08)",
        actionBackground: "rgba(0,0,0,0.03)",
    }
};

// ----------------------------------------------------------------------------
// 3. BUBBLE THEMES — Custom sent/received bubble colors
// ----------------------------------------------------------------------------
export const BUBBLE_THEMES = {
    rose: { key: 'rose', label: 'Rose', sentDark: '#be185d', receivedDark: '#1E293B', sentLight: '#fb7185', receivedLight: '#E2E8F0' },
    ocean: { key: 'ocean', label: 'Ocean', sentDark: '#0369a1', receivedDark: '#082f49', sentLight: '#0ea5e9', receivedLight: '#e0f2fe' },
    forest: { key: 'forest', label: 'Forest', sentDark: '#15803d', receivedDark: '#052e16', sentLight: '#16a34a', receivedLight: '#dcfce7' },
    sunset: { key: 'sunset', label: 'Sunset', sentDark: '#c2410c', receivedDark: '#431407', sentLight: '#ea580c', receivedLight: '#ffedd5' },
    violet: { key: 'violet', label: 'Violet', sentDark: '#7c3aed', receivedDark: '#2e1065', sentLight: '#8b5cf6', receivedLight: '#ede9fe' },
    midnight: { key: 'midnight', label: 'Midnight', sentDark: '#1e3a8a', receivedDark: '#0f172a', sentLight: '#2563eb', receivedLight: '#dbeafe' },
    gold: { key: 'gold', label: 'Gold', sentDark: '#b45309', receivedDark: '#231407', sentLight: '#d97706', receivedLight: '#fef9c3' },
    coral: { key: 'coral', label: 'Coral', sentDark: '#e11d48', receivedDark: '#4c0519', sentLight: '#f43f5e', receivedLight: '#ffe4e6' },
};

// ----------------------------------------------------------------------------
// 4. CHAT BACKGROUND STYLES
// ----------------------------------------------------------------------------
export const CHAT_BG_STYLES = {
    clean: { key: 'clean', label: 'Clean', bgDark: null, bgLight: null },
    dots: { key: 'dots', label: 'Dots', bgDark: '#090f1c', bgLight: '#f0f4f8' },
    grid: { key: 'grid', label: 'Grid', bgDark: '#050a14', bgLight: '#eef2f7' },
    midnight: { key: 'midnight', label: 'Midnight', bgDark: '#000814', bgLight: '#0a1628' },
    rose: { key: 'rose', label: 'Blush', bgDark: '#1a050c', bgLight: '#fff0f3' },
    ocean: { key: 'ocean', label: 'Ocean', bgDark: '#010d1a', bgLight: '#f0f8ff' },
};

// Custom storage adapter to handle SecureStore on mobile vs AsyncStorage on web
const secureStorage = {
    getItem: async (name) => {
        try {
            if (isWeb) {
                return await AsyncStorage.getItem(name);
            } else {
                return await SecureStore.getItemAsync(name);
            }
        } catch (e) {
            Logger.error(`[ThemeStore] Failed to get item ${name}:`, e);
            return null;
        }
    },
    setItem: async (name, value) => {
        try {
            if (isWeb) {
                await AsyncStorage.setItem(name, value);
            } else {
                await SecureStore.setItemAsync(name, value);
            }
        } catch (e) {
            Logger.error(`[ThemeStore] Failed to set item ${name}:`, e);
        }
    },
    removeItem: async (name) => {
        try {
            if (isWeb) {
                await AsyncStorage.removeItem(name);
            } else {
                await SecureStore.deleteItemAsync(name);
            }
        } catch (e) {
            Logger.error(`[ThemeStore] Failed to remove item ${name}:`, e);
        }
    },
};

export const useAppStore = create(
    persist(
        (set, get) => ({
            // --- Theme State ---
            decoyThemePreference: 'system',
            chatThemePreference: 'system',
            chatBubbleThemeKey: 'rose',
            chatBgStyleKey: 'clean',

            // --- Privacy State ---
            privacyLevel: 0, // 0: Normal, 1: Private, 2: Camouflage, 3: Auto Safety, 99: Emergency
            decoyPin: '',
            panicTrigger: false,
            autoSafetySettings: {
                gyroShake: false,
                faceDown: false,
                pocketDetect: false,
                altTab: false,
                mouseIdle: false,
                minimizeBlur: false
            },
            emergencyAutoActivation: false,
            sharePresence: true,
            isDecoyMode: true, // Managed by AuthProvider but stored here to break cycles

            // --- Stealth State ---
            stealthMode: 'header_lock', // 'header_lock', 'code', 'display_triple'
            stealthButton: 'display',
            stealthCode: '7331',
            biometricsEnabled: false,
            appLockEnabled: false,
            lastStealthChange: null,

            // --- Theme Actions ---
            toggleTheme: async (pref, side = 'decoy') => {
                set({
                    decoyThemePreference: pref,
                    chatThemePreference: pref
                });
            },
            setChatBubbleTheme: (key) => set({ chatBubbleThemeKey: key }),
            setChatBgStyle: (key) => set({ chatBgStyleKey: key }),

            // --- Privacy Actions ---
            setPrivacyLevel: (level) => set({ privacyLevel: level }),
            setDecoyPin: (pin) => set({ decoyPin: pin }),
            setPanicTrigger: (val) => set({ panicTrigger: val }),
            setAutoSafetySettings: (settings) => set({ autoSafetySettings: settings }),
            updateAutoSafetySetting: (key, val) => set((state) => ({
                autoSafetySettings: { ...state.autoSafetySettings, [key]: val }
            })),
            setEmergencyAutoActivation: (val) => set({ emergencyAutoActivation: val }),
            setSharePresence: (val) => set({ sharePresence: val }),
            setDecoyMode: (val) => set({ isDecoyMode: val }),

            // --- Stealth Actions ---
            setStealthMode: (mode) => set({ stealthMode: mode, lastStealthChange: Date.now() }),
            setStealthButton: (btn) => set({ stealthButton: btn }),
            setStealthCode: (code) => set({ stealthCode: code }),
            setBiometricsEnabled: (val) => set({ biometricsEnabled: val }),
            setAppLockEnabled: (val) => set({ appLockEnabled: val }),

            // Getters for derived state
            getIsDark: (pref, systemColorScheme) => {
                return pref === 'system' ? systemColorScheme === 'dark' : pref === 'dark';
            }
        }),
        {
            name: 'innerorbit-app-storage',
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({
                decoyThemePreference: state.decoyThemePreference,
                chatThemePreference: state.chatThemePreference,
                chatBubbleThemeKey: state.chatBubbleThemeKey,
                chatBgStyleKey: state.chatBgStyleKey,
                privacyLevel: state.privacyLevel,
                decoyPin: state.decoyPin,
                panicTrigger: state.panicTrigger,
                autoSafetySettings: state.autoSafetySettings,
                emergencyAutoActivation: state.emergencyAutoActivation,
                stealthMode: state.stealthMode,
                stealthButton: state.stealthButton,
                stealthCode: state.stealthCode,
                biometricsEnabled: state.biometricsEnabled,
                appLockEnabled: state.appLockEnabled,
                lastStealthChange: state.lastStealthChange,
                sharePresence: state.sharePresence,
                isDecoyMode: state.isDecoyMode,
            }),
        }
    )
);

// Keep useThemeStore as an alias for backward compatibility
export const useThemeStore = useAppStore;

// HOOK: useAppTheme
// This hook bridges the gap between the App Store and the rest of the application.
// It automatically detects Auth state (Decoy Mode) to serve the correct palette.
export const useAppTheme = () => {
    const systemColorScheme = useColorScheme();
    const { 
        decoyThemePreference, 
        chatThemePreference, 
        toggleTheme, 
        getIsDark, 
        chatBubbleThemeKey, 
        chatBgStyleKey, 
        setChatBubbleTheme, 
        setChatBgStyle,
        isDecoyMode
    } = useAppStore();

    const isDark = isDecoyMode
        ? getIsDark(decoyThemePreference, systemColorScheme)
        : getIsDark(chatThemePreference, systemColorScheme);

    const activePalette = isDecoyMode ? DECOY_PALETTE : CHAT_PALETTE;
    let theme = isDark ? activePalette.dark : activePalette.light;

    // Apply custom bubble theme override (only in chat mode)
    if (!isDecoyMode && chatBubbleThemeKey && BUBBLE_THEMES[chatBubbleThemeKey]) {
        const bt = BUBBLE_THEMES[chatBubbleThemeKey];
        theme = {
            ...theme,
            sentMsg: isDark ? bt.sentDark : bt.sentLight,
            receivedMsg: isDark ? bt.receivedDark : bt.receivedLight,
        };
    }

    // Resolve background style
    const bgStyleDef = CHAT_BG_STYLES[chatBgStyleKey] || CHAT_BG_STYLES.clean;
    const chatBgStyle = {
        key: bgStyleDef.key,
        color: isDark ? bgStyleDef.bgDark : bgStyleDef.bgLight,
    };

    const toggleAppTheme = (pref) => {
        const targetSide = isDecoyMode ? 'decoy' : 'chat';
        toggleTheme(pref, targetSide);
    };

    return {
        theme,
        isDark,
        COLORS: activePalette,
        decoyTheme: getIsDark(decoyThemePreference, systemColorScheme) ? DECOY_PALETTE.dark : DECOY_PALETTE.light,
        chatTheme: getIsDark(chatThemePreference, systemColorScheme) ? CHAT_PALETTE.dark : CHAT_PALETTE.light,
        isDecoyDark: getIsDark(decoyThemePreference, systemColorScheme),
        isChatDark: getIsDark(chatThemePreference, systemColorScheme),
        themePreference: isDecoyMode ? decoyThemePreference : chatThemePreference,
        decoyThemePreference,
        chatThemePreference,
        toggleTheme: toggleAppTheme, // Return the bound version
        chatBubbleThemeKey,
        chatBgStyleKey,
        chatBgStyle,
        setChatBubbleTheme,
        setChatBgStyle,
        loading: false
    };
};
