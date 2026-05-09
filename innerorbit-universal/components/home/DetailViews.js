import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput, Switch } from "react-native";
import { isIOS, isAndroid, isWeb, isMobile, isMobileLayout, select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
// styles not used here
import * as Clipboard from 'expo-clipboard';
import { LEVELS, EMERGENCY_LEVEL } from "../../utils/constants";
import { NotificationSettings } from "../settings/notification-settings";
import { SecuritySettings } from "../settings/security-settings";
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from "../../lib/logger";
import { GlobalHeader } from "../ui/GlobalHeader";
import { useAuth } from "../../context/auth-context.js";
import { IdentitySecurityService } from "../../lib/identity-security-service";
import { LoadingDots } from "../ui/loading-dots";
import { PinWarningModal } from "../modals/PinWarningModal";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const DetailWrapper = ({ children, isInline, THEME, title, subtitle }) => {
  if (isInline) {
    return (
      <View style={{ width: '100%', paddingVertical: 0 }}>
        {children}
      </View>
    );
  }
  const isMobile = isMobileLayout;
  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{
          padding: isMobile ? 20 : 40,
          paddingBottom: isMobile ? 200 : 40, // More buffer for keyboard
          maxWidth: 800,
          alignSelf: 'center',
          width: '100%'
        }}
      >
        {!isMobile && (
          <>
            <Text style={{ color: THEME.text, fontSize: isMobile ? 24 : 36, fontWeight: '900', marginBottom: 4 }}>{title}</Text>
            <Text style={{ color: THEME.textSecondary, fontSize: isMobile ? 14 : 16, marginBottom: isMobile ? 24 : 48 }}>{subtitle}</Text>
          </>
        )}
        {children}
      </ScrollView>
    </View>
  );
};

export const NotificationDetailView = ({ THEME, isInline, isLargeDesktop }) => (
  <DetailWrapper THEME={THEME} isInline={isInline} title="Notifications" subtitle="Configure alerts, sounds & privacy.">
    <View style={{
      backgroundColor: (isInline || !isLargeDesktop) ? 'transparent' : THEME.surface,
      borderRadius: (isInline || !isLargeDesktop) ? 0 : 24,
      padding: (isInline || !isLargeDesktop) ? 0 : 32,
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden'
    }}>
      <NotificationSettings theme={THEME} isInline={isInline} />
    </View>
  </DetailWrapper>
);

const ACCOUNT_IMG = require('../../assets/account.webp');

