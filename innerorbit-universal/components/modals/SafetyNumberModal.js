/** Purpose: Modal for verifying the 60-digit Safety Number (Security Code) for v6 Quantum-Safe chats. */
import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Feather } from "@expo/vector-icons";
import { generateSafetyNumber } from '../../lib/encryption';

export const SafetyNumberModal = ({ visible, onClose, myKeys, theirKeys, otherUserName, THEME }) => {
  const safetyNumber = useMemo(() => {
    if (!myKeys || !theirKeys) return "00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000";
    return generateSafetyNumber(myKeys, theirKeys);
  }, [myKeys, theirKeys]);

  const blocks = safetyNumber.split(' ');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ 
          width: '100%', 
          maxWidth: 450, 
          backgroundColor: THEME.surface, 
          borderRadius: 32, 
          padding: 24, 
          borderWidth: 1, 
          borderColor: THEME.border,
          maxHeight: '85%'
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: THEME.text }}>Security Code</Text>
              <Text style={{ fontSize: 12, color: THEME.success, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Quantum-Safe (v6)</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Feather name="x" size={24} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <Text style={{ color: THEME.textSecondary, marginBottom: 24, lineHeight: 20 }}>
            To verify the security of your connection with <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>{otherUserName || "this contact"}</Text>, 
            compare the numbers below with their device.
          </Text>

          {/* Safety Number Blocks */}
          <ScrollView 
            contentContainerStyle={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              gap: 12,
              paddingBottom: 20
            }}
            showsVerticalScrollIndicator={false}
          >
            {blocks.map((block, index) => (
              <View 
                key={index} 
                style={{ 
                  width: '45%', 
                  backgroundColor: THEME.background, 
                  padding: 12, 
                  borderRadius: 12, 
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: THEME.border
                }}
              >
                <Text style={{ 
                  fontSize: 18, 
                  fontFamily: 'monospace', 
                  fontWeight: '800', 
                  color: THEME.primary,
                  letterSpacing: 2
                }}>
                  {block}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ height: 1, backgroundColor: THEME.border, marginVertical: 24 }} />

          {/* Verification Actions */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${THEME.primary}10`, padding: 16, borderRadius: 16, marginBottom: 8 }}>
              <Feather name="info" size={20} color={THEME.primary} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: THEME.text, fontSize: 13, lineHeight: 18 }}>
                If these numbers match, your conversation is 100% private and post-quantum secure.
              </Text>
            </View>

            <Pressable 
              onPress={onClose} 
              style={({ pressed }) => ({ 
                width: '100%', 
                padding: 18, 
                borderRadius: 20, 
                backgroundColor: THEME.primary, 
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1
              })}
            >
              <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 16 }}>Mark as Verified</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
