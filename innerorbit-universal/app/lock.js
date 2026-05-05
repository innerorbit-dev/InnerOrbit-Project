/** Purpose: Biometric and PIN-based lock screen challenge for session resumption. */
import React, { useState, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Easing, useWindowDimensions, SafeAreaView } from "react-native";
import { isWeb } from "../utils/platform";
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from 'expo-local-authentication';
import { Logger } from '../lib/logger';
import { LocalPinProtector } from '../lib/security-utils';

// Simple Dark Theme
const THEME = {
  background: "#0F172A", // Solid Dark Blue/Slate
  surface: "rgba(255, 255, 255, 0.05)",
  primary: "#10B981", // Green for Unlock
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  border: "rgba(255,255,255,0.1)",
  danger: "#EF4444",
};

export default function LockScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  const pinRef = useRef(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Don't auto-fill userId - user must enter it manually for security

    // Check Biometrics
    const checkAppLock = async () => {
      try {
        const savedBio = await AsyncStorage.getItem("biometricsEnabled");
        if (savedBio === 'true') {
          setIsBiometricAvailable(true);
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock InnerOrbit',
            fallbackLabel: 'Use PIN',
            disableDeviceFallback: false,
            cancelLabel: 'Cancel'
          });
          if (result.success) router.replace("/home");
        }
      } catch (e) { Logger.error(e); }
    };

    setTimeout(checkAppLock, 500);
  }, []);

  const handleUnlock = async () => {
    if (!pin) { setError("Please enter PIN"); return; }

    setLoading(true);
    setError(null);

    // Brute Force Protection: Check if already locked out
    const waitTime = await LocalPinProtector.getRemainingWaitTime();
    if (waitTime > 0) {
      const seconds = Math.ceil(waitTime / 1000);
      setError(`Too many attempts. Try again in ${seconds}s`);
      setLoading(false);
      return;
    }

    Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: !isWeb })
    ).start();

    try {
      // 1. Check Local Override
      const localPin = await AsyncStorage.getItem('localAppPin');
      if (localPin && pin === localPin) {
        await LocalPinProtector.recordSuccess();
        router.replace("/home");
        return;
      }

      // 2. Remote Check
      if (userId) {
        // Note: signIn already has its own brute force protection
        await signIn(userId, pin, true);
        await LocalPinProtector.recordSuccess();
        router.replace("/home");
      } else {
        setError("User ID missing.");
        setLoading(false);
        spinValue.stopAnimation();
      }
    } catch (e) {
      await LocalPinProtector.recordFailure();
      setError(e.message || "Incorrect PIN");
      setLoading(false);
      spinValue.stopAnimation();
    }
  };

  const handleBiometricAuth = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock InnerOrbit',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel'
    });
    if (result.success) router.replace("/home");
  };

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <StatusBar style="light" />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: "10%" }}>

        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Feather name="lock" size={32} color="#3B82F6" />
        </View>

        <Text style={{ fontSize: 24, fontWeight: '600', color: THEME.text, marginBottom: 8, letterSpacing: 1 }}>LOCKED</Text>
        <Text style={{ color: THEME.textSecondary, marginBottom: 40 }}>Enter passkey to resume</Text>

        {/* Error Banner */}
        {error && (
          <Text style={{ color: THEME.danger, marginBottom: 16, fontWeight: '600' }}>{error}</Text>
        )}

        {/* PIN Input */}
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: THEME.surface, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.border }}>
          <TextInput
            ref={pinRef}
            value={pin}
            onChangeText={setPin}
            style={{ flex: 1, color: THEME.text, fontSize: 18, textAlign: 'center', letterSpacing: 4, fontWeight: 'bold' }}
            secureTextEntry
            keyboardType="numeric"
            maxLength={6}
            placeholder="PIN"
            placeholderTextColor={'rgba(255,255,255,0.2)'}
            autoFocus
            onSubmitEditing={handleUnlock}
            selectionColor={THEME.primary}
            cursorColor={THEME.primary}
          />
        </View>

        {/* Unlock Button */}
        <Pressable
          onPress={handleUnlock}
          disabled={loading}
          style={({ pressed }) => ({
            width: '100%', maxWidth: 320, height: 56, backgroundColor: THEME.primary, borderRadius: 16, marginTop: 16,
            justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.9 : 1
          })}
        >
          {loading ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Feather name="loader" size={24} color="#0F172A" />
            </Animated.View>
          ) : (
            <Text style={{ color: '#0F172A', fontWeight: 'bold', fontSize: 16 }}>UNLOCK</Text>
          )}
        </Pressable>

        {/* Biometrics Button */}
        {isBiometricAvailable && (
          <Pressable onPress={handleBiometricAuth} style={{ marginTop: 32, pad: 10 }}>
            <Feather name="fingerprint" size={40} color={THEME.textSecondary} />
          </Pressable>
        )}

        {/* Cancel Button */}
        <Pressable onPress={() => router.replace('/home')} style={{ marginTop: 24 }}>
          <Text style={{ color: THEME.textSecondary, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}
