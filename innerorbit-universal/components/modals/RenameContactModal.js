/** Purpose: Modal for renaming a contact with a custom display name. */
import React from "react";
import { View, Text, Modal, TextInput, Pressable } from "react-native";

export const RenameContactModal = ({
  visible,
  onClose,
  renameTarget,
  setRenameTarget,
  handleRenameContact,
  THEME
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, backgroundColor: `${THEME.background}CC`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 400, backgroundColor: THEME.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: THEME.border }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: THEME.text, marginBottom: 16 }}>Rename Contact</Text>
        <TextInput
          style={{ backgroundColor: THEME.background, color: THEME.text, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}
          value={renameTarget.currentName}
          onChangeText={(t) => setRenameTarget(prev => ({ ...prev, currentName: t }))}
          placeholder="Enter custom name (e.g. Mom ❤️)"
          placeholderTextColor={THEME.textSecondary}
          autoFocus
          selectionColor={THEME.primary}
          cursorColor={THEME.primary}
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={onClose} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: THEME.actionBackground, alignItems: 'center', borderWidth: 1, borderColor: THEME.separator }}>
            <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => handleRenameContact(renameTarget.currentName)} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: THEME.primary, alignItems: 'center' }}>
            <Text style={{ color: THEME.surface, fontWeight: 'bold' }}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);
