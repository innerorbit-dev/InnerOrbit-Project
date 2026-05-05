/** Purpose: Displays interactive release notes and new features walkthrough after app updates. */
import React, { useState, useRef } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, useWindowDimensions, Animated, FlatList } from 'react-native';
import { isWeb, select } from '../utils/platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../store/themeStore';
import { StatusBar } from 'expo-status-bar';
import { UpdateManager } from '../lib/update-manager';

const CURRENT_VERSION = UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : '1.0.2';

const SLIDES = [
    {
        id: '0',
        title: `InnerOrbit v${CURRENT_VERSION}`,
        desc: "The 'Stability & Aesthetics' Update. A more refined, responsive, and secure experience than ever before.",
        icon: "shield-check",
        color: "#6366F1",
        iconFamily: "MaterialCommunityIcons",
        isVersion: true,
        points: [
            "Production-Grade Hardening",
            "Unified Rose Pink Aesthetic",
            "Smart Dynamic Notifications",
            "Advanced Error Resilience"
        ]
    },
    {
        id: '1',
        title: "Rose Pink Visuals",
        desc: "A premium color refinement across all states. Experience the new high-contrast stealth aesthetic.",
        icon: "zap",
        color: "#fb7185"
    },
    {
        id: '1a',
        title: "Stealth Protection",
        desc: "Dynamic privacy alerts. System notifications are now automatically optimized to protect your identity in public.",
        icon: "lock-outline",
        color: "#3B82F6",
        iconFamily: "MaterialCommunityIcons"
    },
    {
        id: '1b',
        title: "Premium Glassy UI",
        desc: "Modern backdrop blurs and fluid navigation. InnerOrbit now feels more premium and natural than ever.",
        icon: "box",
        color: "#F59E0B"
    },
    {
        id: '2',
        title: "Seamless Reliability",
        desc: "Enhanced infrastructure ensures the app remains lightning fast and perfectly stable during every session.",
        icon: "check-decagram",
        color: "#10B981",
        iconFamily: "MaterialCommunityIcons"
    }
];

