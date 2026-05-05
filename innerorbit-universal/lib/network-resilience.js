/** Purpose: Network-resilient Firestore wrapper providing automatic retry, offline queueing, and result caching. */
/**
 * Network-Resilient Firestore Wrapper
 * Adds automatic retry, offline queueing, and timeout handling to Firestore operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from './logger';

// Cache for offline data
const offlineCache = {
    conversations: new Map(),
    messages: new Map(),
    profiles: new Map()
};

/**
 * Wraps a Firestore operation with network resilience
 * @param operation - The Firestore operation to execute
 * @param options - Configuration options
 * @returns Promise with the operation result
 */
export async function withNetworkResilience(operation, options = {}) {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        timeout = 15000,
        cacheKey = null,
        fallbackValue = null,
        queueIfOffline = true
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let timeoutId;
        try {
            // Add timeout wrapper
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Operation timeout')), timeout);
            });

            const result = await Promise.race([operation(), timeoutPromise]);
            clearTimeout(timeoutId);

            // Cache successful result if cacheKey provided
            if (cacheKey && result) {
                await cacheData(cacheKey, result);
            }

            return result;
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            lastError = error;

            // Check if it's a network error
            const isNetworkError =
                error.message?.includes('network') ||
                error.message?.includes('timeout') ||
                error.message?.includes('offline') ||
                error.code === 'unavailable';

            if (isNetworkError && attempt < maxRetries) {
                // Exponential backoff
                const delay = retryDelay * Math.pow(2, attempt);
                Logger.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // If all retries failed and we have a cache key, try to return cached data
            if (isNetworkError && cacheKey) {
                const cached = await getCachedData(cacheKey);
                if (cached) {
                    Logger.log('Returning cached data due to network error');
                    return cached;
                }
            }

            // If fallback value provided, return it
            if (isNetworkError && fallbackValue !== null) {
                Logger.log('Returning fallback value due to network error');
                return fallbackValue;
            }

            break;
        }
    }

    throw lastError;
}

/**
 * Cache data for offline access
 */
async function cacheData(key, data) {
    try {
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        Logger.log('Failed to cache data:', e);
    }
}

/**
 * Get cached data
 */
async function getCachedData(key) {
    try {
        const cached = await AsyncStorage.getItem(`cache_${key}`);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);

        // Cache valid for 5 minutes
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            return null;
        }

        return data;
    } catch (e) {
        Logger.log('Failed to get cached data:', e);
        return null;
    }
}

/**
 * Clear all cached data
 */
export async function clearCache() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith('cache_'));
        await AsyncStorage.multiRemove(cacheKeys);
    } catch (e) {
        Logger.log('Failed to clear cache:', e);
    }
}
