/** Purpose: Mobile-specific chat interface for focused one-on-one conversations. */
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatInterface } from "../components/chat/chat-interface";
import { ScreenContainer } from "../components/screen-container";
import { useAuth } from "../context/auth-context";
import { subscribeToContactNicknames, saveContactNickname, db, resetUnreadCount } from "../lib/firestore-service";
import { doc, getDoc } from "firebase/firestore";
import { Modal, View, Text, TextInput, Pressable, ActivityIndicator, useWindowDimensions, Animated } from "react-native";
import { select } from "../utils/platform";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "../store/themeStore";
import { GlobalHeader } from "../components/ui/GlobalHeader";
import { useTaglines } from "../hooks/useTaglines";
import { useUI } from "../hooks/useUI";
import { useProfile } from "../hooks/useProfile";
import { usePrivacy } from "../hooks/usePrivacy";
import { useHomeActions } from "../hooks/useHomeActions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Modals
import { ScannerModal } from "../components/modals/ScannerModal";
import { SecurityModal } from "../components/modals/SecurityModal";
import { QRCodeModal } from "../components/modals/QRCodeModal";
import { CustomAlert } from "../components/ui/custom-alert";

export default function ChatDetailScreen() {
  const { theme: THEME } = useAppTheme();
  const router = useRouter();
  const { conversationId, privacyLevel } = useLocalSearchParams();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { taglines, currentTaglineIndex } = useTaglines(isDesktop);

  const ui = useUI(isDesktop);
  const { showError, showSuccess } = ui;
  const profile = useProfile(user, showError, showSuccess);
  const privacy = usePrivacy(showSuccess);
  const { privacyLevel: globalPrivacyLevel } = privacy;

  const actions = useHomeActions(
    ui,
    user,
    profile,
    globalPrivacyLevel,
    isDesktop,
    () => { }, // setSelectedConversationId dummy
    () => { }  // setDesktopDetailView dummy
  );

  const {
    handleScanQRCode,
    handleBarCodeScanned,
    handleLogout,
  } = actions;

  const [nicknames, setNicknames] = useState({});
  const [otherUserUid, setOtherUserUid] = useState(null);

  // Rename Modal State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState({ uid: null, currentName: '' });

  // 1. Subscribe to Nicknames
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToContactNicknames(user.uid, setNicknames);
    return unsub;
  }, [user]);

  // 2. Fetch Conversation to find Other User UID
  useEffect(() => {
    if (!conversationId || !user) return;
    
    // 🛡️ Clear unread count when opening chat
    resetUnreadCount(conversationId, user.uid);

    const fetchConv = async () => {
      try {
        const docRef = doc(db, "conversations", conversationId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const otherId = data.participantIds.find(id => id !== user.uid);
          if (otherId) setOtherUserUid(otherId);
        }
      } catch (e) {
        console.error("Error fetching conv detail:", e);
      }
    };
    fetchConv();
  }, [conversationId, user]);

  const handleRename = (uid, currentName) => {
    setRenameTarget({ uid, currentName });
    setShowRenameModal(true);
  };

  const saveRename = async () => {
    if (!renameTarget.uid || !user) return;
    try {
      await saveContactNickname(user.uid, renameTarget.uid, renameTarget.currentName.trim());
      setShowRenameModal(false);
    } catch (e) {
      alert("Failed to save nickname");
    }
  };

  const insets = useSafeAreaInsets();
  const headerHeight = isDesktop ? 52 : (Math.max(insets.top, 20) + 36);

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <ChatInterface
          conversationId={conversationId}
          onBack={() => router.back()}
          isMobile={true}
          nickname={otherUserUid ? nicknames[otherUserUid] : ""}
          otherUserUid={otherUserUid}
          onRename={handleRename}
          privacyLevel={parseInt(privacyLevel || "0")}
          containerStyle={{ paddingTop: headerHeight }}
        />

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
          <GlobalHeader
            isDesktop={isDesktop}
            taglines={taglines}
            currentTaglineIndex={currentTaglineIndex}
            onLogoPress={() => router.replace('/home')}
            handleScanQRCode={handleScanQRCode}
            setShowSecurityModal={ui.setShowSecurityModal}
            handleLogout={handleLogout}
          />
        </View>
      </View>

      {/* Rename Modal (Mobile) */}
      <Modal
        visible={showRenameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: THEME.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: THEME.border }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: THEME.text, marginBottom: 16 }}>Rename Contact</Text>
            <TextInput
              style={{ backgroundColor: THEME.background, color: THEME.text, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}
              value={renameTarget.currentName}
              onChangeText={(t) => setRenameTarget(prev => ({ ...prev, currentName: t }))}
              placeholder="Enter custom nickname"
              placeholderTextColor="#64748b"
              autoFocus
              selectionColor={THEME.primary}
              cursorColor={THEME.primary}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowRenameModal(false)} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <Text style={{ color: THEME.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveRename} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: THEME.primary, alignItems: 'center' }}>
                <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Navigation Modals */}
      <CustomAlert
        visible={ui.alertConfig.visible}
        title={ui.alertConfig.title}
        message={ui.alertConfig.message}
        type={ui.alertConfig.type}
        buttons={ui.alertConfig.buttons}
        onDismiss={() => ui.setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      <SecurityModal
        visible={ui.showSecurityModal}
        onClose={() => ui.setShowSecurityModal(false)}
        step={ui.securityStep}
        setStep={ui.setSecurityStep}
        inputPin={ui.securityInputPin}
        setInputPin={ui.setSecurityInputPin}
        newPass={ui.securityNewPass}
        setNewPass={ui.setSecurityNewPass}
        userPin={profile.userPin}
        showSuccess={showSuccess}
        showError={showError}
        THEME={THEME}
        securityMode={ui.securityMode}
        securityNewPin={ui.securityNewPin}
        setSecurityNewPin={ui.setSecurityNewPin}
        showSecurityNewPass={ui.showSecurityNewPass}
        setShowSecurityNewPass={ui.setShowSecurityNewPass}
      />

      <QRCodeModal
        visible={ui.showQRModal}
        onClose={() => ui.setShowQRModal(false)}
        myUserId={profile.myUserId}
        THEME={THEME}
      />

      <ScannerModal
        visible={ui.showScanner}
        onClose={() => ui.setShowScanner(false)}
        handleBarCodeScanned={handleBarCodeScanned}
        THEME={THEME}
      />

      {/* Floating Notifications */}
      <View style={{ position: 'absolute', top: 50, width: '100%', alignItems: 'center', zIndex: 9999, pointerEvents: 'box-none' }}>
        {ui.error && (
          <View style={{
            width: '90%', maxWidth: 400,
            backgroundColor: 'rgba(239, 68, 68, 0.95)', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', marginBottom: 10,
            flexDirection: 'row', alignItems: 'center', marginBottom: 10,
            ...select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 },
              android: { elevation: 5 },
              web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.2)' }
            })
          }}>
            <Feather name="alert-circle" size={18} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontWeight: '600', flex: 1, fontSize: 13 }}>{ui.error}</Text>
            <Pressable onPress={() => ui.setError(null)} style={{ padding: 4 }}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        )}
        {ui.success && (
          <Animated.View style={{
            width: '90%', maxWidth: 400,
            backgroundColor: 'rgba(16, 185, 129, 0.95)', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center',
            flexDirection: 'row', alignItems: 'center',
            ...select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 },
              android: { elevation: 5 },
              web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.2)' }
            })
          }}>
            <Feather name="bell" size={18} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontWeight: '600', flex: 1, fontSize: 13 }}>{ui.success}</Text>
            <Pressable onPress={() => ui.setSuccess(null)} style={{ padding: 4 }}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </ScreenContainer>
  );
}
