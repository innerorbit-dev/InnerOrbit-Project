/** Purpose: Modal for collecting user feedback and bug reports. */
import React from 'react';
import { Modal, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from "@expo/vector-icons";

export const FeedbackModal = ({
  visible,
  onClose,
  THEME,
  feedbackEmail,
  setFeedbackEmail,
  feedbackMessage,
  setFeedbackMessage,
  handleSendFeedback,
  isSendingFeedback
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, backgroundColor: `${THEME.background}F2`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 450, backgroundColor: THEME.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: THEME.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: THEME.text }}>Feedback & Support</Text>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <Feather name="x" size={24} color={THEME.textSecondary} />
          </Pressable>
        </View>

        <Text style={{ color: THEME.textSecondary, marginBottom: 20 }}>
          Have a suggestion or found a bug? Let us know directly.
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: THEME.text, marginBottom: 8, fontWeight: '600' }}>Your Email</Text>
          <TextInput
            style={{ backgroundColor: THEME.background, color: THEME.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: THEME.border }}
            value={feedbackEmail}
            onChangeText={setFeedbackEmail}
            placeholder="name@example.com"
            placeholderTextColor={THEME.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            selectionColor={THEME.primary}
            cursorColor={THEME.primary}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: THEME.text, marginBottom: 8, fontWeight: '600' }}>Message</Text>
          <TextInput
            style={{ backgroundColor: THEME.background, color: THEME.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, minHeight: 120, textAlignVertical: 'top' }}
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            placeholder="Type your message here..."
            placeholderTextColor={THEME.textSecondary}
            multiline
            numberOfLines={6}
            selectionColor={THEME.primary}
            cursorColor={THEME.primary}
          />
        </View>

        <Pressable
          onPress={handleSendFeedback}
          disabled={isSendingFeedback}
          style={({ pressed }) => ({
            backgroundColor: THEME.primary,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            opacity: (pressed || isSendingFeedback) ? 0.8 : 1
          })}
        >
          {isSendingFeedback ? (
            <ActivityIndicator color={THEME.surface} />
          ) : (
            <Text style={{ color: THEME.surface, fontWeight: 'bold', fontSize: 16 }}>Send Feedback</Text>
          )}
        </Pressable>
      </View>
    </View>
  </Modal>
);
