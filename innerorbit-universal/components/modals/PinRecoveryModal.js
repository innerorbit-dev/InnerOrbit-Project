/**
 * PinRecoveryModal
 *
 * Shown when a user logs in via email/Google on a new device and their
 * v4/v6 ratchet session is missing (messages can't be decrypted).
 *
 * The user enters their InnerOrbit PIN → the app derives the backup key
 * via PBKDF2 → fetches the encrypted ratchet root key from Firestore →
 * decrypts it → re-initializes the ratchet → all messages decrypt normally.
 *
 * Usage:
 *   <PinRecoveryModal
 *     visible={showPinRecovery}
 *     uid={currentUser.uid}
 *     convId={conversationId}
 *     partnerUid={partnerUid}
 *     onSuccess={() => setShowPinRecovery(false)}
 *     onDismiss={() => setShowPinRecovery(false)}
 *   />
 */

import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { restoreRatchetSession } from "../../lib/key-backup-service";
import { Logger } from "../../lib/logger";

export default function PinRecoveryModal({
  visible,
  uid,
  convId,
  partnerUid,
  onSuccess,
  onDismiss,
}) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dots, setDots] = useState([false, false, false, false, false, false]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Update visual dot indicators
  const handlePinChange = (text) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    setError("");
    const newDots = Array(6)
      .fill(false)
      .map((_, i) => i < digits.length);
    setDots(newDots);
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleRestore = async () => {
    if (pin.length < 4) {
      setError("Enter your InnerOrbit PIN (4–6 digits)");
      shake();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const restored = await restoreRatchetSession(uid, convId, partnerUid, pin);

      if (restored) {
        Logger.log("[PinRecovery] ✅ Session restored successfully");
        setPin("");
        setDots(Array(6).fill(false));
        onSuccess();
      } else {
        setError("Incorrect PIN or no backup found. Messages may remain locked.");
        shake();
      }
    } catch (e) {
      Logger.error("[PinRecovery] Error:", e);
      setError("Something went wrong. Please try again.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Restore Encrypted Messages</Text>
          <Text style={styles.subtitle}>
            You're on a new device. Enter your InnerOrbit PIN to restore your
            message history.
          </Text>

          {/* PIN dot indicators */}
          <View style={styles.dotsRow}>
            {dots.map((filled, i) => (
              <View
                key={i}
                style={[styles.dot, filled && styles.dotFilled]}
              />
            ))}
          </View>

          {/* Hidden PIN input */}
          <TextInput
            style={styles.hiddenInput}
            value={pin}
            onChangeText={handlePinChange}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            autoFocus={visible}
            caretHidden
            onSubmitEditing={handleRestore}
          />

          {/* Error */}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* Restore button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.buttonText}>Restore Messages</Text>
            )}
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity onPress={onDismiss} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip — keep messages locked</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 30,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#444",
  },
  dotFilled: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  error: {
    color: "#ff5c5c",
    fontSize: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    color: "#555",
    fontSize: 12,
  },
});
