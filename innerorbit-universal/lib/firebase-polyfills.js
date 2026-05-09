/** Purpose: Browser-style global polyfills (window, self, addEventListener) required for Firebase Compat SDK on Native. */
/**
 * Polyfills for browser globals that Firebase Compat SDK expects on Native.
 * ZERO DEPENDANCIES - Must run before any other module loads.
 */
(function () {
    // Detect if we are in a Native (React Native) environment
    const isNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative' ||
        typeof global !== 'undefined' && !global.window;

    if (isNative) {
        // 1. Ensure window and self exist
        if (typeof window === 'undefined') {
            global.window = global;
        }
        if (typeof self === 'undefined') {
            global.self = global;
        }

        const win = global.window;

        // 2. Event Listener Polyfills (CRITICAL for Compat SDK)
        // We define them directly on global/window to ensure they are found
        if (!win.addEventListener) {
            if (__DEV__) console.log("[System] 🔧 Polyfill: Event Listeners Active");
            win.addEventListener = function () { };
        }
        if (win.addEventListener && typeof win.addEventListener !== 'function') {
            if (__DEV__) console.log("[Polyfill] Fixing non-function window.addEventListener");
            win.addEventListener = function () { };
        }

        if (!win.removeEventListener) {
            win.removeEventListener = function () { };
        }

        // 3. Storage Polyfills
        if (!win.localStorage) {
            win.localStorage = {
                getItem: () => null,
                setItem: () => { },
                removeItem: () => { },
                clear: () => { },
            };
        }
        if (!win.sessionStorage) {
            win.sessionStorage = {
                getItem: () => null,
                setItem: () => { },
                removeItem: () => { },
                clear: () => { },
            };
        }

        // 4. Location Polyfill
        if (!win.location) {
            win.location = {
                hostname: 'localhost',
                protocol: 'https:',
                href: '',
                assign: () => { },
                replace: () => { },
                reload: () => { },
            };
        }

        // 5. UserAgent / Navigator
        if (!win.navigator) {
            win.navigator = {
                userAgent: 'ReactNative',
            };
        }

        // 6. Crypto Polyfill for Native (Required for CryptoJS random)
        if (!win.crypto || !win.crypto.getRandomValues) {
            try {
                // expo-crypto provides a synchronous getRandomValues polyfill
                // We use a try-catch to ensure that if the native module isn't linked, it doesn't crash the app boot
                const ExpoCrypto = require('expo-crypto');
                if (ExpoCrypto && typeof ExpoCrypto.getRandomValues === 'function') {
                    win.crypto = win.crypto || {};
                    win.crypto.getRandomValues = (array) => {
                        try {
                            return ExpoCrypto.getRandomValues(array);
                        } catch (err) {
                            if (__DEV__) console.error("[Polyfill] crypto.getRandomValues execution error:", err);
                            throw err;
                        }
                    };
                    if (__DEV__) console.log("[System] 🛡️ Security: Native Crypto Module Active");
                }
            } catch (e) {
                if (__DEV__) console.warn("[Polyfill] ⚠️ Failed to load expo-crypto for polyfill:", e.message);
                // Fallback: If native crypto fails, CryptoJS will use its own (less secure) fallback or throw.
                // We don't throw here to avoid blocking the entire app launch.
            }
        }

        // 7. WebAssembly Polyfill (Fix for libsodium crash on Android/Hermes)
        if (typeof global.WebAssembly === 'undefined') {
            const Noop = function () { };
            Noop.prototype = {};
            global.WebAssembly = {
                compile: () => Promise.reject(new Error("WebAssembly not supported")),
                instantiate: () => Promise.reject(new Error("WebAssembly not supported")),
                validate: () => false,
                Module: Noop,
                Instance: Noop,
                Memory: Noop,
                Table: Noop,
                Global: Noop,
                LinkError: Noop,
                RuntimeError: Noop,
                CompileError: Noop
            };
            global.WebAssembly.Module.prototype = {};
            global.WebAssembly.Instance.prototype = {};
            global.WebAssembly.Memory.prototype = {};
            global.WebAssembly.Table.prototype = {};
            global.WebAssembly.Global.prototype = {};
        }

        if (__DEV__) console.log("[System] 🌍 Environment: Browser Compatibility Layer Loaded");
    }
})();

