/** Purpose: New user registration screen with integrated onboarding tutorials. */
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, useWindowDimensions } from "react-native";
import { isWeb, select } from "../utils/platform";
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth-context";
import { SplitAuthLayout } from "../components/split-auth-layout";
import { auth } from "../lib/firebase";
import { Feather } from "@expo/vector-icons";
import { getAuthTheme, getAuthStyles } from "../styles/auth.styles";
import { OnboardingSlides } from "../components/onboarding-slides";
import { CustomAlert } from "../components/ui/custom-alert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logger } from "../lib/logger";
import { useAppTheme } from "../store/themeStore";

import { getFriendlyErrorMessage } from "../lib/error-handler";

export default function SignUpScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 1024; // Increased from 768 to allow slides on tablet-sized web views
  const isMobile = width <= 768;
  const isCompact = width < 1024 || height < 800; // Compact mode for Tablets & Laptops
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const { signUp, user, welcomeData, setWelcomeData } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });

  const THEME = React.useMemo(() => getAuthTheme('signup', isDark), [isDark]);
  const styles = React.useMemo(() => StyleSheet.create({
    // Existing Styles
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 32, // Increased padding
      paddingVertical: 48, // Increased padding for mobile
    },
    formCard: {
      backgroundColor: THEME.cardBg,
      borderRadius: 28,
      padding: 24,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: THEME.border,
      width: '100%',
      alignSelf: 'stretch',
      minHeight: 420,
      ...(isWeb ? {
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 8px 32px rgba(31,38,135,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
      } : {}),
    },
    inputGroup: {
      marginBottom: 24, // Increased margin
    },
    label: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: THEME.text,
      marginBottom: 4,
      marginLeft: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent', // Fully transparent
      borderRadius: 16,
      borderWidth: 1,
      borderColor: THEME.border,
      overflow: 'hidden',
    },
    inputContainerFocused: {
      borderColor: THEME.primary,
      // Removed elevation and shadow to prevent rectangular box effect
    },
    inputIcon: {
      marginLeft: 16,
      marginRight: 12,
    },
    inputSeparator: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      marginRight: 8,
    },

    input: {
      flex: 1,
      paddingVertical: 16, // Increased height
      paddingRight: 16,
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      color: THEME.text,
      backgroundColor: 'transparent',
    },
    forgotPassword: {
      alignSelf: 'flex-end',
      marginBottom: 14,
      marginTop: 4,
    },
    forgotPasswordText: {
      color: THEME.primary,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
    },
    submitButton: {
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden', // For animated background
    },
    signInButtonLoading: {
      opacity: 0.8,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    spinner: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: THEME.background,
      borderTopColor: 'transparent',
      borderRadius: 10,
      marginRight: 12,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
      color: '#FFFFFF', // Changed from THEME.background (Dark) to White for better contrast
      letterSpacing: 0.5,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
      paddingBottom: 0,
    },
    footerText: {
      color: THEME.textSecondary,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
    },
    footerLink: {
      color: THEME.primary,
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
    },
    checkboxWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      marginTop: 0,
      paddingHorizontal: 4,
    },
    checkboxCustom: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    checkboxLabel: {
      fontSize: 14,
      color: THEME.textSecondary,
      fontFamily: 'Inter_500Medium',
    },
  }), [THEME, isDark]);

  const showError = (err) => {
    const msg = typeof err === 'string' ? err : getFriendlyErrorMessage(err);
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double submission
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // Legal Compliance State
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Show security warning on mount (Web Only)
  useEffect(() => {
    if (isWeb) {
      setSecurityWarning("Security Tip: Avoid saving passwords in your browser. This app securely manages your credentials on all platforms.");
    }
  }, []);

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        if (hasSeenOnboarding === 'true' || isDesktop) {
          setShowOnboarding(false);
        }
      } catch (error) {
        Logger.log('Error checking onboarding status:', error);
      }
    };
    checkOnboarding();
  }, [isDesktop]);

  // Helper for icon color
  const getIconColor = (field) => focusedInput === field ? THEME.primary : THEME.textSecondary;

  const validateInputs = () => {
    if (!ageConfirmed) {
      showError("You must confirm that you are at least 13 years old to use InnerOrbit.");
      return false;
    }
    if (!termsAccepted) {
      showError("Please accept the Terms of Service and Privacy Policy to continue.");
      return false;
    }
    if (!email || !password || !confirmPassword) {
      showError("Please fill in all the details to create your secure account.");
      return false;
    }
    if (password.length < 6) {
      showError("Your password is a bit short. Please use at least 6 characters for better protection.");
      return false;
    }
    if (password !== confirmPassword) {
      showError("The passwords you entered don't match. Please re-type them.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError("That email format doesn't look right. Please check for any typos.");
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validateInputs()) return;
    if (isSubmitting) return; // Prevent double submission

    try {
      setLoading(true);
      setIsSubmitting(true);

      // Now returns { userId, pin } directly
      const { userId, pin } = await signUp(email, password);

      const handleSuccessAction = async () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        setWelcomeData(null);
        // Mark onboarding as seen
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        router.replace("/home");
      };

      const welcomeMsg = (
        <Text>
          Your unique ID: <Text style={{ color: '#60A5FA', fontWeight: 'bold' }}>{userId}</Text>{"\n"}
          Your recovery PIN: <Text style={{ color: '#60A5FA', fontWeight: 'bold' }}>{pin}</Text>{"\n\n"}
          <Text style={{ color: '#F87171', fontWeight: '600' }}>⚠️ IMPORTANT: Both your ID and PIN are permanent and cannot be changed.</Text>{"\n\n"}
          Share your ID with people to start chatting.
        </Text>
      );

      setAlertConfig({
        visible: true,
        title: "Welcome to InnerOrbit",
        message: welcomeMsg,
        type: 'success',
        contentStyle: { backgroundColor: '#2a0a0d', borderColor: '#ef4444' },
        buttons: [{ text: "Let's Go", onPress: handleSuccessAction }]
      });
    } catch (error) {
      Logger.log("Signup Error Caught:", error);
      showError(error);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  // Handle Onboarding Completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    // Don't mark as seen yet - only mark after successful signup
  };

  return (
    <>
      <SplitAuthLayout
        mode="signup"
        variant="signup"
        forceRed={true} // Robst Override for Android
        mobileMinimal={true}
        formMaxWidth={480}
      >
        {/* Show Form once Onboarding is done */}
        <>
          {/* Header for Form Step (Now Outside Card to match Login) */}
          <View style={{ marginTop: isWeb ? (isCompact ? 20 : 40) : 0, marginBottom: isCompact ? 12 : 16, alignItems: 'center', width: '100%', alignSelf: 'stretch' }}>
            <Text style={{ fontSize: isCompact ? 28 : 34, fontFamily: 'Outfit_700Bold', color: THEME.text, marginBottom: isCompact ? 4 : 8, textAlign: 'center' }}>
              Create Account
            </Text>
            <Text style={{ fontSize: isCompact ? 14 : 16, color: THEME.textSecondary, textAlign: 'center', opacity: 0.9 }}>
              Join the private network
            </Text>
          </View>

          <View style={[styles.formCard, { padding: isCompact ? 16 : 24, paddingVertical: isCompact ? 20 : 24 }]}>
            {/* Security Warning Banner */}
            {securityWarning && !error && (
              <View style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center'
              }}>
                <Feather name="shield" size={16} color="#EF4444" style={{ marginRight: 10 }} />
                <Text style={{ color: '#EF4444', flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 }}>
                  {securityWarning}
                </Text>
                <Pressable onPress={() => setSecurityWarning(null)}>
                  <Feather name="x" size={14} color="#EF4444" style={{ opacity: 0.6 }} />
                </Pressable>
              </View>
            )}

            {/* Error Notification Banner - REMOVED (Moved to Top Level Overlay) */}

            {/* Email Input */}
            <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 16 }]}>
              <Text style={[styles.label, { marginBottom: isCompact ? 4 : 6, fontSize: isCompact ? 13 : 14 }]}>Email Address</Text>
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
                  style={[styles.input, { paddingVertical: isCompact ? 10 : 12, fontSize: isCompact ? 14 : 16, caretColor: THEME.primary }]}
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
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType={email && password && confirmPassword ? "go" : "next"}
                  onSubmitEditing={() => {
                    if (email && password && confirmPassword) {
                      handleSignUp();
                    } else if (!password) {
                      // Focus password if empty
                      passwordRef.current?.focus();
                    } else {
                      // Focus confirm password
                      confirmPasswordRef.current?.focus();
                    }
                  }}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 16 }]}>
              <Text style={[styles.label, { marginBottom: isCompact ? 4 : 6, fontSize: isCompact ? 13 : 14 }]}>Password</Text>
              <View style={[
                styles.inputContainer,
                focusedInput === 'password' && styles.inputContainerFocused
              ]}>
                <View style={styles.inputIcon}>
                  <Feather name="lock" size={isCompact ? 18 : 20} color={getIconColor('password')} />
                </View>
                <View style={[styles.inputSeparator, focusedInput === 'password' && { backgroundColor: THEME.primary }]} />

                <TextInput
                  ref={passwordRef}
                  selectionColor={THEME.primary}
                  cursorColor={THEME.primary}
                  style={[styles.input, { paddingVertical: isCompact ? 10 : 12, fontSize: isCompact ? 14 : 16, caretColor: THEME.primary }]}
                  placeholderTextColor={THEME.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  underlineColorAndroid="transparent"
                  returnKeyType={email && password && confirmPassword ? "go" : "next"}
                  onSubmitEditing={() => {
                    if (email && password && confirmPassword) {
                      handleSignUp();
                    } else if (!confirmPassword) {
                      confirmPasswordRef.current?.focus();
                    } else if (!email) {
                      emailRef.current?.focus();
                    }
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={{
                    padding: 10,
                    marginRight: 4,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessible={true}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color={focusedInput === 'password' ? THEME.primary : THEME.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={[styles.inputGroup, { marginBottom: isCompact ? 12 : 16 }]}>
              <Text style={[styles.label, { marginBottom: isCompact ? 4 : 6, fontSize: isCompact ? 13 : 14 }]}>Confirm Password</Text>
              <View style={[
                styles.inputContainer,
                focusedInput === 'confirm' && styles.inputContainerFocused
              ]}>
                <View style={styles.inputIcon}>
                  <Feather name="check-circle" size={isCompact ? 18 : 20} color={getIconColor('confirm')} />
                </View>
                <View style={[styles.inputSeparator, focusedInput === 'confirm' && { backgroundColor: THEME.primary }]} />

                <TextInput
                  ref={confirmPasswordRef}
                  selectionColor={THEME.primary}
                  cursorColor={THEME.primary}
                  style={[styles.input, { paddingVertical: isCompact ? 10 : 12, fontSize: isCompact ? 14 : 16, caretColor: THEME.primary }]}
                  placeholderTextColor={THEME.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  onFocus={() => setFocusedInput('confirm')}
                  onBlur={() => setFocusedInput(null)}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  underlineColorAndroid="transparent"
                  returnKeyType={email && password && confirmPassword ? "go" : "next"}
                  onSubmitEditing={() => {
                    if (email && password && confirmPassword) {
                      handleSignUp();
                    } else if (!email) {
                      emailRef.current?.focus();
                    } else if (!password) {
                      passwordRef.current?.focus();
                    }
                  }}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    padding: 10,
                    marginRight: 4,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessible={true}
                  accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color={focusedInput === 'confirm' ? THEME.primary : THEME.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Legal Compliance Checkboxes */}
            <View style={{ marginTop: 16, marginBottom: 20 }}>
              {/* Age Verification */}
              <Pressable
                onPress={() => setAgeConfirmed(!ageConfirmed)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 14,
                  paddingHorizontal: 4,
                }}
              >
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: ageConfirmed ? THEME.primary : 'rgba(255,255,255,0.2)',
                  marginRight: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: ageConfirmed ? THEME.primary : 'rgba(255,255,255,0.05)',
                }}>
                  {ageConfirmed && (
                    <Feather name="check" size={14} color="#fff" />
                  )}
                </View>
                <Text style={{
                  fontSize: 13,
                  color: THEME.textSecondary,
                  fontFamily: 'Inter_500Medium',
                  flex: 1,
                }}>
                  I confirm that I am at least 13 years old
                </Text>
              </Pressable>

              {/* Terms Acceptance */}
              <Pressable
                onPress={() => setTermsAccepted(!termsAccepted)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: 4,
                }}
              >
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: termsAccepted ? THEME.primary : 'rgba(255,255,255,0.2)',
                  marginRight: 12,
                  marginTop: 2,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: termsAccepted ? THEME.primary : 'rgba(255,255,255,0.05)',
                }}>
                  {termsAccepted && (
                    <Feather name="check" size={14} color="#fff" />
                  )}
                </View>
                <Text style={{
                  fontSize: 13,
                  color: THEME.textSecondary,
                  fontFamily: 'Inter_500Medium',
                  flex: 1,
                  lineHeight: 20,
                }}>
                  I agree to the{' '}
                  <Text
                    style={{ color: THEME.primary, textDecorationLine: 'underline' }}
                    onPress={() => {
                      if (isWeb) {
                        window.open('https://innerorbit-bc8ce.web.app/terms-of-service.html', '_blank');
                      } else {
                        import('expo-linking').then(({ default: Linking }) => {
                          Linking.openURL('https://innerorbit-bc8ce.web.app/terms-of-service.html');
                        });
                      }
                    }}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={{ color: THEME.primary, textDecorationLine: 'underline' }}
                    onPress={() => {
                      if (isWeb) {
                        window.open('https://innerorbit-bc8ce.web.app/privacy-policy.html', '_blank');
                      } else {
                        import('expo-linking').then(({ default: Linking }) => {
                          Linking.openURL('https://innerorbit-bc8ce.web.app/privacy-policy.html');
                        });
                      }
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: THEME.primary,
                  opacity: pressed || loading ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...select({
                    ios: {
                      shadowColor: THEME.primary,
                      shadowOpacity: loading ? 0 : 0.4,
                      shadowOffset: { width: 0, height: 0 },
                      shadowRadius: 4,
                    },
                    android: {
                      elevation: 4,
                    },
                    web: {
                      boxShadow: `0px 0px 4px ${THEME.primary}`,
                    },
                  }),
                },
              ]}
            >
              <Text style={[styles.submitButtonText, { fontSize: isCompact ? 14 : 16 }]}>
                {loading ? "Initializing..." : "Get Started"}
              </Text>
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={{ color: THEME.textSecondary, fontSize: 15 }}>Already a member? </Text>
              <Pressable onPress={() => router.push("/login")} disabled={loading} hitSlop={10}>
                <Text style={{ color: THEME.primary, fontWeight: '700', fontSize: 15 }}>Sign In</Text>
              </Pressable>
            </View>
          </View>
        </>

        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        />
      </SplitAuthLayout>

      {/* Top Level Error Notification (Mobile Only or Global) */}
      {error && (
        <View style={{
          position: 'absolute',
          top: isMobile ? insets.top + 10 : 40,
          left: 20,
          right: 20,
          zIndex: 9999,
          backgroundColor: '#1f1212',
          borderWidth: 1,
          borderColor: 'rgba(239, 68, 68, 0.5)',
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          ...select({
            web: {
              boxShadow: '0px 20px 50px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(24px)',
            },
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
            },
            android: {
              elevation: 8,
            }
          }),
          maxWidth: isDesktop ? 400 : 'auto',
          alignSelf: isDesktop ? 'center' : 'auto',
        }}>
          <Feather name="alert-circle" size={24} color="#EF4444" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#EF4444', fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, opacity: 0.9 }}>
              {error}
            </Text>
          </View>
          <Pressable onPress={() => setError(null)} hitSlop={10} style={{ padding: 4, marginLeft: 8 }}>
            <Feather name="x" size={20} color="#EF4444" style={{ opacity: 0.8 }} />
          </Pressable>
        </View>
      )}

      {/* Onboarding Slides - Full Screen Overlay */}
      {
        showOnboarding && !isDesktop && (
          <OnboardingSlides
            visible={true}
            onClose={handleOnboardingComplete}
            THEME={THEME}
          />
        )
      }
    </>
  );
}


// Styles moved inside component for dynamic THEME support and safe Platform evaluation