export default function UpdateWalkthrough({ visible, onClose }) {
    const { theme: THEME, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const arrowAnim = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef(null);

    React.useEffect(() => {
        if (visible) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(arrowAnim, {
                        toValue: 5,
                        duration: 800,
                        useNativeDriver: !isWeb,
                    }),
                    Animated.timing(arrowAnim, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: !isWeb,
                    })
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [visible]);

    const isDesktop = width > 768;
    const MODAL_WIDTH = isDesktop ? 480 : width * 0.9;
    const MODAL_HEIGHT = isDesktop ? 600 : height * 0.75; // Increased slightly for summary points

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({
        viewAreaCoveragePercentThreshold: 50,
    }).current;

    const renderItem = ({ item, index }) => {
        const inputRange = [
            (index - 1) * MODAL_WIDTH,
            index * MODAL_WIDTH,
            (index + 1) * MODAL_WIDTH,
        ];

        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
        });

        const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [50, 0, 50],
            extrapolate: 'clamp',
        });

        return (
            <View style={[styles.slide, { width: MODAL_WIDTH }]}>
                <Animated.View style={[
                    styles.iconCircle,
                    {
                        backgroundColor: item.color + '20',
                        transform: [{ scale }, { translateY }],
                        opacity,
                        marginBottom: item.isVersion ? 25 : 40
                    }
                ]}>
                    {item.iconFamily === 'MaterialCommunityIcons' ? (
                        <MaterialCommunityIcons name={item.icon} size={60} color={item.color} />
                    ) : (
                        <Feather name={item.icon} size={54} color={item.color} />
                    )}
                </Animated.View>

                <Animated.Text style={[styles.title, { color: THEME.text, opacity, transform: [{ translateY }] }]}>
                    {item.title}
                </Animated.Text>

                <Animated.Text style={[styles.desc, {
                    color: THEME.textSecondary,
                    opacity,
                    transform: [{ translateY }],
                    marginBottom: item.isVersion ? 20 : 0
                }]}>
                    {item.desc}
                </Animated.Text>

                {item.isVersion && item.points && (
                    <Animated.View style={{ opacity, transform: [{ translateY }], width: '100%', paddingHorizontal: 20 }}>
                        {item.points.map((point, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.primary, marginRight: 12 }} />
                                <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>{point}</Text>
                            </View>
                        ))}
                    </Animated.View>
                )}
            </View>
        );
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.overlay}>
                {/* High intensity full screen blur to isolate the walkthrough */}
                <BlurView
                    intensity={isDark ? 90 : 70}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                />
                <StatusBar style={isDark ? "light" : "dark"} />

                {/* The Seamless Semi-Transparent Container */}
                <View style={[
                    styles.container,
                    {
                        width: MODAL_WIDTH,
                        height: MODAL_HEIGHT,
                        backgroundColor: THEME.background,
                        borderColor: THEME.border
                    }
                ]}>
                    {/* Header Controls */}
                    <View style={styles.header}>
                        <View style={styles.dotsContainer}>
                            {/* ... dots logic ... */}
                            {SLIDES.map((_, i) => {
                                const dotWidth = scrollX.interpolate({
                                    inputRange: [(i - 1) * MODAL_WIDTH, i * MODAL_WIDTH, (i + 1) * MODAL_WIDTH],
                                    outputRange: [8, 24, 8],
                                    extrapolate: 'clamp',
                                });
                                const dotOpacity = scrollX.interpolate({
                                    inputRange: [(i - 1) * MODAL_WIDTH, i * MODAL_WIDTH, (i + 1) * MODAL_WIDTH],
                                    outputRange: [0.3, 1, 0.3],
                                    extrapolate: 'clamp',
                                });
                                return (
                                    <Animated.View
                                        key={i}
                                        style={[
                                            styles.dot,
                                            {
                                                width: dotWidth,
                                                opacity: dotOpacity,
                                                backgroundColor: THEME.primary
                                            }
                                        ]}
                                    />
                                );
                            })}
                        </View>
                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.closeBtn,
                                { opacity: pressed ? 0.7 : 1 }
                            ]}
                        >
                            <Feather name="x" size={24} color={THEME.textSecondary} />
                        </Pressable>
                    </View>

                    <FlatList
                        ref={flatListRef}
                        data={SLIDES}
                        renderItem={renderItem}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                            { useNativeDriver: false }
                        )}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        keyExtractor={item => item.id}
                        scrollEventThrottle={16}
                    />

                    <View style={[
                        styles.footer,
                        { paddingBottom: Math.max(insets.bottom, 24) + 8 }
                    ]}>
                        <View style={styles.buttonRow}>
                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.skipBtnBottom,
                                    { backgroundColor: THEME.surface, borderColor: THEME.border, opacity: pressed ? 0.7 : 1 }
                                ]}
                            >
                                <Text style={[styles.skipBtnText, { color: THEME.textSecondary }]}>Skip</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    if (currentIndex < SLIDES.length - 1) {
                                        flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
                                    } else {
                                        onClose();
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.mainBtn,
                                    { backgroundColor: THEME.primary, opacity: pressed ? 0.9 : 1 }
                                ]}
                            >
                                <Text style={styles.mainBtnText}>
                                    {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
                                </Text>
                                <Animated.View style={{
                                    transform: [{ translateX: arrowAnim }],
                                    marginLeft: 8
                                }}>
                                    <Feather
                                        name={currentIndex === SLIDES.length - 1 ? "check" : "chevron-right"}
                                        size={20}
                                        color="#FFF"
                                    />
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    container: {
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        ...select({
            web: { boxShadow: '0px 32px 64px rgba(0,0,0,0.3)' }
        })
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 32,
        paddingBottom: 0,
        zIndex: 10
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    closeBtn: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 30,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5
    },
    desc: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 10,
        maxWidth: 320
    },
    footer: {
        padding: 24,
        paddingBottom: 32,
        zIndex: 10
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center'
    },
    skipBtnBottom: {
        flex: 1,
        height: 60,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    skipBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    mainBtn: {
        flex: 1,
        height: 60,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        ...select({
            web: { boxShadow: '0px 8px 24px rgba(251, 113, 133, 0.3)' }
        })
    },
    mainBtnText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.5
    }
});
