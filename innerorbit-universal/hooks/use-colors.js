/**
 * Purpose: Provides the application's semantic color tokens (primary, background, surface, etc.)
 * mapped to the current active theme (light or dark).
 */
import { useColorScheme } from "./use-color-scheme";

const lightColors = {
    primary: "#0a7ea4",
    background: "#ffffff",
    surface: "#f5f5f5",
    foreground: "#11181C",
    muted: "#687076",
    border: "#E5E7EB",
    error: "#EF4444",
};

const darkColors = {
    primary: "#0a7ea4",
    background: "#151718",
    surface: "#1e2022",
    foreground: "#ECEDEE",
    muted: "#9BA1A6",
    border: "#334155",
    error: "#F87171",
};

export function useColors() {
    const colorScheme = useColorScheme();
    return colorScheme === "dark" ? darkColors : lightColors;
}
