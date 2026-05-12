/** Purpose: TypeScript logger for web and mobile frontend modules with DEV-only suppression logic. */
/**
 * Simple Logger for InnerOrbit
 * Helps keep the console clean and readable.
 */

// @ts-ignore - __DEV__ is globally injected by React Native/Metro
const isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const Logger: any = {
    // Add self-reference to handle accidental double-nesting in some import environments
    Logger: null, // Will be set after definition

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
            const formattedArgs = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg).substring(0, 100) : arg
            ).join(' ');
            console.warn(`[InnerOrbit] ⚠️ ${message} ${formattedArgs}`.trim());
        }
    },

    // Errors (Red)
    error: (message: string, errorObj: any = null) => {
        let errorMsg = `[InnerOrbit] ❌ ${message}`;
        if (errorObj) {
            const extra = typeof errorObj === 'object' ? 
                (errorObj.message || JSON.stringify(errorObj).substring(0, 150)) : 
                String(errorObj);
            errorMsg += ` | Error: ${extra}`;
        }
        console.error(errorMsg);
    },

    // Structured Trace Logs for Debugging
    trace: (module: string, file: string, fn: string, status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRY', message: string = "") => {
        if (!isDev && status !== 'FAILED') return; // Always log failures, even in prod if they hit here
        
        const msg = message ? `: ${message}` : "";
        const icon = status === 'SUCCESS' ? '✅' : (status === 'FAILED' ? '❌' : (status === 'RETRY' ? '🔄' : 'ℹ️'));
        console.log(`[${module}][${file}][${fn}] ${icon} ${status}${msg}`);
    }
};

// Set self-reference
Logger.Logger = Logger;


// Default export for broader compatibility with different import styles
export default Logger;

// Initialization check log (DEV only)
if (isDev) {
    console.log("[InnerOrbit][logger.ts] 🚀 Module loaded successfully");
}
