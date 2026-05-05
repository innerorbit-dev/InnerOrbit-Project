/** Purpose: CommonJS logger implementation for Electron main process and Node.js-compatible environments. */
/**
 * CommonJS Logger for InnerOrbit (Main Process)
 * This provides JS compatibility for the Electron main process.
 */

const Logger = {
    log: (message) => {
        console.log(`[InnerOrbit] ℹ️ ${message}`);
    },
    success: (message) => {
        console.log(`[InnerOrbit] ✅ ${message}`);
    },
    warn: (message, ...args) => {
        if (args.length > 0) {
            console.warn(`[InnerOrbit] ⚠️ ${message}`, ...args);
        } else {
            console.warn(`[InnerOrbit] ⚠️ ${message}`);
        }
    },
    error: (message, errorObj = null) => {
        console.error(`[InnerOrbit] ❌ ${message}`);
        if (errorObj) {
            console.error(errorObj);
        }
    }
};

module.exports = { Logger };
