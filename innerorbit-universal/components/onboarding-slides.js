/** Purpose: Animated onboarding walkthrough slides for new users. */
import React, { useRef, useState } from 'react';
import { View, Text, FlatList, Dimensions, StatusBar, Pressable, StyleSheet, Image, useWindowDimensions, Animated, Easing } from 'react-native';
import { select, isWeb } from '../utils/platform';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window'); // Fallback

const SLIDES = [
    {
        id: '1',
        title: 'Hidden in Plain Sight',
        description: 'InnerOrbit is a fully functional calculator that secretly houses a secure chat network. It looks innocent, so your privacy remains unquestioned.',
        icon: 'slash', // 'slash' represents the cut/hidden aspect better, or 'layers'
        image: null,
    },
    // {
    //     id: '2',
    //     title: 'Decoy Mode',
    //     description: 'Ever forced to unlock? Use a Decoy PIN to trigger a fake, empty account. Your real profile stays hidden, and you stay safe.',
    //     icon: 'lock',
    //     image: null,
    // },
    {
        id: '3',
        title: 'No Phone Numbers',
        description: 'We don\'t use phone numbers or upload your contacts. Connect securely by exchanging unique User IDs. You are in complete control of who finds you.' + '\n' + '\nWe will introduce the block feature in the future updates.',
        icon: 'shield',
        image: null,
    },
    {
        id: '4',
        title: 'Social Privacy',
        description: 'Your chats, your visibility controls. Social Privacy safeguards you in the real world, ensuring your conversations remain hidden from family and prying eyes with a stealth interface.',
        icon: 'users',
        image: null,
    }
];

const Slide = ({ item, width, height, isActive, THEME }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    React.useEffect(() => {
        if (isActive) {
            // Animate In: Fade in and slide UP from 20 to 0
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: !isWeb,
                    easing: Easing.out(Easing.cubic),
                    delay: isWeb ? 0 : 100,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: !isWeb,
                    easing: Easing.out(Easing.cubic),
                    delay: isWeb ? 0 : 100,
                }),
            ]).start();
        } else {
            // Reset immediately when inactive so it can animate in again
            if (isWeb) {
                // On web, avoid flickering by just setting it if it's inactive but nearby
                fadeAnim.setValue(0);
                translateY.setValue(20);
            } else {
                fadeAnim.setValue(0);
                translateY.setValue(20);
            }
        }
    }, [isActive]);

    return (
        <View style={[styles.slide, { width, height }]}>
            <View style={styles.contentContainer}>
                <View style={[styles.iconContainer, { backgroundColor: THEME.surface }]}>
                    <Feather name={item.icon} size={64} color={THEME.primary} />
                </View>

                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
                    <Text style={[styles.title, { color: THEME.text }]}>
                        {item.title}
                    </Text>

                    <Text style={[styles.description, { color: THEME.textSecondary }]}>
                        {item.description}
                    </Text>
                </Animated.View>
            </View>
        </View>
    );
};

export const OnboardingSlides = ({ visible, onClose, THEME }) => {
    const { width, height } = useWindowDimensions();
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleScroll = (event) => {
        const scrollOffset = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(scrollOffset / width);
        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            const nextIndex = currentIndex + 1;
            if (isWeb) {
                flatListRef.current?.scrollToOffset({
                    offset: nextIndex * width,
                    animated: true,
                });
            } else {
                flatListRef.current?.scrollToIndex({
                    index: nextIndex,
                    animated: true,
                });
            }
        } else {
            onClose();
        }
    };

    const handleSkip = () => {
        onClose();
    };

    const renderItem = ({ item, index }) => {
        return (
            <Slide
                item={item}
                width={width}
                height={height}
                isActive={index === currentIndex}
                THEME={THEME}
            />
        );
    };

    if (!visible) return null;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#812e2eff']} // Slate -> Indigo (Rich Primary BG)
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                extraData={currentIndex}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
            />

            {/* Footer / Pagination */}
            <View style={styles.footer}>
                {/* Paginator Dots */}
                <View style={styles.paginatorContainer}>
                    {SLIDES.map((_, index) => {
                        const isActive = index === currentIndex;
                        return (
                            <View
                                key={index.toString()}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: isActive ? THEME.primary : 'rgba(255, 255, 255, 0.41)',
                                        width: isActive ? 24 : 8,
                                    }
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                    {currentIndex < SLIDES.length - 1 ? (
                        <>
                            <Pressable onPress={handleSkip} style={styles.skipButton}>
                                <Text style={[styles.skipText, { color: THEME.textSecondary }]}>Skip</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleNext}
                                style={[styles.nextButton, { backgroundColor: THEME.primary }]}
                            >
                                <Text style={styles.nextText}>Next</Text>
                                <Feather name="arrow-right" size={20} color="#0F172A" />
                            </Pressable>
                        </>
                    ) : (
                        <Pressable
                            onPress={handleNext}
                            style={[styles.finishButton, { backgroundColor: THEME.primary }]}
                        >
                            <Text style={styles.nextText}>Get Started</Text>
                            <Feather name="check" size={20} color="#0F172A" />
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        ...select({
            android: {
                elevation: 100, // Ensure it sits on top if used as a modal/overlay
                zIndex: 100,
            },
            ios: {
                zIndex: 100,
            },
            web: {
                position: 'fixed',
                zIndex: 100,
            }
        }),
    },
    slide: {
        width: windowWidth,
        height: windowHeight,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    contentContainer: {
        alignItems: 'center',
        maxWidth: 500, // Limit width for tablets/desktop
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        // Add subtle shadow/glow
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
            web: {
                boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)',
            },
        }),
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 16,
    },
    footer: {
        position: 'absolute',
        bottom: 90, // Moved up to clear nav bar
        left: 0,
        right: 0,
        paddingHorizontal: 32,
    },
    paginatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 40,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 50, // Fixed height to prevent layout jumps
    },
    skipButton: {
        padding: 12,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        gap: 8,
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%', // Full width for finish
        gap: 8,
    },
    nextText: {
        color: '#0F172A',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
