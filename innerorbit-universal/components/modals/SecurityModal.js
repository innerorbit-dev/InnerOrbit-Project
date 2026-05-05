/** Purpose: Security settings modal for verifying identity and updating passwords. */
import React, { useState } from "react";
import { View, Text, Modal, TextInput, Pressable, ActivityIndicator } from "react-native";
import { select, isWeb } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updatePassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { updateUserProfile } from "../../lib/firestore-service";
import SecureStorage from "../../lib/secure-storage-service";

export const SecurityModal = ({
  visible,
  onClose,
  step,
  setStep,
  inputPin,
  setInputPin,
  newPass,
  setNewPass,
  userPin,
  THEME,
  showError,
  showSuccess,
  securityMode,
  showSecurityNewPass,
  setShowSecurityNewPass,
  isSkippable = false,
  onSkip = () => { }
}) => {
  const [loading, setLoading] = useState(false);
  const [showSecurityNewPassLocal, setShowSecurityNewPassLocal] = useState(false);
  const [internalStep, setInternalStep] = useState(isSkippable ? 2 : (step || 1));
  const activeStep = step !== undefined ? step : internalStep;
  const setActiveStep = setStep !== undefined ? setStep : setInternalStep;
  const hasPassword = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  const getStrength = (pass) => {
    if (!pass) return { label: '', color: 'transparent' };

    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const isLongEnough = pass.length >= 8;

    if (!isLongEnough) return { label: 'Too Short', color: '#EF4444' }; // Red
    if (!hasUpper || !hasNumber || !hasSpecial) return { label: 'Weak', color: '#EF4444' }; // Red

    if (pass.length < 12) return { label: 'Medium', color: '#EAB308' }; // Yellow
    return { label: 'Strong', color: '#3B82F6' }; // Blue
  };

  const strength = getStrength(newPass);

  const handleVerifyPin = async () => {
    const localPin = await AsyncStorage.getItem('localAppPin');
    // Check against Local PIN (if exists) OR Remote PIN
    const valid = (localPin && inputPin === localPin) || (userPin && inputPin === String(userPin));

    if (valid) {
      setStep(2);
    } else {
      showError("Incorrect PIN");
    }
  };

  const handleSaveSecurity = async () => {
    const hasUpper = /[A-Z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPass);

    if (newPass.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }
    if (!hasUpper || !hasNumber || !hasSpecial) {
      showError("Must include Uppercase, Number, and Special Char.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPass);
      // Persist status to Firestore socross-device sessions know a password exists
      await updateUserProfile(auth.currentUser.uid, { hasSetPassword: true });

      // 🛡️ SECURITY: Update local SecureStorage to ensure Silent Auth works next time
      if (auth.currentUser.email) {
        await SecureStorage.saveCredentials(auth.currentUser.email, newPass, auth.currentUser.uid);
      }

      showSuccess("Password Updated Successfully!");
      onClose();
    } catch (e) {
      showError(e.message || "Failed to update password. You may need to re-login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: `${THEME.background}F2`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        ...(isWeb ? { backdropFilter: 'blur(12px)' } : {})
      }}>
        <View style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: THEME.surface,
          borderRadius: 28,
          padding: 36,
          borderWidth: 1,
          borderColor: THEME.border,
          ...select({
            ios: {
              shadowColor: THEME.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
            },
            android: {
              elevation: 8,
            },
            web: {
              boxShadow: `0px 8px 24px ${THEME.primary}40`,
            },
          }),
          ...(isWeb ? { backdropFilter: 'blur(20px)' } : {})
        }}>

          {/* Step 1: Verify PIN */}
          {activeStep === 1 && (
            <>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: `${THEME.warning}20`, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 }}>
                <Feather name="shield" size={28} color={THEME.warning} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: THEME.text, textAlign: 'center', marginBottom: 8 }}>Verify Identity</Text>
              <Text style={{ fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginBottom: 24 }}>Enter your Recovery PIN to access {hasPassword ? 'password' : 'security'} settings.</Text>

              <TextInput
                style={{ backgroundColor: THEME.background, color: THEME.text, padding: 16, borderRadius: 12, fontSize: 24, textAlign: 'center', letterSpacing: 8, marginBottom: 24, borderWidth: 1, borderColor: THEME.border, fontWeight: '800' }}
                value={inputPin}
                onChangeText={setInputPin}
                placeholder="000000"
                placeholderTextColor={`${THEME.textSecondary}40`}
                maxLength={6}
                keyboardType="number-pad"
                secureTextEntry
                autoFocus
                selectionColor={THEME.primary}
                cursorColor={THEME.primary}
              />

              <Pressable
                onPress={() => {
                  if (inputPin === userPin) {
                    setActiveStep(2);
                  } else {
                    showError("Incorrect PIN.");
                  }
                }}
                style={({ pressed }) => ({ backgroundColor: THEME.primary, padding: 16, borderRadius: 16, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}
              >
                <Text style={{ color: THEME.surface, fontWeight: 'bold', fontSize: 16 }}>Verify & Continue</Text>
              </Pressable>
              <Pressable onPress={onClose} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: THEME.textSecondary }}>Cancel</Text>
              </Pressable>
            </>
          )}

          {/* Step 2: New Password / PIN */}
          {activeStep === 2 && (
            <>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: `${THEME.success}20`, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 }}>
                <Feather name='lock' size={28} color={THEME.success} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: THEME.text, textAlign: 'center', marginBottom: 8 }}>
                {hasPassword ? 'Change Password' : 'Set New Password'}
              </Text>
              <Text style={{ fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginBottom: 24 }}>
                PIN Verified. {hasPassword ? 'Update your access credentials.' : 'Create a strong password.'}
              </Text>

              <View style={{ position: 'relative' }}>
                <TextInput
                  style={{
                    backgroundColor: THEME.background,
                    color: THEME.text,
                    padding: 16,
                    paddingRight: 100, // Extra padding for strength and eye
                    borderRadius: 12,
                    fontSize: 16,
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: strength.label ? strength.color : THEME.border
                  }}
                  value={newPass}
                  onChangeText={setNewPass}
                  placeholder="New Password"
                  placeholderTextColor={THEME.textSecondary}
                  secureTextEntry={!showSecurityNewPassLocal}
                  autoFocus
                  selectionColor={THEME.primary}
                  cursorColor={THEME.primary}
                />

                <View
                  style={{ pointerEvents: "box-none", position: 'absolute', right: 12, top: 0, height: 54, flexDirection: 'row', alignItems: 'center' }}
                >
                  {strength.label ? (
                    <Text style={{ color: strength.color, fontSize: 10, fontWeight: '800', marginRight: 8, textTransform: 'uppercase' }}>
                      {strength.label}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={() => setShowSecurityNewPassLocal(!showSecurityNewPassLocal)}
                    style={{ padding: 8 }}
                  >
                    <Feather
                      name={showSecurityNewPassLocal ? "eye" : "eye-off"}
                      size={18}
                      color={THEME.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={handleSaveSecurity}
                disabled={loading}
                style={({ pressed }) => ({ backgroundColor: THEME.primary, padding: 16, borderRadius: 16, alignItems: 'center', opacity: pressed || loading ? 0.8 : 1 })}
              >
                {loading ? <ActivityIndicator color={THEME.surface} /> : <Text style={{ color: THEME.surface, fontWeight: 'bold', fontSize: 16 }}>
                  {hasPassword ? 'Change Password' : 'Set Password'}
                </Text>}
              </Pressable>

              {isSkippable ? (
                <Pressable
                  onPress={async () => {
                    await AsyncStorage.setItem('onboarding_password_skipped', 'true');
                    onSkip();
                    onClose();
                  }}
                  style={{ marginTop: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: THEME.primary, fontWeight: '800' }}>Skip for now</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 10, marginTop: 4 }}>You can set this later in Settings</Text>
                </Pressable>
              ) : (
                <Pressable onPress={onClose} style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={{ color: THEME.textSecondary, fontWeight: 'bold' }}>Cancel</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};
