/** Purpose: Branded loading overlay shown during app unlocking transitions. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { isWeb, isIOS } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import { LoadingDots } from './loading-dots';

const LOGO_IMG = require("../../assets/InnerOrbit-Logo.png");


export const ShieldOverlay = ({ visible, onAnimationComplete }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const { isDark, COLORS } = useAppTheme();

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: !isWeb,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: !isWeb,
            }).start(() => {
                if (onAnimationComplete) onAnimationComplete();
            });
        }
    }, [visible]);

    if (!visible && fadeAnim._value === 0) return null;

    // Use Main Application Theme (Chat Theme) for the Unlock Transition
    // Per user request: Branded preloader must sync with main application
    const theme = isDark ? COLORS.dark : COLORS.light;
    const bgColor = theme.background;
    const accentColor = theme.primary;
    const textColor = theme.text;
    const subtitleColor = theme.textSecondary;

    return (
        <Animated.View
            style={[
                styles.overlay,
                { backgroundColor: bgColor, opacity: fadeAnim, pointerEvents: visible ? 'auto' : 'none' }
            ]}
        >
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image source={LOGO_IMG} style={{ width: 80, height: 80 }} resizeMode="contain" />
                    <View style={[styles.glow, { backgroundColor: accentColor }]} />
                </View>

                <Text style={[styles.title, { color: textColor }]}>InnerOrbit</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                    Unlocking your workspace...
                </Text>

                <View style={styles.loaderContainer}>
                    <LoadingDots color={accentColor} size={6} gap={3} />
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    logoContainer: {
        position: 'relative',
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    glow: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        opacity: 0.15,
        zIndex: -1,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: isIOS ? 'System' : 'sans-serif-medium',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.8,
    },
    loaderContainer: {
        marginTop: 48,
        height: 40,
    }
});
