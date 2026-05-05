/** Purpose: Modal displaying the user's personal QR code for connection sharing. */
import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export const QRCodeModal = ({ visible, onClose, myUserId, THEME }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, backgroundColor: `${THEME.background}CC`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 350, backgroundColor: THEME.surface, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: THEME.border }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: THEME.text, marginBottom: 8 }}>Permanent Link</Text>
        <Text style={{ color: THEME.textSecondary, marginBottom: 24, textAlign: 'center' }}>Let others scan to establish connection.</Text>

        <View style={{ padding: 20, backgroundColor: THEME.background, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          <QRCode
            value={JSON.stringify({
              type: 'add-contact',
              userId: myUserId,
              name: 'User'
            })}
            size={200}
            color={THEME.primary}
            backgroundColor="transparent"
            logo={require('../../assets/icon.png')}
            logoSize={45}
            logoBackgroundColor={THEME.surface}
            logoMargin={2}
            logoBorderRadius={8}
          />
        </View>

        <Text style={{ fontSize: 24, fontWeight: 'bold', color: THEME.primary, letterSpacing: 4, marginBottom: 24 }}>{myUserId}</Text>

        <Pressable onPress={onClose} style={{ width: '100%', padding: 16, borderRadius: 16, backgroundColor: THEME.primary, alignItems: 'center' }}>
          <Text style={{ color: THEME.surface, fontWeight: 'bold' }}>Close</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);
