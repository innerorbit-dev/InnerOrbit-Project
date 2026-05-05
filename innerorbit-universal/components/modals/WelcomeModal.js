/** Purpose: Onboarding modal displaying permanent credentials to new users. */
import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, Animated, useWindowDimensions } from 'react-native';
import { isWeb, select, isIOS } from "../../utils/platform";
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export function WelcomeModal({ visible, onClose, userId, pin, type = 'welcome', THEME }) {
  const { width } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // If THEME is not provided, we should ideally have a fallback or hook, 
  // but for now we expect it to be passed.

  // Determine content based on type
  const isWelcomeBack = type === 'welcome_back';
  const title = isWelcomeBack ? "Welcome Back" : "Welcome to InnerOrbit";
  const warningText = isWelcomeBack
    ? "Keep your PIN secure."
    : "IMPORTANT: Both your ID and PIN are permanent and cannot be changed.";
  const buttonText = isWelcomeBack ? "Continue" : "Let's Go";

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: !isWeb,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(`InnerOrbit ID: ${userId}\nPIN: ${pin}`);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: `${THEME.background}CC` }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
              width: width > 500 ? 400 : '85%',
              backgroundColor: THEME.surface,
              borderColor: THEME.border
            }
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[
              styles.iconCircle,
              {
                backgroundColor: isWelcomeBack ? `${THEME.primary}20` : `${THEME.success}20`,
                borderColor: isWelcomeBack ? `${THEME.primary}40` : `${THEME.success}40`
              }
            ]}>
              <Feather
                name={isWelcomeBack ? "user" : "check"}
                size={32}
                color={isWelcomeBack ? THEME.primary : THEME.success}
              />
            </View>
          </View>
          
          {/* Title */}
          <Text style={[styles.title, { color: THEME.text }]}>{title}</Text>

          {/* ID and PIN Box */}
          <Pressable 
            onPress={copyToClipboard}
            style={({ pressed }) => [
              styles.credentialsBox, 
              { 
                backgroundColor: THEME.background,
                opacity: pressed ? 0.7 : 1,
                borderWidth: 1,
                borderColor: THEME.border
              }
            ]}
          >
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Text style={[styles.credentialText, { color: THEME.textSecondary }]}>
                {isWelcomeBack ? "Account ID: " : "Your unique ID: "}
                <Text style={[styles.highlight, { color: THEME.text }]}>{userId}</Text>
              </Text>
              <Text style={[styles.credentialText, { color: THEME.textSecondary }]}>
                {isWelcomeBack ? "Security PIN: " : "Your recovery PIN: "}
                <Text style={[styles.highlight, { color: THEME.text }]}>{pin}</Text>
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, opacity: 0.6 }}>
                <Feather name="copy" size={12} color={THEME.textSecondary} />
                <Text style={{ fontSize: 10, color: THEME.textSecondary, marginLeft: 4 }}>Tap to copy credentials</Text>
              </View>
            </View>
          </Pressable>

          {/* Warning Section */}
          <View style={styles.warningContainer}>
            <Feather name="alert-triangle" size={20} color={THEME.warning} style={{ marginRight: 10 }} />
            <Text style={[styles.warningText, { color: THEME.textSecondary }]}>
              {warningText}
            </Text>
          </View>

          {/* Footer Text */}
          {!isWelcomeBack && (
            <Text style={[styles.footerText, { color: `${THEME.textSecondary}80` }]}>Share your ID with friends to start chatting.</Text>
          )}

          {/* Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: THEME.primary },
              pressed && { opacity: 0.9 }
            ]}
            onPress={() => {
              if (!isWelcomeBack) copyToClipboard();
              onClose();
            }}
          >
            <Text style={[styles.buttonText, { color: THEME.surface }]}>{buttonText}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 20,
      },
      web: {
        boxShadow: '0px 10px 10px rgba(0, 0, 0, 0.5)',
      },
    }),
    borderWidth: 1,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  credentialsBox: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  credentialText: {
    fontSize: 16,
    marginBottom: 8,
  },
  highlight: {
    fontWeight: 'bold',
    fontFamily: isIOS ? 'Courier' : 'monospace',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  warningText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
