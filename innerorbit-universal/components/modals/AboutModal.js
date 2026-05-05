/** Purpose: Modal displaying application version and developer information. */
import React from 'react';
import { Modal, View, Text, Pressable, Image } from 'react-native';
import { Platform } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";

const LOGO_IMG = require("../../assets/InnerOrbit-Logo.png");


export const AboutModal = ({ visible, onClose, THEME }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, backgroundColor: `${THEME.background}F2`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 400, backgroundColor: THEME.surface, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: THEME.border }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: `${THEME.primary}26`, justifyContent: 'center', alignItems: 'center', marginBottom: 24, overflow: 'hidden' }}>
          <Image source={LOGO_IMG} style={{ width: 60, height: 60 }} resizeMode="contain" />
        </View>

        <Text style={{ fontSize: 26, fontWeight: '800', color: THEME.text, marginBottom: 8, letterSpacing: 1 }}>InnerOrbit</Text>
        <Text style={{ fontSize: 16, color: THEME.primary, fontWeight: '600', marginBottom: 4 }}>v1.0.0 (Beta)</Text>
        <Text style={{ fontSize: 14, color: THEME.textSecondary, marginBottom: 32, textAlign: 'center', lineHeight: 22 }}>
          Secure Communication Platform designed for privacy and stealth. Encrypted messaging masked as a functional calculator.
        </Text>

        <View style={{ width: '100%', marginBottom: 32, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.separator }}>
            <Text style={{ color: THEME.textSecondary }}>Developer</Text>
            <Text style={{ color: THEME.text }}>InnerOrbit Team</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.separator }}>
            <Text style={{ color: THEME.textSecondary }}>Platform</Text>
            <Text style={{ color: THEME.text }}>{(Platform.isWeb ? 'WEB' : Platform.isIOS ? 'IOS' : 'ANDROID')}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
            <Text style={{ color: THEME.textSecondary }}>Build</Text>
            <Text style={{ color: THEME.text }}>2026.01.18</Text>
          </View>
        </View>

        <Pressable onPress={onClose} style={({ pressed }) => ({ width: '100%', padding: 16, borderRadius: 16, backgroundColor: THEME.primary, alignItems: 'center', opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ color: THEME.surface, fontWeight: 'bold', fontSize: 16 }}>Close</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);
