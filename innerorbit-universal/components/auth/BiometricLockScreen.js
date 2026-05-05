/** Purpose: Secondary lock screen for biometric authentication (FaceID/Fingerprint). */
import React, { useEffect } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import { StatusBar } from 'expo-status-bar';

export const BiometricLockScreen = ({ onAuthenticate }) => {
    const { theme: THEME } = useAppTheme();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();

        // Auto trigger on mount
        const timer = setTimeout(() => {
            onAuthenticate();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: THEME.background }]}>
            <StatusBar style="light" />
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <View style={[styles.iconContainer, { backgroundColor: `${THEME.primary}20` }]}>
                    <MaterialCommunityIcons name="fingerprint" size={80} color={THEME.primary} />
                </View>

                <Text style={[styles.title, { color: THEME.text }]}>Identity Required</Text>
                <Text style={[styles.subtitle, { color: THEME.textSecondary }]}>
                    Scan your fingerprint or face to unlock your secure workspace
                </Text>

                <Pressable
                    onPress={onAuthenticate}
                    style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: THEME.primary, opacity: pressed ? 0.9 : 1 }
                    ]}
                >
                    <Text style={styles.buttonText}>Unlock with Biometrics</Text>
                </Pressable>

                <Text style={[styles.footer, { color: THEME.textSecondary }]}>
                    Locked for your privacy
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
        maxWidth: 400,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 60,
    },
    button: {
        paddingHorizontal: 40,
        paddingVertical: 18,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    footer: {
        marginTop: 40,
        fontSize: 11,
        letterSpacing: 3,
        textTransform: 'uppercase',
        opacity: 0.5,
    },
});
