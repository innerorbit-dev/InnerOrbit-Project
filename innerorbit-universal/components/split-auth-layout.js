/**
 * Purpose: Responsive layout wrapper for authentication screens. Implements the distinctive 
 * split-pane design with dynamic padding and safe-area handling for all platforms.
 */
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView, Animated, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Pressable } from "react-native";
import { isWeb, isIOS, isAndroid, select } from "../utils/platform";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "../store/themeStore";

import { useWindowDimensions } from "react-native";

// Safe Platform detection
const getIsWeb = () => isWeb;

// Rename for consistency but keep values identical
const MOBILE_LAYOUT_PROFILE = {
    primary: {
        left: ["#0f172a", "#4c1d95"],
        right: ["#0f172a", "#6a2b2be3"],
    },
    secondary: {
        left: ["#0f172a", "#4c1d95"],
        right: ["#0f172a", "#1e3b8ac6"],
    },
    signup: {
        left: ["#020617", "#0f172a"],
        right: ["#020617", "#1e293b"],
    },
    text: "#F1F5F9",
    textMuted: "#CBD5E1",
};

const WEB_LAYOUT_PROFILE = {
    primary: {
        left: ["#030712", "#1e1b4b"],
        right: ["#030712", "#310e14"],
    },
    secondary: {
        left: ["#030712", "#1e1b4b"],
        right: ["#030712", "#1e3a8a33"], // Subtle blue tint, much darker than before
    },
    signup: {
        left: ["#020617", "#0f172a"],
        right: ["#020617", "#1e293b"],
    },
    text: "#F1F5F9",
    textMuted: "#64748b",
};

const DESKTOP_LAYOUT_PROFILE = {
    primary: {
        left: ["#030712", "#1e1b4b"],
        right: ["#030712", "#310e14"],
    },
    secondary: {
        left: ["#030712", "#1e1b4b"],
        right: ["#030712", "#1e3a8a33"],
    },
    signup: {
        left: ["#030712", "#0f172a"],
        right: ["#030712", "#111827"],
    },
    text: "#FFFFFF",
    textMuted: "#475569",
};

const SOFT_LIGHT_LAYOUT_PROFILE = {
    primary: {
        left: ["#f8fafc4f", "#deb019ff"],
        right: ["#F1F5F9", "#6a2b2bce"],
    },
    secondary: {
        left: ["#f8fafcb6", "#61c0c0ff"],
        right: ["#f1f5f9a8", "#4a6b96ff"],
    },
    signup: {
        left: ["#ced2abe6", "#6ad6d5ff"],
        right: ["#a2abb4ff", "#e7f3a3ff"],
    },
    text: "#0F172A",
    textMuted: "#475569",
};

/**
 * WEB LAYOUT SCOPE 
 * - Handles mouse interactions, skewed backgrounds, and 50/50 desktop split.
 */
