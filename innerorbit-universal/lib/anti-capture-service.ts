/**
 * 🛡️ ANTI-CAPTURE SERVICE
 * 
 * PURPOSE:
 * Prevents screenshots and screen recording across all platforms.
 * 
 * STRATEGY:
 * - Android: uses FLAG_SECURE (native).
 * - iOS: uses expo-screen-capture + detection listeners.
 * - Electron (Desktop): uses setContentProtection(true).
 * - Web: uses PrintScreen detection and CSS protection.
 */

import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';
import { isWeb } from '../utils/platform';
const LoggerModule = require('./logger');
const Logger = LoggerModule.Logger || LoggerModule;

// Check if we are running in Electron
const isElectron = typeof window !== 'undefined' && window.electron && window.electron.isElectron;

export const AntiCaptureService = {
    /**
     * Activates global protection for the current platform.
     */
    activate: async () => {
        try {
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
                await ScreenCapture.preventScreenCaptureAsync();
                Logger.log(`[AntiCapture] 🛡️ Global protection active for ${Platform.OS}`);
            } else if (isElectron) {
                // Electron protection is usually handled in main.js, 
                // but we can also trigger it via IPC if needed.
                if (window.electron && window.electron.setScreenshotProtection) {
                    await window.electron.setScreenshotProtection(true);
                }
                Logger.log("[AntiCapture] 🛡️ Electron content protection active");
            } else if (isWeb) {
                Logger.log("[AntiCapture] ⚠️ Web protection active (Limited to CSS/Key listeners)");
            }
        } catch (e) {
            Logger.error("[AntiCapture] Failed to activate protection", e);
        }
    },

    /**
     * Deactivates global protection (Use with caution).
     */
    deactivate: async () => {
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
            await ScreenCapture.allowScreenCaptureAsync();
        } else if (isElectron) {
            if (window.electron && window.electron.setScreenshotProtection) {
                await window.electron.setScreenshotProtection(false);
            }
        }
    }
};

/**
 * Hook to automatically manage anti-capture life-cycle and web-specific listeners.
 */
export function useAntiCapture() {
    useEffect(() => {
        // Activate on mount
        AntiCaptureService.activate();

        // Web-specific protection (PrintScreen detection)
        if (isWeb && !isElectron) {
            const handleKeyUp = (e: KeyboardEvent) => {
                if (e.key === 'PrintScreen') {
                    // Try to clear clipboard if possible (expo-clipboard could be used)
                    // But mostly we just log it or show a warning
                    Logger.warn("[AntiCapture] ⚠️ Screenshot attempt detected on Web!");
                    alert("SECURITY ALERT: Screenshots are disabled for your protection.");
                }
            };

            window.addEventListener('keyup', handleKeyUp);
            
            // CSS Protection: Disable selection
            document.body.style.userSelect = 'none';
            (document.body.style as any).webkitUserSelect = 'none';

            return () => {
                window.removeEventListener('keyup', handleKeyUp);
                document.body.style.userSelect = 'auto';
                (document.body.style as any).webkitUserSelect = 'auto';
            };
        }

        return () => {
            // We usually want this to stay active for the whole app session, 
            // but if we ever need to deactivate on unmount, we can.
        };
    }, []);
}
