import React, { useRef } from 'react';
import { View, Text, Pressable, TextInput, Image, Animated } from 'react-native';
import { isWeb, select } from "../../utils/platform";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getHomeStyles } from "../../styles/home.styles";
import { APP_DOCS } from "../../lib/docs-data";
import { ChatList } from "../mobile/ChatList";
import { StoriesView } from "../mobile/Placeholders";
import { CallsHistoryView } from "../calling/CallsHistoryView";
import { ProfileDetailView, SecurityDetailView, PrivacyDetailView, NotificationDetailView, StealthDetailView, DocsDetailView, ConnectDetailView } from "./DetailViews";
import { UpdateSettingsView } from "./UpdateSettingsView";
import { ThemeSettingsView, AboutSettingsView } from "./DesktopSettingsViews";
import { SettingsSidebar } from "./SettingsSidebar";
import { ProfileImageModal } from "../modals/UserProfileModal";
import { useRouter } from "expo-router";

const ACCOUNT_IMG = require('../../assets/account.webp');
const LOGO_IMG = require('../../assets/InnerOrbit-Logo.png');

export const SidebarContent = ({
  THEME,
  isDesktop,
  sidebarOpacity,
  profile,
  handleScanQRCode,
  handleNewChat,
  activeTab,
  setActiveTab,
  conversations,
  loading,
  nicknames,
  handleConversationPress,
  selectedConversationId,
  user,
  activeSettingsSubPage,
  setActiveSettingsSubPage,
  desktopDetailView,
  setDesktopDetailView,
  showMenu,
  setShowMenu,
  searchQuery,
  setSearchQuery,
  isDecoyMode,
  setIsDecoyMode,
  handleLogout,
  // Props for Detail Views
  stealth,
  themePreference,
  toggleTheme,
  security,
  handleExportData,
  handleDeleteAccount,
  ui,
  updates,
  showSuccess,
  showError,
  privacyLevel,
  handlePrivacyLevel,
  UpdateManager
}) => {
  const lastTapRef = useRef(0);
  const tapCountRef = useRef(0);
  const titleTimerRef = useRef(null);
  const styles = getHomeStyles(THEME);
  const router = useRouter();

  // Optimized Animation State for Tab Switching (Cross-fade)
  const chatOpacity = useRef(new Animated.Value(activeTab === 'chats' ? 1 : 0)).current;
  const storiesOpacity = useRef(new Animated.Value(activeTab === 'stories' ? 1 : 0)).current;
  const callsOpacity = useRef(new Animated.Value(activeTab === 'calls' ? 1 : 0)).current;
  const settingsOpacity = useRef(new Animated.Value(activeTab === 'settings' ? 1 : 0)).current;
  const searchOpacity = useRef(new Animated.Value((activeTab === 'stories' || (activeTab === 'settings' && isDesktop)) ? 0 : 1)).current;

  React.useEffect(() => {
    const isSearchVisible = !(activeTab === 'stories' || (activeTab === 'settings' && isDesktop));

    Animated.parallel([
      Animated.timing(chatOpacity, { toValue: activeTab === 'chats' ? 1 : 0, duration: 200, useNativeDriver: !isWeb }),
      Animated.timing(storiesOpacity, { toValue: activeTab === 'stories' ? 1 : 0, duration: 200, useNativeDriver: !isWeb }),
      Animated.timing(callsOpacity, { toValue: activeTab === 'calls' ? 1 : 0, duration: 200, useNativeDriver: !isWeb }),
      Animated.timing(settingsOpacity, { toValue: activeTab === 'settings' ? 1 : 0, duration: 200, useNativeDriver: !isWeb }),
      Animated.timing(searchOpacity, { toValue: isSearchVisible ? 1 : 0, duration: 200, useNativeDriver: !isWeb }),
    ]).start();
  }, [activeTab]);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [selectedProfile, setSelectedProfile] = React.useState(null);

  const handleAvatarPress = (item) => {
    setSelectedProfile({
      userId: item.otherUserId,
      photoURL: item.otherUserPhoto,
      nickname: nicknames[item.otherUserUid] || ""
    });
    setShowProfileModal(true);
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
            photoVisibility={profile.photoVisibility}
            handleTogglePhotoVisibility={profile.handleTogglePhotoVisibility}
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
            isInline={true}
          />
        );
      case 'docs':
        return <DocsDetailView THEME={THEME} APP_DOCS={APP_DOCS} isInline={true} />;
      case 'connect':
        return <ConnectDetailView THEME={THEME} myUserId={profile.myUserId} user={user} showSuccess={showSuccess} isInline={true} />;
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
            isInline={true}
          />
        );
      default:
        return null;
    }
  };

  const handleTitlePressIn = () => {
    const now = Date.now();
    const gap = now - lastTapRef.current;

    if (gap < 500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapRef.current = now;

    if (tapCountRef.current === 3) {
      titleTimerRef.current = setTimeout(() => {
        setIsDecoyMode(!isDecoyMode);
        tapCountRef.current = 0;
      }, 2000); // 2s hold after 3 taps
    }
  };

  const handleTitlePressOut = () => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
  };

  return (
    <View style={{ flex: 1, overflow: 'hidden', width: '100%', backgroundColor: THEME.background }}>
      <Animated.View style={{ flex: 1, opacity: isDesktop ? sidebarOpacity : 1, width: '100%' }}>
        {/* Header - LOCKED Padding/Margins to prevent layout shift flicker */}
        <View style={[styles.header, { paddingTop: isDesktop ? (activeTab === 'settings' ? 10 : 30) : 5 }]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isDesktop ? (activeTab === 'settings' ? 0 : 36) : 5
          }}>
            <View style={{ flex: 1 }}>
              {isDesktop && (
                <Pressable
                  onPressIn={handleTitlePressIn}
                  onPressOut={handleTitlePressOut}
                  delayLongPress={1000}
                >
                  <Text style={[styles.headerTitle, { color: THEME.text }]}>
                    {isDecoyMode ? 'Chats' : (activeTab === 'chats' ? 'Chats' : (activeTab === 'calls' ? 'Calls' : (activeTab === 'stories' ? 'Stories' : (activeTab === 'settings' ? '' : 'Settings'))))}
                  </Text>
                </Pressable>
              )}
              {isDecoyMode && activeTab === 'chats' && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 6,
                  backgroundColor: `${THEME.primary}1A`,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: 'flex-start'
                }}>
                  <Image source={LOGO_IMG} style={{ width: 12, height: 12, marginRight: 4 }} resizeMode="contain" />
                  <Text style={{ fontSize: 10, color: THEME.primary, fontWeight: '800', letterSpacing: 1 }}>LEVEL 9 PRIVACY</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              {activeTab === 'chats' && isDesktop && (
                <Pressable onPress={handleNewChat} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Feather name="edit" size={20} color={THEME.primary} />
                </Pressable>
              )}
              {activeTab !== 'settings' && isDesktop && (
                <Pressable onPress={() => setShowMenu(!showMenu)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Feather name="more-horizontal" size={20} color={THEME.primary} />
                </Pressable>
              )}
            </View>

            {/* Dropdown Menu - Removed from header, moved to search box */}
          </View>

          {/* Search Bar & Filter - Animated to prevent snaps */}
          <Animated.View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: isDesktop ? 16 : -10,
            paddingHorizontal: 0,
            marginBottom: (activeTab === 'settings' && isDesktop) ? 0 : 8,
            zIndex: 200,
            height: (activeTab === 'settings' && isDesktop) ? 0 : 56, // Fixed height to prevent layout shifts
            opacity: searchOpacity,
            pointerEvents: (activeTab === 'stories' || (activeTab === 'settings' && isDesktop)) ? 'none' : 'auto',
          }}>
            <View style={[styles.searchContainer, {
              backgroundColor: THEME.surface,
              flex: 1,
              marginHorizontal: 0,
              marginRight: isDesktop ? 10 : 8,
              marginBottom: 0,
              borderRadius: 14,
              height: 48,
              borderWidth: 1,
              borderColor: !isDesktop ? `${THEME.primary}50` : THEME.border
            }]}>
              <Feather name="search" size={18} color={THEME.primary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder={activeTab === 'settings' ? "Search settings..." : "Search and establish link"}
                placeholderTextColor={THEME.textSecondary}
                style={[styles.searchInput, { color: THEME.text, fontSize: 14, caretColor: THEME.primary, flex: 1 }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={THEME.primary}
                cursorColor={THEME.primary}
                selectionHandleColor={THEME.primary}
                editable={activeTab !== 'stories'}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4, marginRight: -10 }}>
                  <Feather name="x" size={22} color={THEME.primary} />
                </Pressable>
              )}
            </View>

            {activeTab === 'chats' && !isDesktop && (
              <View>
                <Pressable
                  onPress={() => setShowMenu(!showMenu)}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 14,
                    backgroundColor: THEME.surface,
                    borderWidth: 1,
                    borderColor: `${THEME.primary}50`,
                    marginLeft: 4,
                    opacity: pressed ? 0.7 : 1
                  })}
                >
                  <Feather name="more-vertical" size={20} color={THEME.primary} />
                </Pressable>

                {showMenu && (
                  <>
                    <Pressable
                      style={{ position: 'absolute', top: -1000, bottom: -1000, left: -1000, right: -1000, zIndex: 50 }}
                      onPress={() => setShowMenu(false)}
                    />
                    <View style={{ position: 'absolute', top: 55, right: 0, width: 200, zIndex: 300, backgroundColor: THEME.surface, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, ...select({ web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.3)' }, ios: { shadowColor: "#000", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.3, shadowRadius: 4 }, android: { elevation: 8 } }), paddingVertical: 4 }}>
                      {[
                        { label: "App Lock", icon: "lock", color: THEME.info, action: () => { setShowMenu(false); ui.setShowSecurityModal(true); } },
                        { label: "Settings", icon: "settings", color: THEME.text, action: () => { setShowMenu(false); setActiveTab('settings'); } },
                        { label: "Log Out", icon: "log-out", color: THEME.error, action: () => { setShowMenu(false); handleLogout(); } }
                      ].map((opt, i) => (
                        <Pressable
                          key={i}
                          onPress={opt.action}
                          style={({ pressed }) => ({
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: pressed ? THEME.actionBackground : 'transparent',
                            flexDirection: 'row',
                            alignItems: 'center'
                          })}
                        >
                          {opt.iconFamily === 'MaterialCommunityIcons' ? (
                            <MaterialCommunityIcons name={opt.icon} size={16} color={opt.color} style={{ marginRight: 10 }} />
                          ) : (
                            <Feather name={opt.icon} size={16} color={opt.color} style={{ marginRight: 10 }} />
                          )}
                          <Text style={{ color: opt.color, fontSize: 15, fontWeight: '500' }}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </Animated.View>
        </View>

        {/* Persistent Tab Container: Definitively stops flickering by keeping components mounted */}
        <View style={{ flex: 1, width: '100%', position: 'relative' }}>
          {/* Chats View layer */}
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            opacity: chatOpacity,
            zIndex: activeTab === 'chats' ? 10 : 0,
            pointerEvents: activeTab === 'chats' ? 'auto' : 'none',
            backgroundColor: THEME.surface
          }}>
            <ChatList
              conversations={conversations}
              loading={loading}
              THEME={THEME}
              myUserId={profile.myUserId}
              handleNewChat={handleNewChat}
              handleConversationPress={handleConversationPress}
              selectedConversationId={selectedConversationId}
              user={user}
              nicknames={nicknames}
              searchQuery={searchQuery}
              isDesktop={isDesktop}
              onAvatarPress={handleAvatarPress}
            />
          </Animated.View>

          {/* Stories View layer */}
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            opacity: storiesOpacity,
            zIndex: activeTab === 'stories' ? 10 : 0,
            pointerEvents: activeTab === 'stories' ? 'auto' : 'none',
            backgroundColor: THEME.surface
          }}>
            <StoriesView THEME={THEME} isDesktop={isDesktop} />
          </Animated.View>

          {/* Calls View layer */}
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            opacity: callsOpacity,
            zIndex: activeTab === 'calls' ? 10 : 0,
            pointerEvents: activeTab === 'calls' ? 'auto' : 'none',
            backgroundColor: THEME.surface
          }}>
            <CallsHistoryView THEME={THEME} isDesktop={isDesktop} />
          </Animated.View>

          {/* Settings View layer */}
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            opacity: settingsOpacity,
            zIndex: activeTab === 'settings' ? 10 : 0,
            pointerEvents: activeTab === 'settings' ? 'auto' : 'none',
            backgroundColor: THEME.surface
          }}>
            <SettingsSidebar
              THEME={THEME}
              setDesktopDetailView={isDesktop ? setDesktopDetailView : setActiveSettingsSubPage}
              selectedView={isDesktop ? desktopDetailView : activeSettingsSubPage}
              handleLogout={handleLogout}
              handleExportData={handleExportData}
              handleDeleteAccount={handleDeleteAccount}
              setShowFeedbackModal={ui?.setShowFeedbackModal}
              user={user}
              profile={profile}
              isDecoyMode={isDecoyMode}
              isDesktop={isDesktop}
              renderInlineDetail={renderInlineDetail}
              ui={ui}
              security={security}
              searchQuery={searchQuery}
            />
          </Animated.View>
        </View>

      </Animated.View >

      <ProfileImageModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        imageUri={selectedProfile?.photoURL}
        onInfoPress={() => {
          setShowProfileModal(false);
          router.push({
            pathname: "/user-profile",
            params: {
              userId: selectedProfile?.userId, // The item has otherUserId, let's make sure we map it right
              name: selectedProfile?.userId,
              photoURL: selectedProfile?.photoURL,
              nickname: selectedProfile?.nickname
            }
          });
        }}
        THEME={THEME}
      />
    </View >
  );
};