const WebLayout = ({ children, variant, mode, leftContent, formMaxWidth, centeredLeftContent, styles }) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    const isLargeScreen = width >= (isWeb ? 560 : 768);
    const isXLargeScreen = width >= 1440;
    const isLogin = mode === 'login';
    const isSignup = mode === 'signup';

    const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    const { isDark, toggleTheme, themePreference } = useAppTheme();
    const THEME = !isDark ? SOFT_LIGHT_LAYOUT_PROFILE : (isElectron ? DESKTOP_LAYOUT_PROFILE : WEB_LAYOUT_PROFILE);

    const bgOpacity = useRef(new Animated.Value(variant === 'primary' ? 1 : 0)).current;
    useEffect(() => {
        // Instant visual update on web to prevent flashing
        bgOpacity.setValue(variant === 'primary' ? 1 : 0);
    }, [variant]);

    return (
        <View style={styles.container}>
            <StatusBar style={isDark ? "light" : "dark"} />


            {/* Background Layers (Pointer Events Disabled) */}
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
                {isSignup ? (
                    // Signup Specific Red Background
                    <LinearGradient colors={THEME.signup.right} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                ) : (
                    // Login Animated Backgrounds
                    <>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
                            <LinearGradient colors={THEME.primary.right} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, bgOpacity) }]}>
                            <LinearGradient colors={THEME.secondary.right} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        </Animated.View>
                    </>
                )}

                {isLargeScreen && (
                    <View style={styles.leftBgSkewed}>
                        {isSignup ? (
                            <LinearGradient colors={THEME.signup.left} style={StyleSheet.absoluteFill} />
                        ) : (
                            <>
                                <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
                                    <LinearGradient colors={THEME.primary.left} style={StyleSheet.absoluteFill} />
                                </Animated.View>
                                <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, bgOpacity) }]}>
                                    <LinearGradient colors={THEME.secondary.left} style={StyleSheet.absoluteFill} />
                                </Animated.View>
                            </>
                        )}
                    </View>
                )}
            </View>

            <View style={[styles.contentWrapper, { flexDirection: isLargeScreen ? "row" : "column" }]}>
                {isLargeScreen && (
                    <View style={[
                        styles.leftPanel,
                        {
                            flex: isXLargeScreen ? 0.45 : (isTablet ? 0.40 : 0.45), // Increased left panel size to shift form right
                            paddingTop: isXLargeScreen ? 100 : 60
                        },
                        centeredLeftContent && { justifyContent: 'center', paddingTop: 0, paddingRight: 0 }
                    ]}>
                        <View style={[
                            styles.leftContent,
                            {
                                paddingTop: isXLargeScreen ? 80 : 40,
                                paddingLeft: isXLargeScreen ? 40 : (isTablet ? 20 : 32),
                                paddingRight: isXLargeScreen ? 60 : (isTablet ? 20 : 32)
                            },
                            centeredLeftContent && { alignItems: 'center', paddingLeft: 0, paddingRight: 0 }
                        ]}>
                            {leftContent || (
                                <>
                                    {isLogin ? (
                                        <>
                                            <Text style={[styles.infoTitle, { fontSize: isXLargeScreen ? 42 : (isTablet ? 24 : 28), lineHeight: isXLargeScreen ? 48 : (isTablet ? 32 : 34) }]}>Welcome To InnerOrbit</Text>
                                            <Text style={[styles.infoSubtitle, { fontSize: isXLargeScreen ? 18 : (isTablet ? 14 : 15) }]}>
                                                You’re entering a space designed to stay low-key and private by default.{"\n\n"}
                                                This app quietly adapts to your environment, keeping conversations normal-looking while protecting what matters to you.
                                            </Text>
                                            <Text style={[styles.infoSubtitle, { marginTop: 16, opacity: 0.8, fontSize: isXLargeScreen ? 18 : (isTablet ? 14 : 15) }]}>
                                                Your unique User ID connects you with people, while your PIN enables secure account recovery.
                                            </Text>
                                        </>
                                    ) : (
                                        <View style={{ marginTop: -40 }}>
                                            <Text style={[styles.infoTitle, { fontSize: isXLargeScreen ? 42 : (isTablet ? 24 : 28), lineHeight: isXLargeScreen ? 48 : (isTablet ? 32 : 34) }]}>Welcome to a quieter kind of privacy</Text>
                                            <Text style={[styles.infoDescription, { fontSize: isXLargeScreen ? 18 : (isTablet ? 14 : 15) }]}>
                                                This chat app is built for real life — where privacy isn’t always about passwords or servers, but about how things look on your screen.
                                            </Text>

                                            <View style={styles.featureList}>
                                                <View style={styles.featureItem}>
                                                    <View style={styles.featureIcon}>
                                                        <Feather name="smartphone" size={20} color="#94a3b8" />
                                                    </View>
                                                    <Text style={[styles.featureText, { fontSize: isXLargeScreen ? 16 : 14 }]}>
                                                        Your messages are handled on your device and designed to blend in naturally, even in shared or strict environments.
                                                    </Text>
                                                </View>

                                                <View style={styles.featureItem}>
                                                    <View style={styles.featureIcon}>
                                                        <Feather name="shield" size={20} color="#94a3b8" />
                                                    </View>
                                                    <Text style={[styles.featureText, { fontSize: isXLargeScreen ? 16 : 14 }]}>
                                                        No tracking, no unnecessary exposure — just conversations that stay calm, subtle, and under your control.
                                                    </Text>
                                                </View>

                                                <View style={styles.featureItem}>
                                                    <View style={styles.featureIcon}>
                                                        <Feather name="zap" size={20} color="#94a3b8" />
                                                    </View>
                                                    <Text style={[styles.featureText, { fontSize: isXLargeScreen ? 16 : 14 }]}>
                                                        Subtle and under your control from the very first message.
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    </View>
                )}

                <View style={[styles.rightPanel, {
                    flex: isLargeScreen ? (isXLargeScreen ? 0.55 : (isTablet ? 0.60 : 0.55)) : 1, // Reduced right panel size to shift form right
                    zIndex: 100,
                    height: '100%',
                    alignItems: 'stretch'
                }]}>
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            {
                                flexGrow: 1,
                                justifyContent: 'center', // Always center vertically on web
                                alignItems: isLargeScreen ? 'flex-end' : 'stretch', // Align right on large screens
                                paddingLeft: isLargeScreen ? 40 : 20,
                                paddingRight: isLargeScreen ? 80 : 20, // More right padding to balance flex-end
                                paddingTop: isLargeScreen ? 0 : 40,
                                paddingBottom: 20,
                            }
                        ]}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[
                            { width: '100%', maxWidth: formMaxWidth || 450, alignSelf: isLargeScreen ? 'flex-end' : 'center' },
                        ]}>
                            {children}
                        </View>
                    </ScrollView>
                </View>
            </View>

            {/* Floating Theme Toggle - Moved to end for interactivity */}
            <View style={{
                position: 'absolute',
                top: 24,
                right: 24,
                zIndex: 9999,
                pointerEvents: "box-none",
            }}>
                <Pressable
                    onPress={() => {
                        let nextPref;
                        if (themePreference === 'light') nextPref = 'dark';
                        else if (themePreference === 'dark') nextPref = 'system';
                        else nextPref = 'light';
                        toggleTheme(nextPref);
                    }}
                    hitSlop={15}
                    style={({ pressed }) => [
                        {
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
                            opacity: pressed ? 0.7 : 1,
                            ...(isWeb ? {
                                backdropFilter: 'blur(20px)',
                                cursor: 'pointer',
                                boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)'
                            } : {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.15,
                                shadowRadius: 4,
                            })
                        }
                    ]}
                >
                    <Feather
                        name={themePreference === 'light' ? "moon" : (themePreference === 'dark' ? "monitor" : "sun")}
                        size={20}
                        color={isDark ? "#fb7185" : "#0F172A"}
                    />
                </Pressable>
            </View>
        </View>
    );
};

