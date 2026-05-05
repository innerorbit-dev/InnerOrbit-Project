/** Purpose: Landing page for password reset links sent via email. */
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { isWeb } from "../utils/platform";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SplitAuthLayout } from "../components/split-auth-layout";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Feather } from "@expo/vector-icons";
import { getFriendlyErrorMessage } from "../lib/error-handler";
import { CustomAlert } from "../components/ui/custom-alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuthTheme, getAuthStyles } from "../styles/auth.styles";
import { useAppTheme } from "../store/themeStore";


// Reuse Floating Objects
const FloatingObjects = ({ THEME, isDark }) => {
    // Simplified static version or reuse animated? Let's reuse animated for consistency
    // To save space, assumes same implementation as forgot-password.js
    // For brevity in this generation, I'll copy the implementation:
    const float1 = useRef(new Animated.Value(0)).current;
    const rotate1 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(float1, { toValue: 1, duration: 4000, useNativeDriver: !isWeb }),
                Animated.timing(float1, { toValue: 0, duration: 4000, useNativeDriver: !isWeb }),
            ])
        ).start();
        Animated.loop(
            Animated.timing(rotate1, { toValue: 1, duration: 10000, useNativeDriver: !isWeb })
        ).start();
    }, []);

    const translateY1 = float1.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
    const rotateZ1 = rotate1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View style={{
                position: 'absolute',
                top: '35%',
                left: '28%',
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
                transform: [{ translateY: translateY1 }, { rotate: rotateZ1 }],
            }} />
            <View style={{
                width: 120, height: 120, borderRadius: 60,
                backgroundColor: 'rgba(251, 113, 133, 0.2)',
                justifyContent: 'center', alignItems: 'center', zIndex: 10
            }}>
                <Feather name="lock" size={50} color="rgba(251, 113, 133, 0.8)" />
            </View>
        </View>
    );
};

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { isDark } = useAppTheme();
    const { width, height } = useWindowDimensions();
    const isMobile = width <= 768;
    const isCompact = width < 1024 || height < 800;
    const { oobCode, mode } = useLocalSearchParams();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [error, setError] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });

    const insets = useSafeAreaInsets();

    // Platform-Safe Theme Evaluation
    const THEME = React.useMemo(() => getAuthTheme('resetPassword', isDark), [isDark]);

    const styles = React.useMemo(() => {
        const baseStyles = getAuthStyles(THEME, insets);
        return {
            ...baseStyles,
            formCard: {
                backgroundColor: THEME.cardBg,
                borderRadius: 24,
                padding: 24,
                marginBottom: 32,
                borderWidth: 1,
                borderColor: THEME.border,
                width: '100%',
                alignSelf: 'stretch',
                ...(isWeb ? { backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' } : {}),
            },
            resetButton: {
                ...baseStyles.submitButton,
                paddingVertical: isCompact ? 14 : 18,
            },
            resetButtonText: baseStyles.submitButtonText,
        };
    }, [THEME, insets, isCompact]);

    const getIconColor = (field) => focusedInput === field ? THEME.primary : THEME.textSecondary;

    useEffect(() => {
        // Mode should be resetPassword
        if (!oobCode) {
            // Checking for oobCode in standard locations if not found via search params (e.g. hash)
            // For now, assume oobCode is passed correctly or show error
            setError("Invalid or missing reset code. Please try the link again.");
        }
    }, [oobCode]);

    const handleReset = async () => {
        if (password.length < 6) {
            showError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            showError("Passwords do not match.");
            return;
        }
        if (!oobCode) {
            showError("Missing reset code. Please trigger the reset again.");
            return;
        }

        try {
            setLoading(true);
            await confirmPasswordReset(auth, oobCode, password);

            setAlertConfig({
                visible: true,
                title: "Password Reset Success",
                message: "Your password has been updated securely. You can now login with your new password.",
                type: 'success',
                buttons: [{
                    text: "Login Now",
                    onPress: () => {
                        setAlertConfig(prev => ({ ...prev, visible: false }));
                        router.replace("/login");
                    }
                }]
            });
        } catch (err) {
            showError(getFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SplitAuthLayout
            mode="login"
            variant="primary"
            leftContent={<FloatingObjects THEME={THEME} isDark={isDark} />}
            mobileMinimal={true}
            formMaxWidth={480}
            centeredLeftContent={true}
        >
            <View style={{ marginTop: isWeb ? (isCompact ? 20 : 40) : 0, marginBottom: isCompact ? 16 : 24, alignItems: 'center', width: '100%' }}>
                <Text style={{ fontSize: isCompact ? 28 : 34, fontFamily: 'Outfit_700Bold', color: THEME.text, marginBottom: 8, textAlign: 'center' }}>
                    Set New Password
                </Text>
            </View>

            <View style={[styles.formCard, { padding: isCompact ? 16 : 24 }]}>
                {error && (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 10 }} />
                        <Text style={{ color: '#EF4444', flex: 1, fontSize: isCompact ? 13 : 14 }}>{error}</Text>
                    </View>
                )}

                {/* Password */}
                <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 20 }]}>
                    <Text style={[styles.label, { marginBottom: isCompact ? 4 : 8, fontSize: isCompact ? 13 : 14 }]}>New Password</Text>
                    <View style={[styles.inputContainer, focusedInput === 'password' && styles.inputContainerFocused]}>
                        <View style={styles.inputIcon}><Feather name="lock" size={isCompact ? 18 : 20} color={getIconColor('password')} /></View>
                        <View style={styles.inputSeparator} />
                        <TextInput
                            style={[styles.input, { paddingVertical: isCompact ? 10 : 16, fontSize: isCompact ? 14 : 16 }]}
                            placeholderTextColor={THEME.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            onFocus={() => setFocusedInput('password')}
                            onBlur={() => setFocusedInput(null)}
                            textContentType="newPassword"
                            autoComplete="new-password"
                        />
                        <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessible={true} accessibilityRole="button">
                            <Feather name={showPassword ? "eye" : "eye-off"} size={isCompact ? 18 : 20} color={THEME.textSecondary} />
                        </Pressable>
                    </View>
                </View>

                {/* Confirm Password */}
                <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 20 }]}>
                    <Text style={[styles.label, { marginBottom: isCompact ? 4 : 8, fontSize: isCompact ? 13 : 14 }]}>Confirm Password</Text>
                    <View style={[styles.inputContainer, focusedInput === 'confirm' && styles.inputContainerFocused]}>
                        <View style={styles.inputIcon}><Feather name="check-circle" size={isCompact ? 18 : 20} color={getIconColor('confirm')} /></View>
                        <View style={styles.inputSeparator} />
                        <TextInput
                            style={[styles.input, { paddingVertical: isCompact ? 10 : 16, fontSize: isCompact ? 14 : 16 }]}
                            placeholderTextColor={THEME.textSecondary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            onFocus={() => setFocusedInput('confirm')}
                            onBlur={() => setFocusedInput(null)}
                            textContentType="newPassword"
                            autoComplete="new-password"
                            onSubmitEditing={handleReset}
                            returnKeyType="go"
                        />
                        <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessible={true} accessibilityRole="button">
                            <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={isCompact ? 18 : 20} color={THEME.textSecondary} />
                        </Pressable>
                    </View>
                </View>

                <Pressable onPress={handleReset} disabled={loading} style={({ pressed }) => [styles.resetButton, { backgroundColor: THEME.primary, paddingVertical: isCompact ? 14 : 18, opacity: pressed || loading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                    <Text style={styles.resetButtonText}>{loading ? "Updating..." : "Update Password"}</Text>
                </Pressable>
            </View>

            <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} buttons={alertConfig.buttons} onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))} />
        </SplitAuthLayout>
    );
}


// Styles moved inside component for dynamic THEME support and safe Platform evaluation
