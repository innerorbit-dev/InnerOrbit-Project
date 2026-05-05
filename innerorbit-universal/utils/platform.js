import { Dimensions, Platform as RNPlatform } from 'react-native';

/**
 * Unified Platform Abstraction Layer
 */

export const isIOS = RNPlatform.OS === 'ios';
export const isAndroid = RNPlatform.OS === 'android';
export const isWeb = RNPlatform.OS === 'web';
export const isWindows = RNPlatform.OS === 'windows';
export const isMacOS = RNPlatform.OS === 'macos';
export const os = RNPlatform.OS;

// True for physical mobile devices (iOS/Android)
export const isMobile = isIOS || isAndroid;

// True for native apps (not web)
export const isNative = isMobile || isWindows || isMacOS;

// Safe Dimensions check
const getWindowWidth = () => {
  try {
    return Dimensions.get('window').width;
  } catch (e) {
    return 0;
  }
};

// True for desktop environments
export const isDesktop = isWindows || isMacOS || (isWeb && getWindowWidth() >= 1024);

// Small screen detection for responsive web
export const isSmallWeb = isWeb && getWindowWidth() < 1024;

// Mobile-like experience
export const isMobileLayout = isMobile || isSmallWeb;

/**
 * Hardened select utility.
 */
export function select(obj) {
  if (!obj) return {};
  try {
    // If RNPlatform.select is available (React Native), use it
    if (RNPlatform && typeof RNPlatform.select === 'function') {
      return RNPlatform.select(obj) || obj.default || {};
    }
    // Fallback manual selection
    const platform = RNPlatform?.OS || 'web';
    return obj[platform] || obj.default || {};
  } catch (e) {
    return obj?.default || {};
  }
}

// Full utility object
export const Platform = {
  isIOS,
  isAndroid,
  isWeb,
  isWindows,
  isMacOS,
  isMobile,
  isNative,
  isDesktop,
  isSmallWeb,
  isMobileLayout,
  select,
  os,
  OS: RNPlatform.OS // Include native OS for convenience
};

export default Platform;