/**
 * MOBILE LAYOUT SCOPE (Android/iOS)
 * - Handles Keyboard dismissal, touch events, and full-width forms.
 */
const MobileLayout = ({ children, variant, mobileMinimal, formMaxWidth, styles }) => {
    // Logic: Explicitly check for Primary/Secondary. If neither, default to RED (Signup).
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';
    const useRedTheme = !isPrimary && !isSecondary; // Catch-all for Signup

    const { isDark, toggleTheme, themePreference } = useAppTheme();
    const THEME = !isDark ? SOFT_LIGHT_LAYOUT_PROFILE : MOBILE_LAYOUT_PROFILE;

    // Animation only needed if toggling between Primary/Secondary
    const bgOpacity = useRef(new Animated.Value(isPrimary ? 1 : 0)).current;

    useEffect(() => {
        // Only run animation if we are in the Blue/Pink modes
        if (!useRedTheme) {
            Animated.timing(bgOpacity, { toValue: isPrimary ? 1 : 0, duration: 600, useNativeDriver: !isWeb }).start();
        }
    }, [variant, useRedTheme, isPrimary]);

    return (
        <View style={[styles.container, { backgroundColor: THEME.background || '#000' }]}>
            <StatusBar style={isDark ? "light" : "dark"} />


            <View style={[StyleSheet.absoluteFill, { backgroundColor: useRedTheme ? '#030712' : 'transparent', pointerEvents: 'none' }]}>
                {useRedTheme ? (
                    <LinearGradient
                        colors={THEME.signup.right} // Use the profile color for consistency
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
                            <LinearGradient colors={THEME.primary.right} style={StyleSheet.absoluteFill} />
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, bgOpacity) }]}>
                            <LinearGradient colors={THEME.secondary.right} style={StyleSheet.absoluteFill} />
                        </Animated.View>
                    </>
                )}
            </View>

            <KeyboardAvoidingView
                behavior={isIOS ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={isIOS ? 0 : 20}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            flexGrow: 1,
                            justifyContent: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 80,
                            paddingBottom: 60,
                        }
                    ]}
                >
                    <View style={{ width: '100%', maxWidth: formMaxWidth || 480, alignSelf: 'center' }}>
                        {children}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Floating Theme Toggle (Mobile) - Moved to end for interactivity */}
            <View style={{
                position: 'absolute',
                top: 50, // Below potential header/safe area
                right: 20,
                zIndex: 9999,
                pointerEvents: "box-none",
            }}>
                <Pressable
                    onPress={() => {
                        let nextPref;
                        if (themePreference === 'light') nextPref = 'dark';
                        else if (themePreference === 'dark') nextPref = 'system';
                        else nextPref = 'light';
                        toggleTheme(nextPref);
                    }}
                    hitSlop={15}
                    style={({ pressed }) => [
                        {
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
                            ...(isWeb ? {
                                backdropFilter: 'blur(20px)',
                                boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
                                cursor: 'pointer'
                            } : {
                                elevation: 4,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.15,
                                shadowRadius: 4,
                            }),
                            opacity: pressed ? 0.7 : 1,
                        }
                    ]}
                >
                    <Feather
                        name={themePreference === 'light' ? "moon" : (themePreference === 'dark' ? "monitor" : "sun")}
                        size={20}
                        color={isDark ? "#fb7185" : "#0F172A"}
                    />
                </Pressable>
            </View>
        </View>
    );
};
export const SplitAuthLayout = (props) => {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { isDark } = useAppTheme();
    const styles = React.useMemo(() => getSplitLayoutStyles(width, insets, isDark), [width, insets, isDark]);

    return getIsWeb() ? <WebLayout {...props} styles={styles} /> : <MobileLayout {...props} styles={styles} />;
};