export const ProfileDetailView = ({
  THEME,
  isLargeDesktop,
  handlePickProfilePicture,
  userPhoto,
  myUserId,
  userBio,
  onChangeBio,
  handleUpdateBio,
  bioStatus,
  displayName,
  onChangeDisplayName,
  nameStatus,
  photoVisibility,
  handleTogglePhotoVisibility,
  isInline
}) => {
  const isMobile = isMobileLayout;
  const [showId, setShowId] = useState(false);
  const [decryptedId, setDecryptedId] = useState(null);
  const [isDecryptingId, setIsDecryptingId] = useState(false);

  // MEMORY HARDENING: Clear plain-text ID when hiding or unmounting
  React.useEffect(() => {
    if (!showId) {
      setDecryptedId(null);
    }
    return () => {
      setDecryptedId(null);
    };
  }, [showId]);

  const handleToggleId = async () => {
    if (!showId) {
      setIsDecryptingId(true);
      try {
        const { userId } = await IdentitySecurityService.getLocalIdentity();
        setDecryptedId(userId || myUserId); // Fallback to prop if not in secure store
        setShowId(true);
      } catch (error) {
        Logger.error("[ProfileView] ID Decryption failed:", error);
      } finally {
        setIsDecryptingId(false);
      }
    } else {
      setShowId(false);
    }
  };
  return (
    <DetailWrapper THEME={THEME} isInline={isInline} title="Profile Settings" subtitle="Identity and public status on the network.">
      <View style={{ flexDirection: (isLargeDesktop && !isInline) ? 'row' : 'column', gap: isInline ? 8 : 40 }}>
        {/* Left: Avatar Section */}
        <View style={{ width: (isLargeDesktop && !isInline) ? 200 : '100%', alignItems: 'center' }}>
          <Pressable
            onPress={handlePickProfilePicture}
            style={({ pressed }) => ({
              width: (isInline || !isLargeDesktop) ? 100 : 180, height: (isInline || !isLargeDesktop) ? 100 : 180,
              borderRadius: (isInline || !isLargeDesktop) ? 50 : 90, overflow: 'hidden',
              borderWidth: 3, borderColor: THEME.primary, marginBottom: (isInline || !isLargeDesktop) ? 12 : 20,
              backgroundColor: THEME.surface, ...select({
                web: { boxShadow: `0px 4px 6px ${THEME.primary}` },
                ios: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
                android: { elevation: 6 }
              }),
              opacity: pressed ? 0.9 : 1
            })}
          >
            <Image source={userPhoto ? { uri: userPhoto } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: `${THEME.background}B3`, paddingVertical: 10, alignItems: 'center' }}>
              <Feather name="camera" size={18} color={THEME.text} />
            </View>
          </Pressable>

          <Pressable
            onPress={handleToggleId}
            disabled={isDecryptingId}
            style={({ pressed }) => ({
              marginTop: 16,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: `${THEME.primary}14`,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (pressed || isDecryptingId) ? 0.8 : 1,
              minWidth: 140,
              minHeight: 36
            })}
          >
            {isDecryptingId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '700', marginRight: 6 }}>Loading...</Text>
                <LoadingDots color={THEME.primary} size={3} gap={1.5} />
              </View>
            ) : (
              <>
                <Text style={{ color: THEME.primary, fontSize: 13, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5, marginRight: 8 }}>
                  ID: {showId ? (decryptedId || '••••••••') : '••••••••'}
                </Text>
                <Feather name={showId ? "eye-off" : "eye"} size={12} color={THEME.primary} />
              </>
            )}
          </Pressable>
        </View>

        {/* Right: Info Sections */}
        <View style={{ flex: 1, gap: isLargeDesktop ? 20 : 12 }}>
          {/* 1. Name Section */}
          <View style={{
            backgroundColor: (isInline || !isLargeDesktop) ? 'transparent' : THEME.surface,
            borderRadius: 24,
            padding: (isInline || !isLargeDesktop) ? 0 : 32,
            borderWidth: 0,
            borderColor: 'transparent',
            marginBottom: (isInline || !isLargeDesktop) ? 12 : 0
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isInline ? 8 : 16 }}>
              <View style={{ width: isInline ? 32 : 40, height: isInline ? 32 : 40, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.success}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 10 : 14 }}>
                <Feather name="user" size={isInline ? 16 : 20} color={THEME.success} />
              </View>
              <View>
                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '800' }}>Name</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 12 }}>How others see you</Text>
              </View>
            </View>
            <TextInput
              style={{
                backgroundColor: THEME.background,
                borderRadius: 12,
                padding: isInline ? 10 : 16,
                color: THEME.text,
                fontSize: isInline ? 14 : 16,
                borderWidth: 0,
                marginBottom: 8
              }}
              placeholder="Enter your display name..."
              placeholderTextColor={THEME.textSecondary}
              value={displayName}
              onChangeText={onChangeDisplayName}
              selectionColor={THEME.primary}
              cursorColor={THEME.primary}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather
                name={nameStatus === 'saving' ? "loader" : (nameStatus === 'saved' ? "check-circle" : "info")}
                size={12}
                color={nameStatus === 'saved' ? THEME.success : THEME.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: nameStatus === 'saved' ? THEME.success : THEME.textSecondary, fontSize: 11, fontWeight: '500' }}>
                {nameStatus === 'saving' ? "Saving name..." : (nameStatus === 'saved' ? "Synced" : "Auto-saves as you type")}
              </Text>
            </View>
          </View>

          {/* 2. Bio Section */}
          <View style={{
            backgroundColor: (isInline || !isLargeDesktop) ? 'transparent' : THEME.surface,
            borderRadius: 24,
            padding: (isInline || !isLargeDesktop) ? 0 : 32,
            borderWidth: 0,
            borderColor: 'transparent',
            marginBottom: (isInline || !isLargeDesktop) ? 12 : 0
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isInline ? 8 : 16 }}>
              <View style={{ width: isInline ? 32 : 40, height: isInline ? 32 : 40, borderRadius: isInline ? 8 : 12, backgroundColor: THEME.subInfo, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 10 : 14 }}>
                <Feather name="edit-3" size={isInline ? 16 : 20} color={THEME.info} />
              </View>
              <View>
                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '800' }}>Bio</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 12 }}>What's on your mind?</Text>
              </View>
            </View>

            <TextInput
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: THEME.background,
                borderRadius: 16,
                padding: isInline ? 10 : 16,
                color: THEME.text,
                fontSize: isInline ? 14 : 16,
                lineHeight: 22,
                textAlignVertical: 'top',
                minHeight: isInline ? 60 : 100,
                borderWidth: 0,
                marginBottom: 8
              }}
              placeholder="Compose your secure status bio..."
              placeholderTextColor={THEME.textSecondary}
              value={userBio}
              onChangeText={(text) => onChangeBio(text)}
              selectionColor={THEME.primary}
              cursorColor={THEME.primary}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather
                  name={bioStatus === 'saving' ? "loader" : (bioStatus === 'saved' ? "check-circle" : "info")}
                  size={12}
                  color={bioStatus === 'saved' ? THEME.success : THEME.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={{ color: bioStatus === 'saved' ? THEME.success : THEME.textSecondary, fontSize: 11, fontWeight: '500' }}>
                  {bioStatus === 'saving' ? "Securing bio..." : (bioStatus === 'saved' ? "Cloud synced" : "Auto-saves")}
                </Text>
              </View>
              <Text style={{ color: (userBio || "").length > 120 ? THEME.primary : THEME.textSecondary, fontSize: 11, fontWeight: '700' }}>
                {(userBio || "").length} / 139
              </Text>
            </View>
          </View>

          {/* 3. Photo Privacy Toggle */}
          <View style={{
            backgroundColor: (isInline || !isLargeDesktop) ? 'transparent' : THEME.surface,
            borderRadius: 24,
            padding: (isInline || !isLargeDesktop) ? 0 : 32,
            borderWidth: 0,
            borderColor: 'transparent',
            marginBottom: (isInline || !isLargeDesktop) ? 12 : 0
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: isInline ? 32 : 40, height: isInline ? 32 : 40, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.primary}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 10 : 14 }}>
                  <Feather name="eye" size={isInline ? 16 : 20} color={THEME.primary} />
                </View>
                <View>
                  <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '800' }}>Photo Privacy</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 12 }}>{photoVisibility === 'contacts' ? 'Visible to established links' : 'Private to everyone'}</Text>
                </View>
              </View>
              <Switch
                value={photoVisibility === 'contacts'}
                onValueChange={handleTogglePhotoVisibility}
                trackColor={{ false: THEME.border, true: THEME.primary }}
                thumbColor={isIOS ? '#fff' : (photoVisibility === 'contacts' ? THEME.primary : '#f4f3f4')}
                style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
              />
            </View>
          </View>

          {/* 3. Security Section */}
          <View style={{
            backgroundColor: (isInline || !isLargeDesktop) ? 'transparent' : THEME.surface,
            borderRadius: 24,
            padding: (isInline || !isLargeDesktop) ? 0 : 32,
            borderWidth: 0
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: isInline ? 32 : 40, height: isInline ? 32 : 40, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.warning}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 10 : 14 }}>
                <Feather name="shield" size={isInline ? 16 : 20} color={THEME.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '800' }}>Security Status</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 12 }}>Account verification level</Text>
              </View>
              <View style={{ backgroundColor: `${THEME.success}1A`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: THEME.success, fontSize: 12, fontWeight: '800' }}>SECURE</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      
      <PinWarningModal 
        visible={showWarningModal} 
        onClose={() => setShowWarningModal(false)} 
        onConfirm={confirmDisableCloudSync} 
        THEME={THEME} 
      />
    </DetailWrapper>
  );
};

