import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';
import { isWeb, select } from "../../utils/platform";
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const NotificationCenter = ({
    visible,
    onClose,
    notifications = [],
    onRespond,
    THEME,
    isDesktop
}) => {
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: !isWeb,
                tension: 50,
                friction: 8
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: !isWeb
            }).start();
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    slideAnim.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100 || gestureState.vy > 0.5) {
                    Animated.timing(slideAnim, {
                        toValue: SCREEN_HEIGHT,
                        duration: 200,
                        useNativeDriver: !isWeb
                    }).start(onClose);
                } else {
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: !isWeb
                    }).start();
                }
            }
        })
    ).current;

    if (!visible && slideAnim._value === SCREEN_HEIGHT) return null;

    const renderContent = () => (
        <View style={{ flex: 1 }}>
            <BlurView
                intensity={100}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
            <View style={{
                flex: 1,
                padding: 24,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', // Darker for premium frost contrast
                ...(isWeb && {
                    backdropFilter: 'blur(30px)', // Increased intensity
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                })
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 }}>Notification Center</Text>
                    <Pressable onPress={onClose} style={{ padding: 4 }}>
                        <Feather name="x" size={36} color={THEME.primary} />
                    </Pressable>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        { paddingBottom: 20 },
                        notifications.length === 0 && { flex: 1, justifyContent: 'center' }
                    ]}
                >
                    {notifications.length === 0 ? (
                        <View style={{ alignItems: 'center' }}>
                            <Feather name="bell-off" size={40} color="#0EA5E9" style={{ opacity: 0.3, marginBottom: 12 }} />
                            <Text style={{ color: THEME.textSecondary, fontSize: 14 }}>No pending notifications</Text>
                        </View>
                    ) : (
                        notifications.map((notification, idx) => {
                            const senderId = notification.senderInfo?.userId || "Unknown";
                            return (
                                <View
                                    key={notification.id || idx}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={{ color: THEME.text, fontWeight: '700', fontSize: 15 }}>User {senderId}</Text>
                                        <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>Secure contact notification</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <Pressable
                                            onPress={() => onRespond(notification.id, 'declined', notification.senderId)}
                                            style={({ pressed }) => ({
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                borderWidth: 1,
                                                borderColor: 'rgba(239, 68, 68, 0.2)',
                                                opacity: pressed ? 0.7 : 1
                                            })}
                                        >
                                            <Feather name="x" size={20} color="#EF4444" />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => onRespond(notification.id, 'accepted', notification.senderId)}
                                            style={({ pressed }) => ({
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: THEME.primary + '20',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                borderWidth: 1,
                                                borderColor: THEME.primary + '40',
                                                opacity: pressed ? 0.7 : 1
                                            })}
                                        >
                                            <Feather name="check" size={20} color={THEME.primary} />
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </View>
    );

    if (isDesktop) {
        return (
            <View style={{
                position: 'absolute',
                top: 70,
                right: 25,
                width: 380,
                height: 500,
                borderRadius: 30,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                zIndex: 2000,
                ...select({
                    ios: {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.5,
                        shadowRadius: 20,
                    },
                    android: {
                        elevation: 10,
                    },
                    web: {
                        boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.5)',
                    },
                }),
            }}>
                {renderContent()}
            </View>
        );
    }

    return (
        <Animated.View
            style={{
                flex: 1,
                backgroundColor: 'transparent',
                zIndex: 1001,
                transform: [{ translateY: slideAnim }],
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                overflow: 'hidden',
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.2)',
            }}
        >
            {/* Swipe Handle - Centered perfectly on the border */}
            <View
                {...panResponder.panHandlers}
                style={{
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    top: 10,
                    left: 0,
                    right: 0,
                    height: 20,
                    zIndex: 20
                }}
            >
                <View style={{
                    width: 50, // Slightly narrower for cleaner look
                    height: 4, // Professional thickness
                    borderRadius: 2,
                    backgroundColor: THEME.primary,
                }} />
            </View>

            {renderContent()}
        </Animated.View>
    );
};