const getSplitLayoutStyles = (width, insets, isDark) => {
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    const isWebInternal = isWeb;
    const isLargeScreen = width >= (isWebInternal ? 560 : 768);
    const isXLargeScreen = width >= 1440;

    return StyleSheet.create({
        container: {
            flex: 1,
        },
        contentWrapper: {
            flex: 1,
        },
        leftPanel: {
            justifyContent: "flex-start",
            paddingTop: 100,
            alignItems: "center",
            position: "relative",
            zIndex: 10,
            paddingRight: 40,
        },
        leftBgSkewed: {
            position: 'absolute',
            top: -100,
            bottom: -100,
            left: '-20%',
            width: '70%',
            transform: [{ skewX: '-12deg' }],
            zIndex: 1,
            ...select({
                ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 15, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 25,
                },
                android: {
                    elevation: 10,
                },
                web: {
                    boxShadow: '15px 0px 25px rgba(0, 0, 0, 0.4)',
                },
            }),
        },
        leftPanelMobile: {
            flex: 0,
            width: '100%',
            padding: 30,
            alignItems: "flex-start",
            minHeight: 220,
        },
        leftContent: {
            maxWidth: 900,
            width: "100%",
            zIndex: 20,
            paddingLeft: 40,
            paddingRight: 60,
            alignItems: 'flex-start',
        },
        logoBadge: {
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 32,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
        },
        logoIcon: {
            fontSize: 32,
        },
        infoTitle: {
            fontSize: 42,
            fontFamily: "Outfit_700Bold",
            color: isDark ? "#F8FAFC" : SOFT_LIGHT_LAYOUT_PROFILE.text,
            marginBottom: 24,
            textAlign: "left",
            lineHeight: 48,
        },
        infoSubtitle: {
            fontSize: 18,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#CBD5E1" : SOFT_LIGHT_LAYOUT_PROFILE.textMuted,
            lineHeight: 28,
            textAlign: "left",
        },
        infoDescription: {
            color: isDark ? "#CBD5E1" : SOFT_LIGHT_LAYOUT_PROFILE.textMuted,
            fontSize: 18,
            lineHeight: 28,
            fontWeight: "400",
            marginBottom: 30,
            textAlign: 'left',
            maxWidth: '90%',
        },
        featureList: {
            width: '100%',
            marginTop: 10,
        },
        featureItem: {
            flexDirection: 'row',
            marginBottom: 24,
            alignItems: 'flex-start',
            maxWidth: '95%',
        },
        featureIcon: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.08)",
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
            marginTop: 2,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.05)",
        },
        featureText: {
            flex: 1,
            color: isDark ? "#CBD5E1" : SOFT_LIGHT_LAYOUT_PROFILE.textMuted,
            fontSize: 16,
            lineHeight: 24,
        },
        rightPanel: {
            position: "relative",
            zIndex: 5,
            justifyContent: 'center',
        },
        rightPanelMobile: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            alignItems: 'center',
            width: '100%',
        },
        formContainer: {
            width: "100%",
        },
    });
};
