/**
 * Legacy re-export for platform-core.
 * All logic now lives in platform.js to prevent circular dependencies.
 */
export { isIOS, isAndroid, isWeb, isWindows, isMacOS, os, select } from './platform';
