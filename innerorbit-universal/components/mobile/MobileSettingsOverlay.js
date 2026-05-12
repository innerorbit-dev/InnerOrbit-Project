import React from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, LayoutAnimation } from 'react-native';
import { isIOS, select, Platform } from '../../utils/platform';
import { BlurView } from 'expo-blur';

import { Feather } from "@expo/vector-icons";
import { GlobalHeader } from "../ui/GlobalHeader";
import { getHomeStyles } from "../../styles/home.styles";
import { APP_DOCS } from "../../lib/docs-data";
import { ProfileDetailView, SecurityDetailView, PrivacyDetailView, NotificationDetailView, StealthDetailView, DocsDetailView, ConnectDetailView } from "../home/DetailViews";
import { UpdateSettingsView } from "../home/UpdateSettingsView";
import { ThemeSettingsView, AboutSettingsView } from "../home/DesktopSettingsViews";
import { CallsDetailView, StoriesDetailView } from "../home/FeatureViews";
import { SettingsSidebar } from "../home/SettingsSidebar";

const ACCOUNT_IMG = require('../../assets/account.webp');

export const MobileSettingsOverlay = ({
  THEME,
  activeSettingsSubPage,
  setActiveSettingsSubPage,
  profile,
  user,
  stealth,
  themePreference,
  toggleTheme,
  security,
  handleLogout,
  handleExportData,
  handleDeleteAccount,
  ui,
  updates,
  showSuccess,
  showError,
  privacyLevel,
  handlePrivacyLevel,
  privacy,
  UpdateManager,
  insets,
  isDecoyMode
}) => {
  const styles = getHomeStyles(THEME);

  // Wrapper for setActiveSettingsSubPage to include animation
  const navigateTo = (page) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSettingsSubPage(page);
  };

  if (!activeSettingsSubPage) return null;


  const getTitle = () => {
    switch (activeSettingsSubPage) {
      case 'profile': return 'Profile Settings';
      case 'security': return 'Account Security';
      case 'privacy': return 'Social Privacy';
      case 'stealth': return 'Stealth Access';
      case 'notifications': return 'Notifications';
      case 'theme': return 'Appearance';
      case 'updates': return 'Updates';
      case 'docs': return 'Documentation';
      case 'connect': return 'Connect';
      case 'about': return 'About InnerOrbit';
      default: return 'Settings';
    }
  };

  const renderInlineDetail = (viewName) => {
    switch (viewName) {
      case 'profile':
        return (
          <ProfileDetailView
            THEME={THEME}
            isLargeDesktop={false}
            handlePickProfilePicture={() => profile.handlePickProfilePicture(showSuccess, showError)}
            userPhoto={profile.userPhoto}
            myUserId={profile.myUserId}
            userBio={profile.userBio}
            onChangeBio={profile.onChangeBio}
            handleUpdateBio={(bio) => profile.handleUpdateBio(bio, showSuccess, showError)}
            bioStatus={profile.bioStatus}
            displayName={profile.displayName}
            onChangeDisplayName={profile.onChangeDisplayName}
            nameStatus={profile.nameStatus}
            isInline={true}
          />
        );
      case 'security':
        return (
          <SecurityDetailView
            THEME={THEME}
            myUserId={profile.myUserId}
            userPin={profile.userPin}
            setAlertConfig={ui.setAlertConfig}
            setSecurityStep={ui.setSecurityStep}
            setSecurityInputPin={ui.setSecurityInputPin}
            setSecurityNewPass={ui.setSecurityNewPass}
            setSecurityMode={ui.setSecurityMode}
            setShowSecurityModal={ui.setShowSecurityModal}
            showSuccess={showSuccess}
            isInline={true}
            confirmLogout={profile.confirmLogout}
            handleToggleConfirmLogout={profile.handleToggleConfirmLogout}
            biometricsEnabled={security.biometricsEnabled}
            handleToggleBiometrics={security.handleToggleBiometrics}
            biometricsSupported={security.biometricsSupported}
            screenshotsBlocked={security.screenshotsBlocked}
            handleToggleScreenshots={security.handleToggleScreenshots}
            hardwareLockEnabled={security.hardwareLockEnabled}
            hardwareSupported={security.hardwareSupported}
            handleToggleHardwareLock={security.handleToggleHardwareLock}
            autoRecoveryEnabled={security.autoRecoveryEnabled}
            handleToggleAutoRecovery={security.handleToggleAutoRecovery}
            backgroundSyncEnabled={security.backgroundSyncEnabled}
            handleToggleBackgroundSync={security.handleToggleBackgroundSync}
            keyBackupEnabled={security.keyBackupEnabled}
            handleToggleKeyBackup={security.handleToggleKeyBackup}
          />
        );
      case 'privacy':
        return (
          <PrivacyDetailView
            THEME={THEME}
            privacyPlatformTab={ui.privacyPlatformTab}
            setPrivacyPlatformTab={ui.setPrivacyPlatformTab}
            privacyLevel={privacyLevel}
            handlePrivacyLevel={handlePrivacyLevel}
            privacy={privacy || {}}
            isInline={true}
          />
        );
      case 'stealth':
        return (
          <StealthDetailView
            THEME={THEME}
            stealthMode={stealth.stealthMode}
            handleUpdateStealth={(m) => stealth.handleUpdateStealth(m, showSuccess, showError)}
            stealthButton={stealth.stealthButton}
            handleUpdateStealthButton={stealth.handleUpdateStealthButton}
            stealthCode={stealth.stealthCode}
            handleUpdateStealthCode={stealth.handleUpdateStealthCode}
            showSuccess={showSuccess}
            isInline={true}
          />
        );
      case 'notifications':
        return <NotificationDetailView THEME={THEME} isInline={true} />;
      case 'theme':
        return (
          <ThemeSettingsView
            THEME={THEME}
            themePreference={themePreference}
            toggleTheme={toggleTheme}
            side={isDecoyMode ? 'decoy' : 'chat'}
            isInline={true}
          />
        );
      case 'updates':
        return (
          <UpdateSettingsView
            THEME={THEME}
            UpdateManager={UpdateManager}
            updateCheckStatus={updates.updateCheckStatus}
            handleCheckForUpdate={() => updates.handleCheckForUpdate(showSuccess)}
            updatePrefs={updates.updatePrefs}
            handleUpdatePrefChange={updates.handleUpdatePrefChange}
            downloadProgress={updates.downloadProgress}
            handleDownloadUpdate={updates.handleDownloadUpdate}
            handleInstallUpdate={updates.handleInstallUpdate}
            isInline={true}
          />
        );
      case 'docs':
        return <DocsDetailView THEME={THEME} APP_DOCS={APP_DOCS} isInline={true} />;
      case 'connect':
        return <ConnectDetailView THEME={THEME} myUserId={profile.myUserId} user={user} showSuccess={showSuccess} isInline={true} />;
      case 'calls':
        return <CallsDetailView THEME={THEME} isDesktop={false} />;
      case 'stories':
        return <StoriesDetailView THEME={THEME} />;
      case 'about':
        return (
          <AboutSettingsView
            THEME={THEME}
            setShowUpdateWalkthrough={updates.setShowUpdateWalkthrough}
            UpdateManager={UpdateManager}
            updatePrefs={updates.updatePrefs}
            handleUpdatePrefChange={updates.handleUpdatePrefChange}
            updateCheckStatus={updates.updateCheckStatus}
            handleCheckForUpdate={() => updates.handleCheckForUpdate(showSuccess)}
            downloadProgress={updates.downloadProgress}
            handleDownloadUpdate={updates.handleDownloadUpdate}
            handleInstallUpdate={updates.handleInstallUpdate}
            isInline={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={isIOS ? 'padding' : 'height'}
      keyboardVerticalOffset={select({ ios: 80, android: 0, default: 20 })}
      style={{ flex: 1 }}
    >
      <View style={[styles.contentArea, {
        backgroundColor: THEME.background,
        flex: 1,
        zIndex: 1000
      }]}>
        {/* Header for Mobile Subpage */}
        {/* Header for Mobile Subpage */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingBottom: 12,
            paddingTop: Math.max(insets.top, 20), // Use dynamic safe area insets
            backgroundColor: THEME.surface,
            borderBottomWidth: 1,
            borderBottomColor: THEME.separator || 'rgba(128,128,128,0.1)',
            zIndex: 10,
            ...select({
              web: {
                backdropFilter: 'blur(20px)',
                backgroundColor: `${THEME.surface}E6`
              }
            })
          }}
        >
          <Pressable onPress={() => navigateTo(null)} style={{ paddingHorizontal: 8 }}>
            <Feather name="arrow-left" size={24} color={THEME.primary} />
          </Pressable>
          <Text style={{ color: THEME.primary, fontSize: 18, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 }}>
            {getTitle()}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {renderInlineDetail(activeSettingsSubPage)}
        </ScrollView>

      </View>
    </KeyboardAvoidingView>
  );
};

