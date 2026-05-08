const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Module resolution fixes for dependencies
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'event-target-shim': path.resolve(__dirname, 'node_modules', 'event-target-shim'),
  'event-target-shim/index': path.resolve(__dirname, 'node_modules', 'event-target-shim/index.js'),
};

// Platform-specific shims
if (process.env.EXPO_PUBLIC_PLATFORM === 'web' || process.env.npm_lifecycle_event?.includes('web')) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-quick-crypto': path.resolve(__dirname, './lib/crypto-wrapper.web.ts'),
    'react-native-nitro-modules': require.resolve('path-browserify'), // Mock nitro modules on web
  };
  
  config.resolver.alias = {
    ...config.resolver.alias,
    'react-native-quick-crypto': path.resolve(__dirname, './lib/crypto-wrapper.web.ts'),
    'react-native-nitro-modules': 'path-browserify',
  };
}

config.resolver.sourceExts.push('cjs');
config.resolver.sourceExts.push('mjs');

module.exports = config;
