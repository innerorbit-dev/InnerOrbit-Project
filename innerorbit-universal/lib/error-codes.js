/** Purpose: Catalog mapping technical error strings to internal diagnostic codes and suggested fixes. */
// -----------------------------------------------------------------------------
// UNIVERSAL ERROR CODE CATALOG
// -----------------------------------------------------------------------------
// This file maps raw error messages to user-friendly codes and actionable fixes.
// Supported Platforms: Android, iOS, Web, Desktop (Electron)
// -----------------------------------------------------------------------------

export const ERROR_CATALOG = [
    // --- CORE REACT / JAVASCRIPT ---
    {
        code: 'JS_UNDEFINED_OBJ',
        pattern: /undefined is not an object|Cannot read property .* of undefined|Cannot read properties of undefined/,
        title: 'Undefined Object Access',
        fix: 'You are trying to access a property of a variable that is currently undefined. Use optional chaining `?.` or check if the variable exists before accessing.'
    },
    {
        code: 'JS_NULL_POINTER',
        pattern: /null is not an object|Cannot read property .* of null/,
        title: 'Null Pointer Exception',
        fix: 'The variable is explicitly null. Ensure it is initialized or handle the null case.'
    },
    {
        code: 'REACT_RENDER_LOOP',
        pattern: /Maximum update depth exceeded/,
        title: 'Infinite Render Loop',
        fix: 'Check `useEffect` dependencies. You might be updating state inside a `useEffect` that depends on that same state.'
    },
    {
        code: 'REACT_HOOK_RULE',
        pattern: /Rendered fewer hooks than expected|Rendered more hooks than expected/,
        title: 'Rules of Hooks Violation',
        fix: 'Hooks (useState, useEffect) must be called in the same order every time. Do not put hooks inside loops, conditions, or nested functions.'
    },
    {
        code: 'REACT_COMP_REF',
        pattern: /Element type is invalid: expected a string .* but got: undefined/,
        title: 'Invalid Component Import',
        fix: 'You likely have a circular dependency or a named import `import { Comp }` for a default export `export default Comp`. Check your imports.'
    },

    // --- EXPO & NATIVE MODULES ---
    {
        code: 'EXPO_CRYPTO_MISSING',
        pattern: /crypto\.getRandomValues is not a function|Can't find variable: crypto|exposed explicitly by the provider/,
        title: 'Crypto Implementation Missing',
        fix: 'Install `expo-crypto` and import it. If on Web/Chrome, native crypto is available. On bare React Native, you need a polyfill.'
    },
    {
        code: 'EXPO_FONT_LOAD',
        pattern: /fontFamily ".*" is not a system font and has not been loaded/,
        title: 'Font Not Loaded',
        fix: 'The custom font is used before `useFonts` has finished loading. Ensure you wait for `fontsLoaded` before rendering the UI.'
    },
    {
        code: 'NATIVE_MODULE_MISSING',
        pattern: /The package '.*' doesn't seem to be linked|null is not an object \(evaluating '.*\.Constants'\)/,
        title: 'Native Module Unlinked',
        fix: 'Rebuild the dev client (`npx expo run:android`). If using Expo Go, ensure the library is supported in Expo Go.'
    },

    // --- NAVIGATION (EXPO ROUTER) ---
    {
        code: 'NAV_ROUTE_404',
        pattern: /The action '.*' with payload .* was not handled by any navigator|No route named/,
        title: 'Route Not Found',
        fix: 'You are trying to navigate to a screen that is not registered. Check `app/_layout.js` to ensure the `<Stack.Screen name="..." />` exists.'
    },
    {
        code: 'NAV_NESTING_FAIL',
        pattern: /Found screen with the same name as a nested navigator/,
        title: 'Duplicate Screen/Navigator Name',
        fix: 'A screen and a navigator cannot share the same name. Rename the file or the group folder.'
    },

    // --- FIREBASE / BACKEND ---
    {
        code: 'FIREBASE_AUTH_FAIL',
        pattern: /auth\/user-not-found|auth\/wrong-password|auth\/invalid-credential/,
        title: 'Authentication Failed',
        fix: 'The user does not exist or credentials are wrong. Check Firebase Console users list.'
    },
    {
        code: 'FIREBASE_PERM_DENIED',
        pattern: /Missing or insufficient permissions|permission-denied/,
        title: 'Firestore Permission Denied',
        fix: 'Check `firestore.rules`. The current user does not have read/write access to this path.'
    },
    {
        code: 'FIREBASE_NET_FAIL',
        pattern: /network-request-failed|unavailable/,
        title: 'Firebase Connection Issue',
        fix: 'Device is offline or Firebase is unreachable. Check internet connection.'
    },

    // --- WEB / BROWSER SPECIFIC ---
    {
        code: 'WEB_CORS_ERROR',
        pattern: /blocked by CORS policy|Cross-Origin Request Blocked/,
        title: 'CORS Restricted',
        fix: 'The API server does not allow this origin. Update server CORS settings or use a proxy.'
    },
    {
        code: 'WEB_LOCAL_STORAGE',
        pattern: /QuotaExceededError|Failed to execute 'setItem' on 'Storage'/,
        title: 'LocalStorage Full',
        fix: 'The browser storage quota is reached. Clear unused data or switch to IndexedDB/AsyncStorage.'
    },
    {
        code: 'WEB_WINDOW_UNDEFINED',
        pattern: /window is not defined|document is not defined/,
        title: 'SSR / Node Env Error',
        fix: 'You are trying to access browser APIs (`window`, `document`) on the server or during static rendering. Wrap in `useEffect` or check `if (typeof window !== "undefined")`.'
    },

    // --- LUDO GAME SPECIFIC ---
    {
        code: 'LUDO_STATE_ERROR',
        pattern: /Property 'isPaused' doesn't exist|isPaused is not defined/,
        title: 'Ludo Prop Missing',
        fix: 'Pass `isPaused` (or failing prop) from `LudoGame` parent to `Dice` component.'
    }
];

// --- AUTO-DIAGNOSIS FUNCTION ---
export const getErrorData = (error) => {
    if (!error) return null;
    const msg = error.toString();

    // 1. Try to find an exact match in the catalog
    const match = ERROR_CATALOG.find(e => e.pattern.test(msg));
    if (match) return match;

    // 2. Generic Diagnosis based on keywords
    if (msg.includes('Network')) {
        return { code: 'NET_GENERIC', title: 'Network Error', fix: 'Check internet connection and API endpoints.' };
    }
    if (msg.includes('timeout')) {
        return { code: 'TIMEOUT', title: 'Operation Timed Out', fix: 'The request took too long. Check server latency.' };
    }

    // 3. Fallback
    return {
        code: 'ERR_UNKNOWN',
        title: 'Unhandled Exception',
        fix: 'Screenshot this error and send to developer. Check system logs for stack trace.'
    };
};