export const SecurityDetailView = ({
  THEME,
  myUserId,
  userPin,
  setAlertConfig,
  setSecurityStep,
  setSecurityInputPin,
  setSecurityNewPass,
  setSecurityMode,
  setShowSecurityModal,
  showSuccess,
  isInline,
  confirmLogout,
  handleToggleConfirmLogout,
  biometricsEnabled,
  handleToggleBiometrics,
  biometricsSupported,
  screenshotsBlocked,
  handleToggleScreenshots,
  hardwareLockEnabled,
  hardwareSupported,
  handleToggleHardwareLock,
  autoRecoveryEnabled,
  handleToggleAutoRecovery,
  backgroundSyncEnabled,
  handleToggleBackgroundSync,
  keyBackupEnabled,
  handleToggleKeyBackup
}) => {
  const [isIdCopied, setIsIdCopied] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [decryptedPin, setDecryptedPin] = useState(null);
  const [isDecryptingPin, setIsDecryptingPin] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const { user } = useAuth();

  // Load Cloud Sync Status
  React.useEffect(() => {
    const loadSyncStatus = async () => {
      const enabled = await IdentitySecurityService.isCloudSyncEnabled();
      setCloudSyncEnabled(enabled);
    };
    loadSyncStatus();
  }, []);

  // MEMORY HARDENING: Clear plain-text PIN when hiding or unmounting
  React.useEffect(() => {
    if (!showPin) {
      setDecryptedPin(null);
    }
    return () => {
      setDecryptedPin(null);
    };
  }, [showPin]);

  const handleTogglePin = async () => {
    if (!showPin) {
      setIsDecryptingPin(true);
      try {
        // Transient Decryption Flow
        const { pin } = await IdentitySecurityService.getLocalIdentity();
        setDecryptedPin(pin);
        setShowPin(true);
      } catch (error) {
        Logger.error("[SecurityView] PIN Decryption failed:", error);
      } finally {
        setIsDecryptingPin(false);
      }
    } else {
      setShowPin(false);
    }
  };

  const handleToggleCloudSync = async (val) => {
    if (!val) {
      // Show warning modal before disabling
      setShowWarningModal(true);
    } else {
      await IdentitySecurityService.setCloudSync(true);
      setCloudSyncEnabled(true);
      showSuccess("Cloud Identity Sync enabled");
    }
  };

  const confirmDisableCloudSync = async () => {
    await IdentitySecurityService.setCloudSync(false);
    setCloudSyncEnabled(false);
    setShowWarningModal(false);
    showSuccess("Cloud Identity Sync disabled");
  };

  const hasPassword = !!(user?.providerData?.some(p => p?.providerId === 'password') || user?.hasSetPassword);
  const isMobile = isMobileLayout;

  const handleResetLockConfirmation = async () => {
    try {
      await AsyncStorage.removeItem('skipLockConfirmation');
      showSuccess("Lock confirmation restored");
    } catch (error) {
      Logger.error("Error resetting lock confirmation:", error);
    }
  };

  return (
    <DetailWrapper THEME={THEME} isInline={isInline} title="Account Security" subtitle="Manage your access credentials and codes.">
      <View style={{ gap: isInline ? 8 : (isMobile ? 16 : 24) }}>

        {/* SECTION 1: SECURITY CORE */}
        <View style={{ gap: isInline ? 8 : (isMobile ? 12 : 16) }}>
          <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 4 }}>SECURITY CORE</Text>


          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isInline ? 8 : (isMobile ? 12 : 16) }}>
            {/* Card 1: View Recovery PIN (Read Only with Toggle) */}
            <Pressable
              onPress={handleTogglePin}
              disabled={isDecryptingPin}
              style={({ pressed }) => ({
                flex: 1, minWidth: (isInline || isMobile) ? '100%' : 300,
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 12 : (isMobile ? 16 : 32),
                borderWidth: 0,
                opacity: (pressed || isDecryptingPin) ? 0.9 : 1
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.warning}1A`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Feather name="key" size={isInline ? 16 : 24} color={THEME.warning} />
                </View>
                <Text style={{ color: THEME.text, fontSize: isInline ? 16 : 18, fontWeight: '700' }}>Recovery Pin</Text>
              </View>
              <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 12 : 14, marginBottom: isInline ? 8 : 24, lineHeight: isInline ? 16 : 20 }}>
                Use this code to recover your account if you forget your password. Click to reveal.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.background, padding: isInline ? 12 : 16, borderRadius: 12, borderWidth: 0, minHeight: isInline ? 44 : 56 }}>
                {isDecryptingPin ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: THEME.textSecondary, fontSize: 13, marginRight: 8 }}>Loading...</Text>
                    <LoadingDots color={THEME.primary} size={4} />
                  </View>
                ) : (
                  <Text style={{ color: THEME.text, fontSize: isInline ? 14 : 16, fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {showPin ? (decryptedPin || '••••••') : '••••••'}
                  </Text>
                )}
                <Feather name={showPin ? "eye-off" : "eye"} size={16} color={THEME.textSecondary} />
              </View>
            </Pressable>

            {/* Card 2: Change Password */}
            <Pressable
              onPress={() => { setSecurityStep(1); setSecurityInputPin(''); setSecurityNewPass(''); setSecurityMode('password'); setShowSecurityModal(true); }}
              style={({ pressed }) => ({
                flex: 1, minWidth: (isInline || isMobile) ? '100%' : 300,
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 10 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center',
                opacity: pressed ? 0.9 : 1
              })}
            >
              <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: THEME.subInfo, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 12 : 24 }}>
                <Feather name="lock" size={isInline ? 16 : 24} color={THEME.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: THEME.text, fontSize: isInline ? 16 : 18, fontWeight: '700', marginBottom: 4 }}>{hasPassword ? 'Change Password' : 'Set Password'}</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 12 : 14 }}>{hasPassword ? 'Update your main access credentials.' : 'Secure your account with a password.'}</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.background, justifyContent: 'center', alignItems: 'center', borderWidth: 0 }}>
                <Feather name="arrow-right" size={16} color={THEME.text} />
              </View>
            </Pressable>

            {/* Card 3: Logout Confirmation Toggle */}
            <View
              style={{
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center'
              }}
            >
              <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.error}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                <Feather name="log-out" size={isInline ? 16 : 24} color={THEME.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '700', marginBottom: 4 }}>Logout Confirmation</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 14 }}>Ask before logging out</Text>
              </View>
              <Switch
                value={confirmLogout}
                onValueChange={handleToggleConfirmLogout}
                trackColor={{ false: THEME.border, true: THEME.primary }}
                thumbColor={isIOS ? '#fff' : (confirmLogout ? THEME.primary : '#f4f3f4')}
                style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
              />
            </View>

            {/* Card 4: Reset Lock Dialog */}
            <Pressable
              onPress={handleResetLockConfirmation}
              style={({ pressed }) => ({
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center',
                opacity: pressed ? 0.9 : 1
              })}
            >
              <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.info}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                <Feather name="refresh-ccw" size={isInline ? 16 : 24} color={THEME.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '700', marginBottom: 4 }}>Reset Lock Dialog</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 14 }}>Restore "Don't ask again" prompt</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.background, justifyContent: 'center', alignItems: 'center', borderWidth: 0 }}>
                <Feather name="arrow-right" size={16} color={THEME.text} />
              </View>
            </Pressable>

            {/* Card 5: Hardware Security (Level 5) */}
            <View
              style={{
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center'
              }}
            >
              <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.primary}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                <Feather name="shield" size={isInline ? 16 : 24} color={THEME.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '700', marginBottom: 4 }}>Enable Hardware Security</Text>
                  <View style={{ backgroundColor: `${THEME.primary}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                    <Text style={{ color: THEME.primary, fontSize: 10, fontWeight: '900' }}>LEVEL 5</Text>
                  </View>
                </View>
                <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 11 : 14 }}>Bind encryption keys to this device's {isWeb ? 'TPM' : 'Secure Hardware'}/Biometrics.</Text>
              </View>
              <Switch
                value={hardwareLockEnabled}
                onValueChange={(val) => handleToggleHardwareLock(val, myUserId, showSuccess, (msg) => setAlertConfig({ visible: true, title: 'Hardware Error', message: msg, type: 'error' }))}
                trackColor={{ false: THEME.border, true: THEME.primary }}
                thumbColor={isIOS ? '#fff' : (hardwareLockEnabled ? THEME.primary : '#f4f3f4')}
                disabled={!hardwareSupported && isWeb}
                style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
              />
            </View>
          </View>
        </View>

        {/* SECTION 2: ADVANCED SECURITY */}
        <View style={{ marginTop: isInline ? 8 : 16, gap: isInline ? 8 : 12 }}>
          <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 4 }}>ADVANCED</Text>
          
          <View style={{
            width: '100%',
            backgroundColor: (isInline) ? 'transparent' : THEME.surface,
            borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
            padding: isInline ? 8 : (isMobile ? 16 : 32),
            borderWidth: 0,
            flexDirection: 'row', alignItems: 'center'
          }}>
            <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.info}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
              <Feather name="refresh-cw" size={isInline ? 16 : 24} color={THEME.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Cross-Device Recovery</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 11, lineHeight: 14 }}>Backup keys using PIN for new devices.</Text>
            </View>
            <Switch
              value={keyBackupEnabled}
              onValueChange={handleToggleKeyBackup}
              trackColor={{ false: THEME.border, true: THEME.primary }}
              thumbColor="#fff"
              style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
            />
          </View>

          {keyBackupEnabled && (
            <>
              <View style={{
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center'
              }}>
                <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.primary}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                  <MaterialCommunityIcons name="cloud-sync" size={isInline ? 16 : 24} color={THEME.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Cloud Identity Sync</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 11, lineHeight: 14 }}>Securely backup your User ID and PIN to the cloud.</Text>
                </View>
                <Switch
                  value={cloudSyncEnabled}
                  onValueChange={handleToggleCloudSync}
                  trackColor={{ false: THEME.border, true: THEME.primary }}
                  thumbColor="#fff"
                  style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                />
              </View>

              <View style={{
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center'
              }}>
                <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.primary}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                  <Feather name="unlock" size={isInline ? 16 : 24} color={THEME.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Auto Recover</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 11, lineHeight: 14 }}>Silently unlock chat history with cached PIN.</Text>
                </View>
                <Switch
                  value={autoRecoveryEnabled}
                  onValueChange={handleToggleAutoRecovery}
                  trackColor={{ false: THEME.border, true: THEME.primary }}
                  thumbColor="#fff"
                  style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                />
              </View>

              <View style={{
                width: '100%',
                backgroundColor: (isInline) ? 'transparent' : THEME.surface,
                borderRadius: isInline ? 0 : (isMobile ? 16 : 24),
                padding: isInline ? 8 : (isMobile ? 16 : 32),
                borderWidth: 0,
                flexDirection: 'row', alignItems: 'center'
              }}>
                <View style={{ width: isInline ? 32 : 48, height: isInline ? 32 : 48, borderRadius: isInline ? 8 : 12, backgroundColor: `${THEME.success}1A`, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 8 : 24 }}>
                  <Feather name="activity" size={isInline ? 16 : 24} color={THEME.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Background Default</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 11, lineHeight: 14 }}>Sync keys and messages while in background.</Text>
                </View>
                <Switch
                  value={backgroundSyncEnabled}
                  onValueChange={handleToggleBackgroundSync}
                  trackColor={{ false: THEME.border, true: THEME.primary }}
                  thumbColor="#fff"
                  style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                />
              </View>
            </>
          )}
        </View>

      </View>
    </DetailWrapper >
  );
};

