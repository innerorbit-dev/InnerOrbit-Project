/** Purpose: Suppress Expo/React-Native visual error overlays while preserving minimal console output. */
import { NativeModules, LogBox } from 'react-native';
import { isWeb } from '../utils/platform';
import { Logger } from './logger';

/**
 * OVERLAY-ONLY SUPPRESSION (Minimal Console Edition)
 * - Suppresses the full-screen RedBox / Expo error overlay UI.
 * - Console.log remains fully functional.
 * - console.error/warn are throttled & deduplicated to prevent terminal overload.
 * - Must be imported at the VERY TOP of app/_layout.js.
 */
(function suppressOverlays() {
    try {
        // --- DEDUP + THROTTLE ENGINE ---
        // Prevents the same error from flooding the terminal.
        const _seen = new Map(); // key → timestamp of last log
        const THROTTLE_MS = 5000; // Same message suppressed for 5s
        const MAX_MSG_LEN = 120;  // Truncate long messages

        const logOnce = (prefix, msg) => {
            const short = String(msg || '').slice(0, MAX_MSG_LEN);
            const key = prefix + short;
            const now = Date.now();
            if (_seen.has(key) && (now - _seen.get(key)) < THROTTLE_MS) return;
            _seen.set(key, now);
            // Periodic cleanup (keep map from growing indefinitely)
            if (_seen.size > 50) {
                for (const [k, t] of _seen) { if (now - t > 30000) _seen.delete(k); }
            }
            Logger.log(`${prefix}${short}`);
        };

        // 1. Expo-specific global flags to disable their error overlay
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
        setGlobalFlag('__DEV_HIDE_ERRORS__', true);

        // 2. LogBox: Suppress the VISUAL log overlay
        LogBox.ignoreAllLogs(true);

        // 3. Prevent console.error from becoming native exceptions (main RedBox trigger)
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

        // 4. Throttle console.error & console.warn to prevent terminal flood
        const _origError = console.error;
        const _origWarn = console.warn;

        // Noise patterns to drop entirely (never log these)
        const DROP_PATTERNS = [
            'message channel closed', 'disconnected port', 'Google Identity Services',
            'unload is not allowed', 'ExceptionsManager', 'rendererror',
            'Each child in a list', 'VirtualizedList', 'componentWillReceiveProps',
            'componentWillMount', 'Require cycle'
        ];

        console.error = (...args) => {
            const msg = String(args[0] || '');
            if (DROP_PATTERNS.some(p => msg.includes(p))) return;
            logOnce('🛑 ', msg);
        };

        console.warn = (...args) => {
            const msg = String(args[0] || '');
            if (DROP_PATTERNS.some(p => msg.includes(p))) return;
            logOnce('⚠️ ', msg);
        };

        // 5. Native ExceptionsManager — redirect to ErrorBoundary, log minimally
        const { ExceptionsManager } = NativeModules;
        if (ExceptionsManager) {
            const safeLock = (obj, prop, val) => {
                if (!obj) return;
                try {
                    Object.defineProperty(obj, prop, {
                        get: () => val,
                        set: () => { },
                        configurable: false,
                        enumerable: true
                    });
                } catch (e) {
                    try { obj[prop] = val; } catch (e2) { }
                }
            };

            safeLock(ExceptionsManager, 'reportFatalException', (message) => {
                logOnce('💊 [Fatal]: ', message);
                if (global.__triggerErrorBoundary) {
                    global.__triggerErrorBoundary(new Error(message));
                }
            });
            safeLock(ExceptionsManager, 'reportSoftException', (message) => {
                logOnce('💊 [Soft]: ', message);
            });
            safeLock(ExceptionsManager, 'updateExceptionMessage', () => { });
            safeLock(ExceptionsManager, 'dismissRedbox', () => { });
        }

        // 6. Native logging hook — block overlay-level triggers
        if (global.nativeLoggingHook) {
            const originalHook = global.nativeLoggingHook;
            global.nativeLoggingHook = (message, level) => {
                if (level >= 3) {
                    logOnce('☢️ ', message);
                    return;
                }
                originalHook(message, level);
            };
        }

        // 7. Global ErrorUtils — catch unhandled JS errors
        const silenceGlobal = () => {
            if (global.ErrorUtils) {
                try {
                    const handler = (error, isFatal) => {
                        logOnce('☢️ [Unhandled]: ', error?.message || error);
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
        setInterval(silenceGlobal, 500);

        // 8. Disable shake-to-show dev menu
        const { DevSettings } = NativeModules;
        if (DevSettings && DevSettings.setIsShakeToShowDevMenuEnabled) {
            try {
                DevSettings.setIsShakeToShowDevMenuEnabled(false);
            } catch (e) { }
        }

        // 9. Web-specific: suppress GIS/extension noise entirely
        if (isWeb && typeof window !== 'undefined') {
            window.addEventListener('unhandledrejection', (event) => {
                const msg = event.reason?.message || event.reason?.toString() || '';
                if (DROP_PATTERNS.some(p => msg.includes(p))) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }

        Logger.log("🛡️ Overlay Suppression Active (throttled console)");
    } catch (e) {
        // Absolute fail-safe
    }
})();
