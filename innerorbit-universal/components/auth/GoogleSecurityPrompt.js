/**
 * Purpose: Prompt for Google-linked security verification and account protection.
 *
 * Props:
 *   isNudge (bool) – When true, renders as a dismissible bottom-sheet style modal
 *                    instead of a full-screen blocking overlay. Enables "Maybe Later".
 *   onSkip  (func) – Called when user taps "Maybe Later" (nudge mode only).
 *                    The usePasswordNudge hook handles scheduling the next appearance.
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Animated, Modal, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from "react-native";
import { isWeb, select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { updatePassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { LoadingDots } from "../ui/loading-dots";

export const GoogleSecurityPrompt = ({ THEME, onComplete, onSkip, showError, showSuccess, isNudge = false }) => {
    const { width } = useWindowDimensions();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [slideAnim] = useState(new Animated.Value(isNudge ? 80 : 0));
    const [fadeAnim] = useState(new Animated.Value(isNudge ? 0 : 1));

    const isLargeScreen = width > 600;

    React.useEffect(() => {
        if (isNudge) {
            // Animate in from bottom
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 280,
                    useNativeDriver: !isWeb,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: !isWeb,
                }),
            ]).start();
        }
    }, []);

    const handleSetPassword = async () => {
        if (password.length < 6) {
            showError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            showError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await updatePassword(auth.currentUser, password);

            // Update Firestore flag
            const { updateUserProfile } = await import("../../lib/firestore-service");
            await updateUserProfile(auth.currentUser.uid, { hasSetPassword: true });

            showSuccess("Account Security Initialized! 🎉");

            // Animate out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 280,
                useNativeDriver: !isWeb,
            }).start(() => onComplete());
        } catch (e) {
            if (e.code === 'auth/requires-recent-login') {
                showError("For security, please sign out and sign back in before setting a password.");
            } else {
                showError("Failed to set password. You can also do this in Settings → Security.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 120,
                duration: 240,
                useNativeDriver: !isWeb,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: !isWeb,
            }),
        ]).start(() => {
            if (onSkip) onSkip();
        });
    };

    // --- NUDGE MODE: Bottom-sheet style modal ---
    if (isNudge) {
        return (
            <Modal
                visible
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={handleSkip}
            >
                <Animated.View style={[
                    styles.nudgeOverlay,
                    { opacity: fadeAnim },
                    isLargeScreen && { alignItems: 'center' }
                ]}>
                    {/* Tap outside to skip */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleSkip} />

                    <Animated.View
                        style={[
                            styles.nudgeSheet,
                            { backgroundColor: THEME.surface, borderColor: THEME.border },
                            isLargeScreen && {
                                maxWidth: 500,
                                width: '90%',
                                alignSelf: 'center',
                                marginBottom: 24,
                                borderRadius: 28,
                            },
                            { transform: [{ translateY: slideAnim }] },
                        ]}
                    >
                        {/* Handle bar */}
                        <View style={[styles.handleBar, { backgroundColor: THEME.border }]} />

                        {/* Header row */}
                        <View style={styles.nudgeHeader}>
                            <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.2)' }]}>
                                <Feather name="shield" size={20} color={THEME.primary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.nudgeTitle, { color: THEME.text }]}>
                                    Set a Backup Password
                                </Text>
                                <Text style={[styles.nudgeSubtitle, { color: THEME.textSecondary }]}>
                                    Protect your account if you lose Google access
                                </Text>
                            </View>
                            <Pressable onPress={handleSkip} style={styles.closeBtn}>
                                <Feather name="x" size={20} color={THEME.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Password inputs */}
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <View style={[styles.inputWrapper, { borderColor: THEME.border, backgroundColor: THEME.background }]}>
                                <TextInput
                                    style={[styles.input, { color: THEME.text }]}
                                    placeholder="Create a password"
                                    placeholderTextColor={THEME.textSecondary}
                                    secureTextEntry={!showPass}
                                    value={password}
                                    onChangeText={setPassword}
                                    selectionColor={THEME.primary}
                                />
                                <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                                    <Feather name={showPass ? "eye" : "eye-off"} size={18} color={THEME.textSecondary} />
                                </Pressable>
                            </View>

                            <View style={[styles.inputWrapper, { borderColor: THEME.border, backgroundColor: THEME.background, marginTop: 10 }]}>
                                <TextInput
                                    style={[styles.input, { color: THEME.text }]}
                                    placeholder="Confirm password"
                                    placeholderTextColor={THEME.textSecondary}
                                    secureTextEntry={!showPass}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    selectionColor={THEME.primary}
                                    onSubmitEditing={handleSetPassword}
                                />
                            </View>

                            {/* Action row */}
                            <View style={styles.nudgeActions}>
                                <Pressable onPress={handleSkip} style={styles.skipBtn}>
                                    <Text style={[styles.skipText, { color: THEME.textSecondary }]}>
                                        Maybe Later
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={handleSetPassword}
                                    disabled={loading}
                                    style={({ pressed }) => [
                                        styles.nudgeSetBtn,
                                        { backgroundColor: THEME.primary, opacity: (pressed || loading) ? 0.8 : 1 },
                                    ]}
                                >
                                    {loading
                                        ? <ActivityIndicator color="#0F172A" size="small" />
                                        : <Text style={styles.nudgeSetBtnText}>Set Password</Text>
                                    }
                                </Pressable>
                            </View>
                        </KeyboardAvoidingView>

                        <Text style={[styles.footerNote, { color: THEME.textSecondary }]}>
                            You can always set this later in Settings → Security.
                        </Text>
                    </Animated.View>
                </Animated.View>
            </Modal>
        );
    }

    // --- BLOCKING MODE: Full-screen overlay (first-time / security_onboarding) ---
    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: THEME.background }]}>
            <View style={[styles.card, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
                <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                        <Feather name="shield" size={32} color={THEME.primary} />
                    </View>
                </View>

                <Text style={[styles.title, { color: THEME.text }]}>Protect Your Account</Text>
                <Text style={[styles.description, { color: THEME.textSecondary }]}>
                    Since you signed in with Google, we recommend setting a backup password to prevent
                    account lockout and ensure you can always access your messages.
                </Text>

                <View style={styles.inputWrapper}>
                    <TextInput
                        style={[styles.input, { color: THEME.text, borderColor: THEME.border, backgroundColor: THEME.background }]}
                        placeholder="Create a Backup Password"
                        placeholderTextColor={THEME.textSecondary}
                        secureTextEntry={!showPass}
                        value={password}
                        onChangeText={setPassword}
                        selectionColor={THEME.primary}
                        cursorColor={THEME.primary}
                    />
                    <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                        <Feather name={showPass ? "eye" : "eye-off"} size={20} color={THEME.textSecondary} />
                    </Pressable>
                </View>

                <View style={[styles.inputWrapper, { marginTop: -8 }]}>
                    <TextInput
                        style={[styles.input, { color: THEME.text, borderColor: THEME.border, backgroundColor: THEME.background }]}
                        placeholder="Confirm Password"
                        placeholderTextColor={THEME.textSecondary}
                        secureTextEntry={!showPass}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        selectionColor={THEME.primary}
                        cursorColor={THEME.primary}
                        onSubmitEditing={handleSetPassword}
                    />
                </View>

                <Pressable
                    onPress={handleSetPassword}
                    disabled={loading}
                    style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: THEME.primary, opacity: (pressed || loading) ? 0.8 : 1 },
                    ]}
                >
                    {loading
                        ? <ActivityIndicator color="#0F172A" />
                        : <Text style={styles.buttonText}>Set Security Password</Text>
                    }
                </Pressable>

                {/* Allow skip in blocking mode too – they can still access it via Settings */}
                {onSkip && (
                    <Pressable onPress={handleSkip} style={{ marginTop: 14, paddingVertical: 8 }}>
                        <Text style={[styles.footerNote, { color: THEME.textSecondary, textDecorationLine: 'underline' }]}>
                            Maybe Later
                        </Text>
                    </Pressable>
                )}

                <Text style={[styles.footerNote, { color: THEME.textSecondary, marginTop: onSkip ? 4 : 20 }]}>
                    This password will be required if you ever lose access to your Google account.
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    // ── Blocking mode ──────────────────────────────────────────────────────────
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
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
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16 },
            android: { elevation: 10 },
            web: { boxShadow: '0px 12px 16px rgba(0,0,0,0.3)' },
        }),
    },
    iconContainer: { marginBottom: 20 },
    iconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(251,113,133,0.1)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(251,113,133,0.2)',
    },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    description: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 28 },
    inputWrapper: { width: '100%', position: 'relative', marginBottom: 16 },
    input: {
        width: '100%', padding: 16, paddingRight: 50,
        borderRadius: 16, borderWidth: 1, fontSize: 16,
    },
    eyeIcon: { position: 'absolute', right: 16, top: 16 },
    button: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
    footerNote: { fontSize: 12, textAlign: 'center', opacity: 0.8 },

    // ── Nudge (bottom-sheet) mode ───────────────────────────────────────────────
    nudgeOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    nudgeSheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        padding: 24,
        paddingBottom: 36,
        ...select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 16 },
            android: { elevation: 20 },
            web: { boxShadow: '0px -8px 32px rgba(0,0,0,0.3)' },
        }),
    },
    handleBar: {
        width: 40, height: 4, borderRadius: 2,
        alignSelf: 'center', marginBottom: 20, opacity: 0.4,
    },
    nudgeHeader: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    },
    iconCircleSmall: {
        width: 44, height: 44, borderRadius: 22,
        borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    },
    nudgeTitle: { fontSize: 16, fontWeight: '700' },
    nudgeSubtitle: { fontSize: 12, marginTop: 2 },
    closeBtn: { padding: 6 },
    nudgeActions: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 16, gap: 12,
    },
    skipBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    skipText: { fontSize: 14, fontWeight: '500' },
    nudgeSetBtn: {
        flex: 2, paddingVertical: 14, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    nudgeSetBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
});
