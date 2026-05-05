/**
 * Purpose: Security modal for managing login persistence settings. Allows users to 
 * configure cross-session remembered state for faster administrative access.
 */
import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image } from 'react-native';
import { isWeb, isIOS, isAndroid, select } from '../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const LOGO_IMG = require("../assets/InnerOrbit-Logo.png");


/**
 * Privacy-First Login Persistence Consent Modal
 * 
 * Shows a non-coercive, transparent prompt asking if the user wants to
 * save their login for faster sign-in. Default is OFF to respect privacy.
 */
export function LoginPersistenceModal({ visible, onAccept, onDecline, isDarkMode = true }) {
    const THEME = {
        background: isDarkMode ? '#0F172A' : '#F8FAFC',
        cardBg: isDarkMode ? '#1E293B' : '#FFFFFF',
        text: isDarkMode ? '#F8FAFC' : '#0F172A',
        textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
        primary: '#fb7185',
        success: '#10B981',
        border: isDarkMode ? '#334155' : '#E2E8F0',
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDecline}
        >
            <View
                style={styles.overlay}
            >
                <View style={styles.modalContainer}>
                    {!isWeb && (
                        <BlurView
                            intensity={80}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={StyleSheet.absoluteFill}
                        />
                    )}

                    <Pressable style={[styles.modalContent, {
                        backgroundColor: isWeb
                            ? THEME.cardBg
                            : isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: THEME.border,
                    }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                            <Image source={LOGO_IMG} style={{ width: 40, height: 40 }} resizeMode="contain" />
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: THEME.text }]}>
                            Save Login for Faster Sign-In?
                        </Text>

                        {/* Description */}
                        <Text style={[styles.description, { color: THEME.textSecondary }]}>
                            We can securely save your credentials using {isIOS ? 'Keychain' : isAndroid ? 'Android Keystore' : 'secure storage'} to make future logins faster.
                        </Text>

                        {/* Privacy Notice */}
                        <View style={[styles.privacyNotice, {
                            backgroundColor: isDarkMode ? 'rgba(251, 113, 133, 0.1)' : 'rgba(251, 113, 133, 0.05)',
                            borderColor: isDarkMode ? 'rgba(251, 113, 133, 0.3)' : 'rgba(251, 113, 133, 0.2)',
                        }]}>
                            <Feather name="info" size={16} color={THEME.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.privacyText, { color: THEME.textSecondary }]}>
                                Your choice. No pressure. You can change this anytime in Settings.
                            </Text>
                        </View>

                        {/* What gets saved */}
                        <View style={styles.infoList}>
                            <View style={styles.infoItem}>
                                <Feather name="check" size={16} color={THEME.success} />
                                <Text style={[styles.infoText, { color: THEME.textSecondary }]}>
                                    Encrypted email & credentials
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Feather name="check" size={16} color={THEME.success} />
                                <Text style={[styles.infoText, { color: THEME.textSecondary }]}>
                                    Stored in {isIOS ? 'iOS Keychain' : isAndroid ? 'Android Keystore' : 'secure storage'}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Feather name="check" size={16} color={THEME.success} />
                                <Text style={[styles.infoText, { color: THEME.textSecondary }]}>
                                    Never shared with third parties
                                </Text>
                            </View>
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            {/* Decline Button (Primary position, respecting privacy-first) */}
                            <Pressable
                                style={[styles.button, styles.declineButton, {
                                    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
                                    borderColor: THEME.border,
                                }]}
                                onPress={onDecline}
                            >
                                <Text style={[styles.buttonText, { color: THEME.text }]}>
                                    No Thanks
                                </Text>
                            </Pressable>

                            {/* Accept Button */}
                            <Pressable
                                style={[styles.button, styles.acceptButton, {
                                    backgroundColor: THEME.primary,
                                }]}
                                onPress={onAccept}
                            >
                                <Feather name="shield" size={16} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={[styles.buttonText, { color: '#FFF' }]}>
                                    Save Securely
                                </Text>
                            </Pressable>
                        </View>

                        {/* Fine print */}
                        <Text style={[styles.finePrint, { color: THEME.textSecondary }]}>
                            Declining won't affect your experience. We'll ask again after a few more logins.
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 24,
        overflow: 'hidden',
    },
    modalContent: {
        padding: 24,
        borderWidth: 1,
        borderRadius: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Outfit_700Bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
    },
    privacyNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    privacyText: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Inter_500Medium',
        lineHeight: 18,
    },
    infoList: {
        marginBottom: 20,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingLeft: 8,
    },
    infoText: {
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        marginLeft: 10,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    declineButton: {
        borderWidth: 1,
    },
    acceptButton: {
        borderWidth: 0,
    },
    buttonText: {
        fontSize: 15,
        fontFamily: 'Outfit_600SemiBold',
    },
    finePrint: {
        fontSize: 11,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
        opacity: 0.7,
        lineHeight: 16,
    },
});
