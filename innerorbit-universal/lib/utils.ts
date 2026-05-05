/** Purpose: Core utility library including Tailwind-compatible className merging and type-safe Storage wrappers. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logger } from "./logger";

export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(" ");
}

/**
 * Safe AsyncStorage wrapper with try-catch and logging
 */
export const SafeStorage = {
    getItem: async (key: string, defaultValue: string | null = null): Promise<string | null> => {
        try {
            const val = await AsyncStorage.getItem(key);
            return val !== null ? val : defaultValue;
        } catch (e: any) {
            Logger.warn(`[Storage] Failed to get item ${key}:`, e.message);
            return defaultValue;
        }
    },

    setItem: async (key: string, value: string | number | boolean): Promise<boolean> => {
        try {
            await AsyncStorage.setItem(key, String(value));
            return true;
        } catch (e: any) {
            Logger.warn(`[Storage] Failed to set item ${key}:`, e.message);
            return false;
        }
    },

    removeItem: async (key: string): Promise<boolean> => {
        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (e: any) {
            Logger.warn(`[Storage] Failed to remove item ${key}:`, e.message);
            return false;
        }
    },

    /**
     * Parse JSON with safety check
     */
    getJson: async <T>(key: string, defaultValue: T | null = null): Promise<T | null> => {
        try {
            const val = await AsyncStorage.getItem(key);
            if (val === null) return defaultValue;
            return JSON.parse(val);
        } catch (e: any) {
            Logger.warn(`[Storage] Failed to get JSON ${key}:`, e.message);
            return defaultValue;
        }
    },

    setJson: async (key: string, value: any): Promise<boolean> => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e: any) {
            Logger.warn(`[Storage] Failed to set JSON ${key}:`, e.message);
            return false;
        }
    }
};