export const PrivacyDetailView = ({
  THEME,
  privacyPlatformTab,
  setPrivacyPlatformTab,
  privacyLevel,
  handlePrivacyLevel,
  privacy,
  isInline
}) => {
  const [isEditingDecoyPin, setIsEditingDecoyPin] = useState(false);
  const [tempDecoyPin, setTempDecoyPin] = useState('');
  const isMobile = isMobileLayout;

  return (
    <DetailWrapper THEME={THEME} isInline={isInline} title="Social Privacy" subtitle="Universal control for chat social visibility">
      {/* Platform Tabs */}
      <View style={{ flexDirection: 'row', marginBottom: isInline ? 16 : 32, gap: 12 }}>
        <Pressable
          onPress={() => setPrivacyPlatformTab('mobile')}
          style={{
            flex: 1, paddingVertical: isInline ? 10 : 14, borderRadius: 16, alignItems: 'center',
            backgroundColor: privacyPlatformTab === 'mobile' ? THEME.primary : THEME.actionBackground,
            borderWidth: 0
          }}
        >
          <Feather name="smartphone" size={18} color={privacyPlatformTab === 'mobile' ? THEME.surface : THEME.textSecondary} style={{ marginBottom: 6 }} />
          <Text style={{ color: privacyPlatformTab === 'mobile' ? THEME.surface : THEME.textSecondary, fontWeight: '700' }}>Mobile App</Text>
        </Pressable>
        <Pressable
          onPress={() => setPrivacyPlatformTab('windows')}
          style={{
            flex: 1, paddingVertical: isInline ? 10 : 14, borderRadius: 16, alignItems: 'center',
            backgroundColor: privacyPlatformTab === 'windows' ? THEME.info : THEME.actionBackground,
            borderWidth: 0
          }}
        >
          <Feather name="monitor" size={18} color={privacyPlatformTab === 'windows' ? THEME.surface : THEME.textSecondary} style={{ marginBottom: 6 }} />
          <Text style={{ color: privacyPlatformTab === 'windows' ? THEME.surface : THEME.textSecondary, fontWeight: '700' }}>Windows App</Text>
        </Pressable>
      </View>

      {/* Web Version Warning */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${THEME.warning}1A`, padding: isInline ? 12 : 16, borderRadius: 16, marginBottom: isInline ? 16 : 32 }}>
        <Feather name="alert-circle" size={20} color={THEME.warning} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: THEME.warning, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>Web Version Notice</Text>
          <Text style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 18 }}>Web version does not support advanced hardware-level privacy controls (Auto Safety, Camouflage).</Text>
        </View>
      </View>

      <View style={{ gap: isInline ? 8 : 16 }}>
        {LEVELS.map((lvl) => (
          <Pressable
            key={lvl.id}
            onPress={() => handlePrivacyLevel(lvl.id)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', padding: (isInline || !isMobile) ? 12 : 24,
              borderRadius: (isInline || !isMobile) ? 0 : 20,
              backgroundColor: privacyLevel === lvl.id ? `${THEME.primary}20` : ((isInline || !isMobile) ? 'transparent' : THEME.surface),
              borderWidth: 0,
              borderBottomWidth: 0,
              opacity: pressed ? 0.9 : 1
            })}
          >
            <View style={{ width: isInline ? 36 : 50, height: isInline ? 36 : 50, borderRadius: isInline ? 18 : 25, backgroundColor: privacyLevel === lvl.id ? THEME.primary : THEME.actionBackground, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 12 : 20 }}>
              <Feather name={lvl.id === 3 ? "shield" : (lvl.id === 2 ? "eye-off" : "users")} size={isInline ? 18 : 24} color={privacyLevel === lvl.id ? THEME.surface : THEME.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: privacyLevel === lvl.id ? THEME.primary : THEME.text, fontSize: isInline ? 15 : 18, fontWeight: '700', marginBottom: isInline ? 2 : 4 }}>{lvl.title}</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 12 : 14 }}>{lvl.desc}</Text>
            </View>
            {privacyLevel === lvl.id && (
              <View style={{ width: isInline ? 24 : 32, height: isInline ? 24 : 32, borderRadius: isInline ? 12 : 16, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Feather name="check" size={isInline ? 14 : 18} color={THEME.surface} />
              </View>
            )}
          </Pressable>
        ))}

        {/* Emergency Button */}
        <Pressable
          onPress={() => handlePrivacyLevel(EMERGENCY_LEVEL.id)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', padding: isInline ? 12 : 24, borderRadius: isInline ? 12 : 20, marginTop: isInline ? 8 : 16,
            backgroundColor: privacyLevel === EMERGENCY_LEVEL.id ? `${THEME.error}1A` : `${THEME.error}0D`,
            borderWidth: 0,
            opacity: pressed ? 0.9 : 1
          })}
        >
          <View style={{ width: isInline ? 36 : 50, height: isInline ? 36 : 50, borderRadius: isInline ? 18 : 25, backgroundColor: THEME.error, justifyContent: 'center', alignItems: 'center', marginRight: isInline ? 12 : 20 }}>
            <Feather name="alert-triangle" size={isInline ? 18 : 24} color={THEME.surface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: THEME.error, fontSize: isInline ? 15 : 18, fontWeight: '700', marginBottom: isInline ? 2 : 4 }}>{EMERGENCY_LEVEL.title}</Text>
            <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 12 : 14 }}>{EMERGENCY_LEVEL.desc}</Text>
          </View>
          {privacyLevel === EMERGENCY_LEVEL.id && (
            <View style={{ width: isInline ? 24 : 32, height: isInline ? 24 : 32, borderRadius: isInline ? 12 : 16, backgroundColor: THEME.error, justifyContent: 'center', alignItems: 'center' }}>
              <Feather name="check" size={isInline ? 14 : 18} color={THEME.surface} />
            </View>
          )}
        </Pressable>
      </View>
      
      {/* Sealed Presence Settings */}
      <View style={{ marginTop: isInline ? 24 : 40 }}>
        <Text style={{ color: THEME.text, fontSize: isInline ? 18 : 24, fontWeight: '800', marginBottom: isInline ? 12 : 20 }}>Sealed Presence</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: isInline ? 16 : 24, padding: isInline ? 12 : 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Feather name="clock" size={16} color={THEME.primary} style={{ marginRight: 8 }} />
                <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '700' }}>Share Last Seen</Text>
              </View>
              <Text style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 18 }}>
                Allow contacts to see when you were last active. Status is encrypted and only visible to trusted contacts.
              </Text>
            </View>
            <Switch
              value={privacy?.sharePresence}
              onValueChange={privacy?.handleToggleSharePresence}
              trackColor={{ false: THEME.border, true: THEME.primary }}
              thumbColor="#fff"
              style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
            />
          </View>
        </View>
      </View>


      {/* Auto Safety Config */}
      {privacyLevel === 3 && (
        <View style={{ marginTop: isInline ? 16 : 40 }}>
          <Text style={{ color: THEME.text, fontSize: 24, fontWeight: '800', marginBottom: isInline ? 8 : 20 }}>Auto Safety Configuration</Text>

          {/* Helper Map for Auto Safety Keys */}
          {(() => {
            const autoSafetyMap = {
              'Gyro Shake Trigger': 'gyroShake',
              'Face Down Lock': 'faceDown',
              'Pocket Detection': 'pocketDetect',
              'Alt+Tab Switch Hook': 'altTab',
              'Mouse Idle Lock (1m)': 'mouseIdle',
              'Minimize on Blur': 'minimizeBlur'
            };

            return privacyPlatformTab === 'mobile' ? (
              <View style={{ backgroundColor: THEME.surface, borderRadius: isInline ? 12 : 24, padding: isInline ? 10 : 24, borderWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isInline ? 8 : 20 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${THEME.info}1A`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Feather name="smartphone" size={20} color={THEME.info} />
                  </View>
                  <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700' }}>Android App / iOS</Text>
                </View>
                {['Gyro Shake Trigger', 'Face Down Lock', 'Pocket Detection'].map(opt => (
                  <View key={opt} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: isInline ? 6 : 12 }}>
                    <Text style={{ color: THEME.textSecondary, fontSize: 15 }}>{opt}</Text>
                    <Switch
                      value={privacy?.autoSafetySettings?.[autoSafetyMap[opt]] || false}
                      onValueChange={(val) => privacy?.handleUpdateAutoSafety(autoSafetyMap[opt], val)}
                      trackColor={{ false: THEME.border, true: THEME.primary }}
                      thumbColor="#fff"
                      style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ backgroundColor: THEME.surface, borderRadius: isInline ? 12 : 24, padding: isInline ? 10 : 24, borderWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isInline ? 8 : 20 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${THEME.subInfo}`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Feather name="monitor" size={20} color={THEME.info} />
                  </View>
                  <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700' }}>Windows OS Application</Text>
                </View>
                {['Alt+Tab Switch Hook', 'Mouse Idle Lock (1m)', 'Minimize on Blur'].map(opt => (
                  <View key={opt} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: isInline ? 6 : 12 }}>
                    <Text style={{ color: THEME.textSecondary, fontSize: 15 }}>{opt}</Text>
                    <Switch
                      value={privacy?.autoSafetySettings?.[autoSafetyMap[opt]] || false}
                      onValueChange={(val) => privacy?.handleUpdateAutoSafety(autoSafetyMap[opt], val)}
                      trackColor={{ false: THEME.border, true: THEME.primary }}
                      thumbColor="#fff"
                      style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                    />
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      )}

      {/* Camouflage Settings */}
      {privacyLevel === 2 && (
        <View style={{ marginTop: isInline ? 16 : 40 }}>
          <Text style={{ color: THEME.text, fontSize: 24, fontWeight: '800', marginBottom: isInline ? 8 : 20 }}>Camouflage Settings</Text>
          <View style={{ backgroundColor: isInline ? 'transparent' : THEME.surface, borderRadius: 24, padding: isInline ? 10 : 24, borderWidth: 0 }}>
            <View style={{ gap: isInline ? 8 : 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '600' }}>Decoy PIN</Text>
                  {isEditingDecoyPin ? (
                    <TextInput
                      value={tempDecoyPin}
                      onChangeText={setTempDecoyPin}
                      style={{
                        backgroundColor: THEME.background,
                        color: THEME.text,
                        padding: 10,
                        borderRadius: 8,
                        marginTop: 8,
                        borderWidth: 0,
                        borderColor: 'transparent',
                        width: '90%',
                        fontFamily: 'monospace',
                        caretColor: THEME.primary
                      }}
                      placeholder="Enter 4-digit PIN"
                      placeholderTextColor={THEME.textSecondary}
                      keyboardType="numeric"
                      selectionColor={THEME.primary}
                      cursorColor={THEME.primary}
                      selectionHandleColor={THEME.primary}
                    />
                  ) : (
                    <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }}>
                      {privacy?.decoyPin ? `Active PIN: ${privacy.decoyPin}` : "Enter this PIN to show fake data."}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {isEditingDecoyPin ? (
                    <>
                      <Pressable
                        onPress={() => {
                          privacy?.handleUpdateDecoyPin(tempDecoyPin);
                          setIsEditingDecoyPin(false);
                        }}
                        style={{ backgroundColor: THEME.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                      >
                        <Text style={{ color: THEME.surface, fontWeight: 'bold' }}>Save</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setIsEditingDecoyPin(false)}
                        style={{ backgroundColor: THEME.actionBackground, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                      >
                        <Text style={{ color: THEME.text, fontWeight: 'bold' }}>Cancel</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setTempDecoyPin(privacy?.decoyPin || '');
                        setIsEditingDecoyPin(true);
                      }}
                      style={{ backgroundColor: THEME.actionBackground, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                    >
                      <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>{privacy?.decoyPin ? "Change" : "Set PIN"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <View style={{ height: 0, backgroundColor: 'transparent' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '600' }}>Panic Trigger</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }}>Action when incorrect PIN entered 3 times.</Text>
                </View>
                <Switch
                  value={privacy?.panicTrigger}
                  onValueChange={privacy?.handleTogglePanicTrigger}
                  trackColor={{ false: THEME.border, true: THEME.primary }}
                  thumbColor="#fff"
                  style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Emergency Protocols */}
      {privacyLevel === 99 && (
        <View style={{ marginTop: isInline ? 12 : 40 }}>
          <Text style={{ color: '#EF4444', fontSize: isInline ? 18 : 24, fontWeight: '800', marginBottom: isInline ? 8 : 20 }}>Emergency Protocols</Text>
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 24, padding: isInline ? 10 : 24, borderWidth: 0 }}>
            <View style={{ gap: isInline ? 8 : 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.error, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Feather name="alert-triangle" size={20} color={THEME.surface} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700' }}>Auto-Activation Active</Text>
                  <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>Engage protocols automatically upon threat detection.</Text>
                </View>
                <Switch
                  value={privacy?.emergencyAutoActivation || false}
                  onValueChange={privacy?.handleToggleEmergencyAuto}
                  trackColor={{ false: THEME.border, true: THEME.primary }}
                  thumbColor={THEME.surface}
                  style={isInline ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : {}}
                />
              </View>
              <View style={{ height: 0, backgroundColor: 'transparent' }} />
              <View>
                <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600', marginBottom: 10 }}>Trigger Sensitivity</Text>
                <View style={{ height: 6, backgroundColor: THEME.actionBackground, borderRadius: 3 }}>
                  <View style={{ width: '80%', height: '100%', backgroundColor: THEME.error, borderRadius: 3 }} />
                </View>
                <Text style={{ color: THEME.error, fontSize: 11, marginTop: 6, fontWeight: '700', textAlign: 'right' }}>HIGH</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </DetailWrapper>
  );
};

export const ConnectDetailView = ({ THEME, myUserId, user, showSuccess, isInline }) => (
  <DetailWrapper THEME={THEME} isInline={isInline} title="Connect" subtitle="Scan this QR code with another device to link them.">
    <View style={{
      backgroundColor: THEME.background,
      padding: isInline ? 8 : 30,
      borderRadius: isInline ? 12 : 30,
      ...select({
        ios: {
          shadowColor: THEME.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
        },
        android: {
          elevation: 10,
        },
        web: {
          boxShadow: `0px 10px 20px ${THEME.primary}`,
        },
      }),
      alignSelf: 'center',
      marginBottom: isInline ? 12 : 20,
      borderWidth: 0
    }}>
      <QRCode
        value={JSON.stringify({
          type: 'add-contact',
          userId: myUserId,
          name: user?.displayName || "User"
        })}
        size={isInline ? 150 : 300}
        color={THEME.primary}
        backgroundColor="transparent"
        logo={require('../../assets/icon.png')}
        logoSize={isInline ? 30 : 60}
        logoBackgroundColor={THEME.surface}
        logoMargin={2}
        logoBorderRadius={10}
      />
    </View>

    <View style={{ marginTop: isInline ? 12 : 40, alignItems: 'center' }}>
      <Pressable
        onPress={() => {
          Clipboard.setString(myUserId);
          showSuccess("User ID Copied to Clipboard");
        }}
        style={{ backgroundColor: isInline ? THEME.navRail : THEME.surface, paddingHorizontal: isInline ? 12 : 24, paddingVertical: isInline ? 6 : 12, borderRadius: 12, borderWidth: 0, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text style={{ color: THEME.primary, fontSize: isInline ? 14 : 24, fontWeight: '700', letterSpacing: 2, marginRight: 12 }}>{myUserId}</Text>
        <Feather name="copy" size={18} color={THEME.textSecondary} />
      </Pressable>
    </View>
  </DetailWrapper>
);

export const StealthDetailView = ({
  THEME,
  stealthMode,
  handleUpdateStealth,
  stealthButton,
  handleUpdateStealthButton,
  stealthCode,
  handleUpdateStealthCode,
  showSuccess,
  isInline,
  stealthLockedUntil
}) => {
  const isLocked = stealthLockedUntil && new Date(stealthLockedUntil) > new Date();
  const daysLeft = isLocked ? Math.ceil((new Date(stealthLockedUntil) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <DetailWrapper THEME={THEME} isInline={isInline} title="Stealth Access" subtitle="Configure secret entry triggers and codes.">
      {isLocked && (
        <View style={{ backgroundColor: `${THEME.error}1A`, padding: isInline ? 12 : 16, borderRadius: 16, marginBottom: 20, borderWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="lock" size={20} color={THEME.info} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: THEME.error, fontWeight: '700', fontSize: 15 }}>Security Lock Active</Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>Settings are locked for {daysLeft} more days to prevent unauthorized changes.</Text>
          </View>
        </View>
      )}
      <View style={{ gap: isInline ? 8 : 24 }}>
        <Text style={{ color: THEME.primary, fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>TRIGGER METHODS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isInline ? 8 : 16 }}>
          {[
            { id: 'header_lock', label: 'InnerOrbit Title', desc: 'Triple Tap or Hold Title', icon: 'type' },
            { id: 'display_triple', label: 'Calculator Display', desc: 'Triple Tap Result Screen', icon: 'grid' },
            { id: 'code', label: 'Secret Code', desc: 'Type Code & Press =', icon: 'hash' },
            { id: 'custom', label: 'Custom Mode', desc: 'Advanced Triggers', icon: 'sliders' }
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => handleUpdateStealth(opt.id)}
              style={({ pressed }) => ({
                flex: 1, minWidth: isInline ? '100%' : 280, padding: isInline ? 10 : 24, borderRadius: isInline ? 12 : 20,
                backgroundColor: stealthMode === opt.id ? `${THEME.primary}20` : (isInline ? THEME.navRail : THEME.surface),
                borderWidth: 0,
                opacity: (pressed || isLocked) ? (isLocked ? 0.5 : 0.9) : 1
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isInline ? 10 : 16 }}>
                <View style={{ width: isInline ? 32 : 40, height: isInline ? 32 : 40, borderRadius: 12, backgroundColor: stealthMode === opt.id ? THEME.primary : THEME.actionBackground, justifyContent: 'center', alignItems: 'center' }}>
                  <Feather name={opt.icon} size={isInline ? 16 : 20} color={stealthMode === opt.id ? THEME.surface : THEME.textSecondary} />
                </View>
                {stealthMode === opt.id && <Feather name="check-circle" size={isInline ? 16 : 20} color={THEME.primary} />}
              </View>
              <Text style={{ color: stealthMode === opt.id ? THEME.primary : THEME.text, fontSize: isInline ? 16 : 18, fontWeight: '700', marginBottom: 4 }}>{opt.label}</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 12 : 13 }}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {stealthMode === 'display_triple' && (
          <View style={{ marginTop: isInline ? 16 : 20, padding: isInline ? 10 : 32, backgroundColor: isInline ? 'transparent' : THEME.surface, borderRadius: isInline ? 12 : 24, borderWidth: 0 }}>
            <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Select Trigger Button</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isInline ? 8 : 12 }}>
              {['display', 'AC', 'DEL', '%', '/', '*', '-', '+', '='].map(btn => (
                <Pressable
                  key={btn}
                  onPress={() => !isLocked && handleUpdateStealthButton(btn)}
                  style={{
                    paddingVertical: isInline ? 6 : 12, paddingHorizontal: isInline ? 10 : 20,
                    backgroundColor: stealthButton === btn ? THEME.primary : THEME.actionBackground,
                    borderRadius: 12, borderWidth: 0,
                    opacity: isLocked ? 0.5 : 1
                  }}
                >
                  <Text style={{ color: stealthButton === btn ? THEME.surface : THEME.text, fontSize: 14, fontWeight: '600' }}>
                    {btn === 'display' ? 'Display' : btn}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {stealthMode === 'code' && (
          <View style={{ marginTop: isInline ? 12 : 20, padding: isInline ? 10 : 32, backgroundColor: isInline ? 'transparent' : THEME.surface, borderRadius: isInline ? 12 : 24, borderWidth: 0 }}>
            <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Set Secret Code</Text>
            <TextInput
              value={stealthCode}
              onChangeText={handleUpdateStealthCode}
              editable={!isLocked}
              style={{ backgroundColor: THEME.background, color: THEME.text, padding: isInline ? 10 : 16, borderRadius: 12, fontSize: 16, fontFamily: 'monospace', opacity: isLocked ? 0.5 : 1 }}
              placeholder="Min 8 digits recommended"
              placeholderTextColor={THEME.textSecondary}
              selectionColor={THEME.primary}
              cursorColor={THEME.primary}
            />
          </View>
        )}
      </View>
    </DetailWrapper >
  );
};

export const DocsDetailView = ({ THEME, APP_DOCS, isInline }) => (
  <DetailWrapper THEME={THEME} isInline={isInline} title="Documentation" subtitle="All Application Info">
    <View style={{ gap: isInline ? 8 : 24 }}>
      {APP_DOCS.map((doc) => (
        <View key={doc.id} style={{ backgroundColor: THEME.surface, borderRadius: isInline ? 12 : 24, padding: isInline ? 10 : 32, borderWidth: 0 }}>
          <Text style={{ color: THEME.text, fontSize: isInline ? 16 : 20, fontWeight: '700', marginBottom: isInline ? 8 : 12 }}>{doc.title}</Text>
          <Text style={{ color: THEME.textSecondary, fontSize: isInline ? 13 : 16, lineHeight: isInline ? 18 : 26 }}>{doc.content}</Text>
        </View>
      ))}
    </View>
  </DetailWrapper>
);

