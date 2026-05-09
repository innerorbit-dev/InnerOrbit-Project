/**
 * Purpose: Modal shown when a user tries to sign in with Google but the same email
 * already exists as a password-based account. Allows them to verify their password
 * and link the two providers together on one account.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Modal, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { isWeb, select } from '../../utils/platform';
import { Logger } from '../../lib/logger';

export const AccountLinkModal = ({
  visible,
  email,
  onLink,       // async (password: string) => void  – provided by auth-context
  onDismiss,
  THEME,
  showError,
  showSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      setPassword('');
      setShowPass(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: !isWeb,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleLink = async () => {
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await onLink(password);
      showSuccess('✅ Google Sign-In linked to your account!');
      onDismiss();
    } catch (err) {
      Logger.error('[AccountLinkModal] Link failed:', err.message);

      if (err.code === 'auth/wrong-password' || err.message?.includes('wrong-password')) {
        showError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        showError('Too many attempts. Please wait and try again.');
      } else {
        showError('Failed to link accounts. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

          <Animated.View
            style={[
              styles.card,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
              {
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                }],
              },
            ]}
          >
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }]}>
              <Feather name="link" size={28} color="#3B82F6" />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: THEME.text }]}>
              Link Google Sign-In
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: THEME.textSecondary }]}>
              This Gmail address is already registered with a password.{'\n\n'}
              Enter your existing password to link Google Sign-In to your account —
              after this, you can use either method.
            </Text>

            {/* Email display */}
            <View style={[styles.emailBadge, { backgroundColor: THEME.background, borderColor: THEME.border }]}>
              <Feather name="mail" size={14} color={THEME.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.emailText, { color: THEME.text }]} numberOfLines={1}>
                {email}
              </Text>
            </View>

            {/* Password input */}
            <View style={[styles.inputWrapper, { borderColor: THEME.border, backgroundColor: THEME.background }]}>
              <TextInput
                style={[styles.input, { color: THEME.text }]}
                placeholder="Your existing password"
                placeholderTextColor={THEME.textSecondary}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                selectionColor={THEME.primary}
                autoFocus
                onSubmitEditing={handleLink}
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                <Feather
                  name={showPass ? 'eye' : 'eye-off'}
                  size={20}
                  color={THEME.textSecondary}
                />
              </Pressable>
            </View>

            {/* Link button */}
            <Pressable
              onPress={handleLink}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: '#3B82F6', opacity: (pressed || loading) ? 0.8 : 1 },
              ]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <View style={styles.btnRow}>
                    <Feather name="link" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Link Accounts</Text>
                  </View>
                )
              }
            </Pressable>

            {/* Cancel */}
            <Pressable onPress={onDismiss} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: THEME.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>

            {/* Info note */}
            <Text style={[styles.footerNote, { color: THEME.textSecondary }]}>
              Your account data and messages will not be affected.
            </Text>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
      web: { boxShadow: '0px 16px 32px rgba(0,0,0,0.4)' },
    }),
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginBottom: 20,
  },
  emailText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputWrapper: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 54,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerNote: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.7,
  },
});
