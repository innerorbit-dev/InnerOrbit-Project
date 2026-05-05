/** Purpose: Standardized container for screens with theme-aware background styling. */
import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../store/themeStore";

export function ScreenContainer({ children, style = {} }) {
    const { theme } = useAppTheme();
    return (
        <View style={[styles.container, { backgroundColor: theme.background }, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
