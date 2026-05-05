/** Purpose: Account recovery flow via Firebase password reset emails. */
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { isWeb, select } from "../utils/platform";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SplitAuthLayout } from "../components/split-auth-layout";
// import { findUserByPin, isValidPinFormat } from "../lib/user-id-generator"; // Unused now
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Feather } from "@expo/vector-icons";
import { getFriendlyErrorMessage } from "../lib/error-handler";
import { CustomAlert } from "../components/ui/custom-alert";
import { getAuthTheme, getAuthStyles } from "../styles/auth.styles";
import { useAppTheme } from "../store/themeStore";


// Animated Floating Objects Component
const FloatingObjects = ({ THEME }) => {
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const float4 = useRef(new Animated.Value(0)).current;
  const rotate1 = useRef(new Animated.Value(0)).current;
  const rotate2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous floating animations
    const animation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(float1, { toValue: 1, duration: 3000, useNativeDriver: !isWeb }),
        Animated.timing(float1, { toValue: 0, duration: 3000, useNativeDriver: !isWeb }),
      ])
    );

    const animation2 = Animated.loop(
      Animated.sequence([
        Animated.timing(float2, { toValue: 1, duration: 4000, useNativeDriver: !isWeb }),
        Animated.timing(float2, { toValue: 0, duration: 4000, useNativeDriver: !isWeb }),
      ])
    );

    const animation3 = Animated.loop(
      Animated.sequence([
        Animated.timing(float3, { toValue: 1, duration: 5000, useNativeDriver: !isWeb }),
        Animated.timing(float3, { toValue: 0, duration: 5000, useNativeDriver: !isWeb }),
      ])
    );

    const animation4 = Animated.loop(
      Animated.sequence([
        Animated.timing(float4, { toValue: 1, duration: 3500, useNativeDriver: !isWeb }),
        Animated.timing(float4, { toValue: 0, duration: 3500, useNativeDriver: !isWeb }),
      ])
    );

    // Continuous rotation
    const rotation1 = Animated.loop(
      Animated.timing(rotate1, { toValue: 1, duration: 10000, useNativeDriver: !isWeb })
    );

    const rotation2 = Animated.loop(
      Animated.timing(rotate2, { toValue: 1, duration: 15000, useNativeDriver: !isWeb })
    );

    animation1.start();
    animation2.start();
    animation3.start();
    animation4.start();
    rotation1.start();
    rotation2.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
      animation4.stop();
      rotation1.stop();
      rotation2.stop();
    };
  }, []);

  const translateY1 = float1.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const translateY2 = float2.interpolate({ inputRange: [0, 1], outputRange: [0, 40] });
  const translateY3 = float3.interpolate({ inputRange: [0, 1], outputRange: [0, -25] });
  const translateY4 = float4.interpolate({ inputRange: [0, 1], outputRange: [0, 35] });
  const rotateZ1 = rotate1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateZ2 = rotate2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {/* Floating Circle 1 - Top Left (touching center) */}
      <Animated.View style={{
        position: 'absolute',
        top: '35%',
        left: '28%',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(251, 113, 133, 0.15)',
        transform: [{ translateY: translateY1 }, { rotate: rotateZ1 }],
      }} />

      {/* Floating Square 1 - Top Right (touching center) */}
      <Animated.View style={{
        position: 'absolute',
        top: '32%',
        right: '25%',
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        transform: [{ translateY: translateY2 }, { rotate: rotateZ2 }],
      }} />

      {/* Floating Circle 2 - Bottom Left (touching center) */}
      <Animated.View style={{
        position: 'absolute',
        bottom: '32%',
        left: '25%',
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(251, 113, 133, 0.12)',
        transform: [{ translateY: translateY3 }],
      }} />

      {/* Floating Square 2 - Bottom Right (touching center) */}
      <Animated.View style={{
        position: 'absolute',
        bottom: '35%',
        right: '28%',
        width: 70,
        height: 70,
        borderRadius: 16,
        backgroundColor: 'rgba(251, 113, 133, 0.08)',
        transform: [{ translateY: translateY4 }],
      }} />

      {/* Center Icon */}
      <View style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(251, 113, 133, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      }}>
        <Feather name="key" size={50} color="rgba(251, 113, 133, 0.8)" />
      </View>

      {/* Title */}
      <Text style={{
        marginTop: 30,
        fontSize: 24,
        fontFamily: 'Outfit_700Bold',
        color: THEME.text,
        textAlign: 'center',
      }}>
        Account Recovery
      </Text>
      <Text style={{
        marginTop: 10,
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
        color: THEME.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 40,
      }}>
        Use your recovery email to regain access to your account
      </Text>
    </View>
  );
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 1024 || height < 800; // Compact mode for Tablets & Laptops
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [error, setError] = useState(null);
  const emailRef = useRef(null);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });

  const { isDark } = useAppTheme();

  // Platform-Safe Theme Evaluation
  const THEME = React.useMemo(() => getAuthTheme('forgotPassword', isDark), [isDark]);

  const styles = React.useMemo(() => {
    const baseStyles = getAuthStyles(THEME, insets);
    return {
      ...baseStyles,
      formCard: {
        backgroundColor: THEME.cardBg,
        borderRadius: 28,
        padding: 24,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: THEME.border,
        width: '100%',
        alignSelf: 'stretch',
        ...(isWeb ? {
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 8px 32px rgba(31,38,135,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
        } : {}),
      },
      inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        overflow: 'hidden',
      },
      inputContainerFocused: {
        borderColor: THEME.primary,
      },
      inputIcon: {
        height: '100%',
        justifyContent: 'center',
        marginLeft: 16,
        marginRight: 12,
      },
      inputSeparator: {
        width: 1,
        height: 24,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        marginRight: 8,
      },
      warningCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
      },
      resetButton: [baseStyles.submitButton, { paddingVertical: isCompact ? 14 : 18, marginTop: 10 }],
      resetButtonText: baseStyles.submitButtonText,
    };
  }, [THEME, isCompact, insets]);

  const showError = (err) => {
    const msg = typeof err === 'string' ? err : getFriendlyErrorMessage(err);
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const getIconColor = (field) => focusedInput === field ? THEME.primary : THEME.textSecondary;

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showError("Please enter a valid email address so we can send you the reset link.");
      return false;
    }
    return true;
  };

  const handlePasswordReset = async () => {
    if (!validateEmail()) return;

    try {
      setLoading(true);

      // Configure deep link settings
      const actionCodeSettings = {
        url: 'https://innerorbit-bc8ce.firebaseapp.com/reset-password',
        handleCodeInApp: true,
        iOS: {
          bundleId: 'com.innerorbit.calcx'
        },
        android: {
          packageName: 'com.innerorbit.calcx',
          installApp: true,
          minimumVersion: '12'
        }
      };

      // Send password reset email with settings
      await sendPasswordResetEmail(auth, email, actionCodeSettings);

      const msg = "A password reset link has been sent to your email address. Please check your inbox and follow the instructions to reset your password.";

      setAlertConfig({
        visible: true,
        title: "Reset Email Sent",
        message: msg,
        type: 'success',
        buttons: [{
          text: "Back to Login",
          onPress: () => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            setTimeout(() => router.replace("/login"), 100);
          }
        }]
      });

    } catch (error) {
      console.error("Password reset error:", error);
      showError(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SplitAuthLayout
      mode="login"
      variant="primary"
      leftContent={<FloatingObjects THEME={THEME} />}
      mobileMinimal={true}
      formMaxWidth={480} // Reverted to narrower focused form
      centeredLeftContent={true}
    >

      {/* Header */}
      <View style={{
        marginTop: isWeb ? (isCompact ? 20 : 40) : 0,
        marginBottom: isCompact ? 16 : 24,
        alignItems: 'center',
        width: '100%',
        alignSelf: 'stretch'
      }}>
        <Text style={{ fontSize: isCompact ? 28 : 34, fontFamily: 'Outfit_700Bold', color: THEME.text, marginBottom: isCompact ? 4 : 8, textAlign: 'center' }}>
          Reset Password
        </Text>
      </View>

      <View style={[styles.formCard, { padding: isCompact ? 16 : 24 }]}>
        {/* Error Notification Banner */}
        {error && (
          <View style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Feather name="alert-circle" size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <Text style={{ color: '#EF4444', flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 }}>
              {error}
            </Text>
            <Pressable onPress={() => setError(null)}>
              <Feather name="x" size={16} color="#EF4444" style={{ opacity: 0.6 }} />
            </Pressable>
          </View>
        )}

        {/* Email Input */}
        <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 20 }]}>
          <Text style={[styles.label, { marginBottom: isCompact ? 4 : 8, fontSize: isCompact ? 13 : 14 }]}>Email Address</Text>
          <View style={[
            styles.inputContainer,
            focusedInput === 'email' && styles.inputContainerFocused
          ]}>
            <View style={styles.inputIcon}>
              <Feather name="mail" size={isCompact ? 18 : 20} color={getIconColor('email')} />
            </View>
            <View style={[styles.inputSeparator, focusedInput === 'email' && { backgroundColor: THEME.primary }]} />

            <TextInput
              ref={emailRef}
              selectionColor={THEME.primary}
              cursorColor={THEME.primary}
              style={[styles.input, { paddingVertical: isCompact ? 10 : 16, fontSize: isCompact ? 14 : 16 }]}
              placeholderTextColor={THEME.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => {
                setFocusedInput(null);
                // Reset selection to start so long emails are visible from the beginning
                if (emailRef.current) {
                  if (isWeb) {
                    try {
                      emailRef.current.setSelectionRange(0, 0);
                    } catch (e) {
                      // Ignore error for input types that don't support selection (like email)
                    }
                    emailRef.current.scrollLeft = 0;
                  } else {
                    emailRef.current.setSelection(0, 0);
                  }
                }
              }}
              underlineColorAndroid="transparent"
            />
          </View>
          <Text style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 6, marginLeft: 4 }}>
            We'll send a reset link to this email
          </Text>
        </View>

        {/* Warning Card */}
        <View style={styles.warningCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Feather name="alert-circle" size={16} color={THEME.danger} />
            <Text style={{ fontSize: 14, color: THEME.danger, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
              Security Notice
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: THEME.textSecondary, fontFamily: 'Inter_400Regular', lineHeight: 18 }}>
            Your PIN and User ID are permanent and cannot be changed or recovered if lost. Keep them secure.
          </Text>
        </View>

        {/* Reset Button */}
        <Pressable
          onPress={handlePasswordReset}
          disabled={loading}
          style={({ pressed }) => [
            styles.resetButton,
            {
              paddingVertical: isCompact ? 14 : 18,
              backgroundColor: THEME.primary,
              opacity: pressed || loading ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              ...select({
                ios: {
                  shadowColor: THEME.primary,
                  shadowOpacity: loading ? 0 : 0.4,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 8,
                },
                web: {
                  boxShadow: loading ? 'none' : `0px 4px 8px ${THEME.primary}66`,
                },
                default: { elevation: loading ? 0 : 4 }
              }),
            },
          ]}
        >
          <Text style={styles.resetButtonText}>
            {loading ? "Sending Reset Email..." : "Send Reset Email"}
          </Text>
        </Pressable>

      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.push("/login")} disabled={loading} hitSlop={10}>
          <Text style={{ color: THEME.primary, fontSize: isCompact ? 14 : 15, fontFamily: 'Outfit_700Bold' }}>
            ← Back to Login
          </Text>
        </Pressable>
      </View>


      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SplitAuthLayout >
  );
}

// Styles moved inside component for dynamic THEME support and safe Platform evaluation