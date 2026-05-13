/**
 * Metro Bundler Configuration — InnerOrbit Universal
 *
 * Metro is the JavaScript bundler that Expo/React Native uses to compile
 * the app for Android, iOS, Web, and Desktop (Electron). This config
 * customises how Metro resolves third-party modules across platforms:
 *
 *  1. Web shims    – Swaps phone-only libraries (e.g. react-native-quick-crypto)
 *                    with browser-compatible alternatives so one codebase runs everywhere.
 *  2. Overrides    – Fixes broken package builds (libsodium ESM, event-target-shim
 *                    subpath) via Metro's standard resolveRequest hook.
 *  3. Extensions   – Registers .cjs as source and .wasm as an asset so expo-sqlite
 *                    and other WASM-dependent packages bundle correctly.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─────────────────────────────────────────────────────────────────────────────
// Platform-specific module swaps (web only)
//
// These redirect phone-only libraries to browser-safe alternatives.
// On native (Android/iOS), Metro ignores this block entirely.
// ─────────────────────────────────────────────────────────────────────────────
const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web'
  || process.env.npm_lifecycle_event?.includes('web');

if (isWeb) {
  const webShims = {
    'react-native-quick-crypto': path.resolve(__dirname, './lib/crypto-wrapper.web.ts'),
    'react-native-nitro-modules': require.resolve('path-browserify'),
  };

  config.resolver.extraNodeModules = { ...config.resolver.extraNodeModules, ...webShims };
  config.resolver.alias = { ...config.resolver.alias, ...webShims };
}

// ─────────────────────────────────────────────────────────────────────────────
// Module resolution overrides (all platforms)
//
// Some third-party packages ship broken or incompatible builds.
// resolveRequest is Metro's standard hook for fixing these at build time.
// ─────────────────────────────────────────────────────────────────────────────
const overrides = {
  // libsodium-wrappers ships an ESM build that Metro can't parse → force CJS
  'libsodium-wrappers': path.resolve(
    __dirname, 'node_modules', 'libsodium-wrappers', 'dist', 'modules', 'libsodium-wrappers.js'
  ),
  // react-native-webrtc imports 'event-target-shim/index' (non-standard subpath) → resolve cleanly
  'event-target-shim': path.resolve(
    __dirname, 'node_modules', 'event-target-shim', 'dist', 'event-target-shim.js'
  ),
};
// Also catch the non-standard subpath variant
overrides['event-target-shim/index'] = overrides['event-target-shim'];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (overrides[moduleName]) {
    return { filePath: overrides[moduleName], type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// ─────────────────────────────────────────────────────────────────────────────
// File extension support
// ─────────────────────────────────────────────────────────────────────────────
config.resolver.sourceExts.push('cjs');

// expo-sqlite ships a .wasm file (wa-sqlite) — treat it as an asset, not source
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'wasm'];
config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'wasm');

module.exports = config;
