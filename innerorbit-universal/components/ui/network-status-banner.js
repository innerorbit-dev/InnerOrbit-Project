/** Purpose: Non-intrusive banner indicating real-time network connectivity status. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { isWeb, select } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    interpolateColor
} from 'react-native-reanimated';
import { useNetwork } from '../../context/network-context';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function NetworkStatusBanner({ isDecoyMode }) {
    const { status, offlineQueue } = useNetwork();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    // Animation Shared Values
    const translateY = useSharedValue(-100);
    const opacity = useSharedValue(0);
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(1);

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // HIDE entirely if in Decoy Mode (Calculator)
        if (isDecoyMode) {
            translateY.value = withTiming(-100);
            opacity.value = withTiming(0, {}, () => {
                // Not using setVisible(false) here because Reanimated 2+ callbacks are on UI thread
                // but we can just let opacity handle it
            });
            return;
        }

        const shouldShow = status !== 'online';

        if (shouldShow) {
            setVisible(true);
            translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
            opacity.value = withTiming(1, { duration: 300 });

            // Trigger specific animations based on status
            if (status === 'reconnecting') {
                rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
                pulse.value = 1;
            } else if (status === 'offline') {
                pulse.value = withRepeat(withSequence(withTiming(1.1, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true);
                rotation.value = 0;
            } else {
                rotation.value = 0;
                pulse.value = 1;
            }
        } else {
            translateY.value = withTiming(-100, { duration: 500 });
            opacity.value = withTiming(0, { duration: 500 }, (finished) => {
                if (finished) {
                    // Reset animations
                    rotation.value = 0;
                    pulse.value = 1;
                }
            });
        }
    }, [status, isDecoyMode]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: status === 'reconnecting' ? `${rotation.value}deg` : '0deg' },
            { scale: status === 'offline' ? pulse.value : 1 }
        ]
    }));

    const getStatusConfig = () => {
        switch (status) {
            case 'offline':
                return {
                    tint: 'dark',
                    accentColor: '#FF3B30', // System Red
                    icon: 'wifi-off',
                    text: offlineQueue.length > 0
                        ? `Offline • ${offlineQueue.length} Pending`
                        : 'No Internet Connection',
                };
            case 'reconnecting':
                return {
                    tint: 'dark', // Switched to dark for premium consistency
                    accentColor: '#FF9500', // System Orange
                    icon: 'refresh-cw',
                    text: 'Reconnecting...',
                };
            case 'restored':
                return {
                    tint: 'dark', // Switched to dark for premium consistency
                    accentColor: '#34C759', // System Green
                    icon: 'check-circle',
                    text: 'Back Online',
                };
            default:
                return null;
        }
    };

    const config = getStatusConfig();
    if (!config || isDecoyMode) return null;

    return (
        <Animated.View style={[
            styles.bannerContainer,
            { top: isWeb ? 100 : (insets.top + 120) },
            containerStyle
        ]}>
            <BlurView
                intensity={100}
                tint="dark"
                style={[
                    styles.pill,
                    isWeb && {
                        backdropFilter: 'blur(15px)',
                        backgroundColor: 'rgba(0,0,0,0.5)'
                    }
                ]}
            >
                <Animated.View style={[styles.iconWrapper, iconStyle]}>
                    <Feather
                        name={config.icon}
                        size={14}
                        color={config.accentColor}
                    />
                </Animated.View>
                <Text style={[styles.bannerText, { color: '#FFF' }]}>
                    {config.text}
                </Text>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bannerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        pointerEvents: 'none',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 25,
        overflow: 'hidden', // Required for BlurView borderRadius
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'transparent',
        // Shadow for depth
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
            web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)' },
        }),
    },
    iconWrapper: {
        marginRight: 10,
    },
    bannerText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2
    }
});
