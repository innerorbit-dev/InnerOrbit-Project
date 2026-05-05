/** Purpose: Prompt for Google-linked security verification and account protection. */
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Animated } from "react-native";
import { isWeb, select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { updatePassword } from "firebase/auth";
import { auth } from "../../lib/firebase";

export const GoogleSecurityPrompt = ({ THEME, onComplete, showError, showSuccess }) => {
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fadeOut] = useState(new Animated.Value(1));

    const handleSetPassword = async () => {
        if (password.length < 6) {
            showError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            await updatePassword(auth.currentUser, password);

            // Update profile flag in Firestore
            const { updateUserProfile } = await import("../../lib/firestore-service");
            await updateUserProfile(auth.currentUser.uid, { hasSetPassword: true });

            showSuccess("Account Security Initialized!");

            // Animate out
            Animated.timing(fadeOut, {
                toValue: 0,
                duration: 300,
                useNativeDriver: !isWeb,
            }).start(() => onComplete());
        } catch (e) {
            console.error("Security setup failed:", e);
            showError("Failed to set password. Please try again or go to Settings.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeOut, backgroundColor: THEME.background }]}>
            <View style={[styles.card, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
                <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                        <Feather name="shield" size={32} color={THEME.primary} />
                    </View>
                </View>

                <Text style={[styles.title, { color: THEME.text }]}>Protect Your Account</Text>
                <Text style={[styles.description, { color: THEME.textSecondary }]}>
                    Since you signed in with Google, we recommend setting a backup password to prevent account lockout and ensure you can always access your messages.
                </Text>

                <View style={styles.inputWrapper}>
                    <TextInput
                        style={[styles.input, { color: THEME.text, borderColor: THEME.border, backgroundColor: THEME.background }]}
                        placeholder="Create a Stout Password"
                        placeholderTextColor={THEME.textSecondary}
                        secureTextEntry={!showPass}
                        value={password}
                        onChangeText={setPassword}
                        selectionColor={THEME.primary}
                        cursorColor={THEME.primary}
                    />
                    <Pressable
                        onPress={() => setShowPass(!showPass)}
                        style={styles.eyeIcon}
                    >
                        <Feather name={showPass ? "eye" : "eye-off"} size={20} color={THEME.textSecondary} />
                    </Pressable>
                </View>

                <Pressable
                    onPress={handleSetPassword}
                    disabled={loading}
                    style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: THEME.primary, opacity: (pressed || loading) ? 0.8 : 1 }
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#0F172A" />
                    ) : (
                        <Text style={styles.buttonText}>Set Security Password</Text>
                    )}
                </Pressable>

                <Text style={[styles.footerNote, { color: THEME.textSecondary }]}>
                    This password will be required if you ever lose access to your Google account.
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999, // Below WelcomeModal (usually 1000+ or separate Modal)
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 28,
        padding: 32,
        borderWidth: 1,
        alignItems: 'center',
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
            },
            android: {
                elevation: 10,
            },
            web: {
                boxShadow: '0px 12px 16px rgba(0, 0, 0, 0.3)',
            }
        }),
    },
    iconContainer: {
        marginBottom: 20,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(251, 113, 133, 0.2)',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 28,
    },
    inputWrapper: {
        width: '100%',
        position: 'relative',
        marginBottom: 24,
    },
    input: {
        width: '100%',
        padding: 16,
        paddingRight: 50,
        borderRadius: 16,
        borderWidth: 1,
        fontSize: 16,
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    button: {
        width: '100%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#0F172A',
        fontWeight: '800',
        fontSize: 16,
    },
    footerNote: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
        opacity: 0.8,
    }
});
