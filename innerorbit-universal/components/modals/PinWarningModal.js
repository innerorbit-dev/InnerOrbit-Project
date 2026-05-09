/** Purpose: High-stakes warning modal for Cloud Identity Sync Opt-out. */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated } from 'react-native';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { isWeb } from "../../utils/platform";

export const PinWarningModal = ({ visible, onClose, onConfirm, THEME }) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: !isWeb
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { backgroundColor: THEME.surface, opacity: fadeAnim }]}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="cloud-off-outline" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.title, { color: THEME.text }]}>Disable Cloud Sync?</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.warningText}>CRITICAL SECURITY WARNING</Text>
            </View>

            <Text style={[styles.bodyText, { color: THEME.textSecondary }]}>
              By disabling Cloud Sync, your <Text style={{ fontWeight: 'bold', color: THEME.text }}>User ID</Text> and <Text style={{ fontWeight: 'bold', color: THEME.text }}>Recovery PIN</Text> will exist <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>ONLY on this physical device.</Text>
            </Text>

            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Feather name="x-circle" size={14} color="#EF4444" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={[styles.bulletText, { color: THEME.textSecondary }]}>If you lose this device, your account is <Text style={{ fontWeight: 'bold' }}>PERMANENTLY LOCKED.</Text></Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="x-circle" size={14} color="#EF4444" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={[styles.bulletText, { color: THEME.textSecondary }]}>No password reset or recovery is possible without cloud-synced keys.</Text>
              </View>
              <View style={styles.bulletItem}>
                <Feather name="shield" size={14} color={THEME.primary} style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={[styles.bulletText, { color: THEME.textSecondary }]}>Your data remains encrypted in the cloud; this toggle only controls accessibility.</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.button, { backgroundColor: THEME.background, borderWidth: 1, borderColor: THEME.border }]}
            >
              <Text style={[styles.buttonText, { color: THEME.text }]}>Keep Sync Enabled</Text>
            </Pressable>
            
            <Pressable
              onPress={onConfirm}
              style={[styles.button, { backgroundColor: '#EF4444' }]}
            >
              <Text style={[styles.buttonText, { color: '#FFF' }]}>I Understand, Disable</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden'
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  content: {
    marginBottom: 24
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)'
  },
  warningText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20
  },
  bulletList: {
    gap: 12
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1
  },
  footer: {
    gap: 12
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700'
  }
});
