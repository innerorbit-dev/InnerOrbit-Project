/** Purpose: Global error overlay suppression (Nuclear Lockdown) for production-fidelity error handling in development. */
import { NativeModules, LogBox, Platform } from 'react-native';
import { isWeb } from '../utils/platform';
import { Logger } from './logger';

/**
 * (ULTIMATE EDITION)
 * This must be imported at the VERY TOP of app/_layout.js
 */
const ENABLE_SUPPRESSION = false;

(function lockdown() {
    if (!ENABLE_SUPPRESSION) {
        Logger.log("⚠️ RedBox Suppression DISABLED for debugging.");
        return;
    }

    // NUCLEAR LOCKDOWN: Always active to prevent RedBox overlays in both
    // development and release builds, ensuring ErrorBoundary is the primary UI.
    try {
        // 1. Set global flags for Expo
        const setGlobalFlag = (key, val) => {
            try {
                global[key] = val;
                Object.defineProperty(global, key, {
                    value: val,
                    writable: false,
                    configurable: false
                });
            } catch (e) { /* ignore */ }
        };

        setGlobalFlag('__expo_disable_error_overlay', true);
        setGlobalFlag('__expo_disable_redbox', true);

        // 2. Standard LogBox suppression
        LogBox.ignoreAllLogs(true);
        LogBox.ignoreLogs([
            'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError',
            'ErrorBoundary', 'ExceptionsManager', 'getValue', 'operators',
            'null is not an object', 'undefined is not an object', 'cannot read property',
            'is not a function', 'Module not found', 'Network request failed'
        ]);

        // 3. Native ExceptionsManager Suppression
        const { ExceptionsManager } = NativeModules;
        if (ExceptionsManager) {
            const noop = () => { };
            const safeLock = (obj, prop, val) => {
                if (!obj) return;
                try {
                    Object.defineProperty(obj, prop, {
                        get: () => val,
                        set: () => { /* Prevent override */ },
                        configurable: false,
                        enumerable: true
                    });
                } catch (e) {
                    try { obj[prop] = val; } catch (e2) { /* Already locked */ }
                }
            };

            safeLock(ExceptionsManager, 'reportFatalException', (m) => {
                Logger.log(`💊 [Suppressed Fatal]: ${m}`);
                if (global.__triggerErrorBoundary) {
                    global.__triggerErrorBoundary(new Error(m));
                }
            });
            safeLock(ExceptionsManager, 'reportSoftException', (m) => Logger.log(`💊 [Suppressed Soft]: ${m}`));
            safeLock(ExceptionsManager, 'updateExceptionMessage', noop);
            safeLock(ExceptionsManager, 'dismissRedbox', noop);
        }

        // 4. Immutable Console.error Suppression
        const noop = () => { };
        const suppressError = (...args) => {
            const msg = args[0]?.toString() || "";
            const dangerousKeywords = [
                "useAuth", "ErrorBoundary", "Simulated", "TypeError", "ReferenceError",
                "RangeError", "SyntaxError", "null is not", "undefined is not",
                "cannot read", "is not a function", "rendererror"
            ];

            if (dangerousKeywords.some(kw => msg.includes(kw))) {
                return;
            }
            Logger.log(`🛑 [Suppressed System Error]: ${args[0]}`);
        };

        try {
            Object.defineProperty(console, 'error', {
                value: suppressError,
                writable: false,
                configurable: false
            });
            Object.defineProperty(console, 'warn', {
                value: noop, // Suppress warnings entirely as requested for "locked down" feel
                writable: false,
                configurable: false
            });
        } catch (e) {
            console.error = suppressError;
        }

        // 5. Override Native Logging Hook (Used by some RN versions for RedBox)
        if (global.nativeLoggingHook) {
            const originalHook = global.nativeLoggingHook;
            global.nativeLoggingHook = (message, level) => {
                if (level >= 3) { // 3 = error, 4 = fatal
                    Logger.log(`☢️ [Native Hook Suppress]: ${message}`);
                    return;
                }
                originalHook(message, level);
            };
        }

        // 6. Native bridge exception reporting
        if (typeof console.reportErrorsAsExceptions !== 'undefined') {
            try {
                Object.defineProperty(console, 'reportErrorsAsExceptions', {
                    value: false,
                    writable: false,
                    configurable: false
                });
            } catch (e) {
                console.reportErrorsAsExceptions = false;
            }
        }

        // 7. Global Error Handler Resilience (Heartbeat)
        const silenceGlobal = () => {
            if (global.ErrorUtils) {
                try {
                    // Don't just set it, LOCK it if possible
                    const handler = (error, isFatal) => {
                        Logger.log(`☢️ [Global Suppressor]: ${error?.message || error}`);
                        if (isFatal && global.__triggerErrorBoundary) {
                            global.__triggerErrorBoundary(error);
                        }
                    };

                    if (global.ErrorUtils.getGlobalHandler() !== handler) {
                        global.ErrorUtils.setGlobalHandler(handler, true);
                    }
                } catch (e) { }
            }
        };

        silenceGlobal();
        setInterval(silenceGlobal, 500); // More frequent check

        // 8. Disable Native DevSettings (Menu / Overlays)
        const { DevSettings } = NativeModules;
        if (DevSettings && DevSettings.setIsShakeToShowDevMenuEnabled) {
            try {
                DevSettings.setIsShakeToShowDevMenuEnabled(false);
            } catch (e) { }
        }

        // 9. Web-specific Promise Rejection Suppression (GIS Noise)
        if (isWeb && typeof window !== 'undefined') {
            window.addEventListener('unhandledrejection', (event) => {
                const msg = event.reason?.message || event.reason?.toString() || "";
                if (msg.includes('message channel closed') || msg.includes('Google Identity Services')) {
                    event.preventDefault();
                    event.stopPropagation();
                    Logger.log("💊 [Web] Suppressed GIS noise: " + msg);
                }
            });
        }

        Logger.log("☢️ NUCLEAR RedBox Lockdown Active (Locked & Loaded)");
    } catch (e) {
        // Absolute fail-safe
    }
})();
