/** Purpose: Persistent bottom navigation bar for mobile app screens. */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { isWeb, select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BottomNav = ({ activeTab, setActiveTab, THEME }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const tabs = React.useMemo(() => [
        { id: 'chats', label: 'Chats', icon: 'message-circle', activeColor: THEME.primary },
        { id: 'stories', label: 'Stories', icon: 'layers', rotate: true, activeColor: THEME.primary },
        { id: 'calls', label: 'Calls', icon: 'phone', activeColor: THEME.primary },
        { id: 'settings', label: 'Settings', icon: 'settings', activeColor: THEME.primary },
    ], [THEME.primary]);

    const initialIndex = tabs.findIndex(t => t.id === activeTab);
    const indicatorAnim = useRef(new Animated.Value(initialIndex >= 0 ? initialIndex : 0)).current;

    // Direct color transition state
    const colorAnim = useRef(new Animated.Value(0)).current;

    // Optimized: Pre-calculate the active colors to avoid real-time work in render
    const tabColors = React.useMemo(() => tabs.map(t => t.activeColor), [tabs]);
    const prevColor = useRef(tabColors[initialIndex >= 0 ? initialIndex : 0]);
    const currColor = useRef(tabColors[initialIndex >= 0 ? initialIndex : 0]);
    const lastTabRef = useRef(activeTab);

    // Sync transition colors synchronously to avoid "stale frame" jump
    // We only sync the color targets here, the actual animation is handled in useEffect
    if (lastTabRef.current !== activeTab) {
        const nextIndex = tabs.findIndex(t => t.id === activeTab);
        if (nextIndex !== -1) {
            prevColor.current = currColor.current;
            currColor.current = tabColors[nextIndex];
            colorAnim.setValue(0);
            lastTabRef.current = activeTab;
        }
    }

    // Scale animations for each tab icon
    const scaleAnims = useRef(tabs.map((_, i) => new Animated.Value(i === initialIndex ? 1 : 0))).current;

    useEffect(() => {
        const activeIndex = tabs.findIndex(t => t.id === activeTab);
        if (activeIndex === -1) return;

        // Run animations in parallel
        Animated.parallel([
            Animated.spring(indicatorAnim, {
                toValue: activeIndex,
                // UI Physics: Use native driver for translation on mobile only
                useNativeDriver: !isWeb,
                friction: 8,
                tension: 40
            }),
            Animated.timing(colorAnim, {
                toValue: 1,
                duration: 250,
                // Aesthetics: Keep color on JS thread for interpolation support
                useNativeDriver: false
            }),
            ...tabs.map((_, index) =>
                Animated.spring(scaleAnims[index], {
                    toValue: index === activeIndex ? 1 : 0,
                    useNativeDriver: false,
                    friction: 8,
                    tension: 45
                })
            )
        ]).start();
    }, [activeTab, tabs, tabColors]);

    const tabWidth = width / tabs.length;

    const translateX = indicatorAnim.interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3]
    });

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: THEME.surface,
                borderTopColor: THEME.border,
                paddingBottom: Math.max(insets.bottom, 10),
                height: 65 + Math.max(insets.bottom, 10),
                // Removed backdropFilter: blur and semi-transparency to prevent Web compositing flickers
            }
        ]}>
            {/* Sliding Indicator Bar */}
            <Animated.View style={[
                styles.indicatorContainer,
                {
                    width: tabWidth,
                    transform: [{ translateX }]
                }
            ]}>
                <Animated.View style={[
                    styles.indicator,
                    {
                        backgroundColor: colorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [prevColor.current, currColor.current]
                        })
                    }
                ]} />
            </Animated.View>

            <View style={styles.tabsWrapper}>
                {tabs.map((tab, index) => {
                    const animValue = scaleAnims[index];

                    const scale = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3]
                    });

                    const elevation = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 12]
                    });

                    const backgroundColor = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['rgba(0,0,0,0)', `rgba(${parseInt(tab.activeColor.slice(1, 3), 16)}, ${parseInt(tab.activeColor.slice(3, 5), 16)}, ${parseInt(tab.activeColor.slice(5, 7), 16)}, 0.15)`]
                    });

                    const shadowOpacity = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.3]
                    });

                    // Cross-fade opacity for dual icons
                    const activeOpacity = animValue;
                    const inactiveOpacity = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0]
                    });

                    const labelColor = animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [THEME.textSecondary, tab.activeColor]
                    });

                    const fontWeight = activeTab === tab.id ? '800' : '700';

                    return (
                        <Pressable
                            key={tab.id}
                            onPress={() => setActiveTab(tab.id)}
                            style={styles.tabItem}
                        >
                            <Animated.View style={[
                                styles.iconContainer,
                                {
                                    backgroundColor,
                                    transform: [{ scale }],
                                    ...(!isWeb && {
                                        elevation: elevation,
                                        shadowColor: tab.activeColor,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: shadowOpacity,
                                        shadowRadius: 8,
                                    }),
                                    zIndex: 10
                                }
                            ]}>
                                <View style={[styles.iconWrapper, tab.rotate && { transform: [{ rotate: '90deg' }] }]}>
                                    {/* Dual-Icon Cross-fade: Eliminates color flicker/jumps */}
                                    <Animated.View style={{ position: 'absolute', opacity: inactiveOpacity }}>
                                        <Feather name={tab.icon} size={22} color={THEME.textSecondary} />
                                    </Animated.View>
                                    <Animated.View style={{ opacity: activeOpacity }}>
                                        <Feather name={tab.icon} size={22} color={tab.activeColor} />
                                    </Animated.View>
                                </View>
                            </Animated.View>
                            <Animated.Text style={[
                                styles.tabLabel,
                                {
                                    color: labelColor,
                                    transform: [{ scale }],
                                    zIndex: 10,
                                }
                            ]}>
                                {tab.label}
                            </Animated.Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderTopWidth: 1,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        overflow: 'visible',
    },
    tabsWrapper: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
        overflow: 'visible',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
        overflow: 'visible',
    },
    iconContainer: {
        width: 45,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    iconWrapper: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '800', // Keep stable to prevent layout shivering
        letterSpacing: 0.5,
    },
    indicatorContainer: {
        position: 'absolute',
        top: -3,
        left: 0,
        height: 3,
        alignItems: 'center',
        zIndex: 1001,
    },
    indicator: {
        width: 40,
        height: '100%',
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        ...select({
            ios: {
                shadowColor: 'rgba(0,0,0,0.3)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
        })
    }
});
