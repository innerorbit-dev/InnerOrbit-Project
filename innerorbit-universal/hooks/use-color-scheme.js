/**
 * Purpose: Wrapper hook for React Native's useColorScheme to provide a consistent interface 
 * for detecting the system-level color scheme (light/dark).
 */
import { useColorScheme as useRNColorScheme } from "react-native";

export function useColorScheme() {
    return useRNColorScheme();
}
