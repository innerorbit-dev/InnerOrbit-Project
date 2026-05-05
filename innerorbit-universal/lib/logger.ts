/** Purpose: TypeScript logger for web and mobile frontend modules with DEV-only suppression logic. */
/**
 * Simple Logger for InnerOrbit
 * Helps keep the console clean and readable.
 */

// @ts-ignore - __DEV__ is globally injected by React Native/Metro
const isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const Logger = {
    // Regular info logs (Green/White)
    log: (message: string | any) => {
        if (isDev) {
            console.log(`[InnerOrbit] ℹ️ ${message}`);
        }
    },

    // Important success messages (Green)
    success: (message: string | any) => {
        if (isDev) {
            console.log(`[InnerOrbit] ✅ ${message}`);
        }
    },

    // Warnings (Yellow)
    warn: (message: string, ...args: any[]) => {
        if (isDev) {
            if (args.length > 0) {
                console.warn(`[InnerOrbit] ⚠️ ${message}`, ...args);
            } else {
                console.warn(`[InnerOrbit] ⚠️ ${message}`);
            }
        }
    },

    // Errors (Red) - These usually show in production too, which is good
    error: (message: string, errorObj: any = null) => {
        console.error(`[InnerOrbit] ❌ ${message}`);
        if (errorObj && isDev) {
            console.error(errorObj);
        }
    }
};
