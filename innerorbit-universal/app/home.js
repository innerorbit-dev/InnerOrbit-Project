/** Purpose: Main dashboard/chat list screen for both Mobile and Desktop contexts. */
import React, { useState } from "react";
import { View, Animated, useWindowDimensions, Text, Pressable, PanResponder } from "react-native";
import { isIOS, isWeb, select } from "../utils/platform";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Services & Libs
import { ScreenContainer } from "../components/screen-container";
import { useAuth } from "../context/auth-context";
import { useAppTheme } from "../store/themeStore";
import { UpdateManager } from "../lib/update-manager";
import { APP_DOCS } from '../lib/docs-data';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../lib/logger';

// Components
import { getHomeStyles } from "../styles/home.styles";
import { CustomAlert } from "../components/ui/custom-alert";
import UpdateWalkthrough from "../components/update-walkthrough";
import { NavRail } from "../components/home/NavRail";
import { SidebarContent } from "../components/home/SidebarContent";
import { MobileSettingsOverlay } from "../components/mobile/MobileSettingsOverlay";
import { DesktopContent } from "../components/home/DesktopContent";
import { BottomNav } from "../components/mobile/BottomNav";
import { GoogleSecurityPrompt } from "../components/auth/GoogleSecurityPrompt";
import { GlobalHeader } from "../components/ui/GlobalHeader";
import { RequestsCenter } from "../components/home/RequestsCenter";

// Modals
import { RenameContactModal } from "../components/modals/RenameContactModal";
import { SecurityModal } from "../components/modals/SecurityModal";
import { QRCodeModal } from "../components/modals/QRCodeModal";
import { ScannerModal } from "../components/modals/ScannerModal";
import { AboutModal } from "../components/modals/AboutModal";
import { FeedbackModal } from "../components/modals/FeedbackModal";
import { UserSearchModal } from "../components/modals/UserSearchModal";
import { WelcomeModal } from "../components/modals/WelcomeModal";
import { OnboardingSlides } from "../components/onboarding-slides";
import { ConnectionRequestModal } from "../components/modals/ConnectionRequestModal";
import { LockConfirmationModal } from "../components/modals/LockConfirmationModal";
import { ScannedUserModal } from "../components/modals/ScannedUserModal";
import { CustomImagePicker } from "../components/modals/CustomImagePicker";
import { AccountLinkModal } from "../components/modals/AccountLinkModal";

// Hooks
import { useConversations } from "../hooks/useConversations";
import { useProfile } from "../hooks/useProfile";
import { useSecurity } from "../hooks/useSecurity";
import { useStealth } from "../hooks/useStealth";
import { useUI } from "../hooks/useUI";
import { useSidebar } from "../hooks/useSidebar";
import { useFeedback } from "../hooks/useFeedback";
import { useUpdates } from "../hooks/useUpdates";
import { useTaglines } from "../hooks/useTaglines";
import { usePrivacy } from "../hooks/usePrivacy";
import { useHomeActions } from "../hooks/useHomeActions";
import { useConnectionRequests } from "../hooks/useConnectionRequests";
import { usePasswordNudge } from "../hooks/usePasswordNudge";

export default function ChatListScreen() {
  // --- 1. Init Hooks & Context ---
  const router = useRouter();
  const params = router.params || {}; // Safe check
  // Support deep linking to specific tabs
  const { initialTab } = useLocalSearchParams();

  const { user, isDecoyMode, setIsDecoyMode, welcomeData, setWelcomeData, pendingGoogleLink, linkGoogleToEmailAccount, clearPendingGoogleLink } = useAuth();
  const { theme: THEME, isDark, toggleTheme, themePreference } = useAppTheme();
  const styles = React.useMemo(() => getHomeStyles(THEME), [THEME]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isLargeDesktop = width >= 1440;
  const containerMaxWidth = '100%';

  

  // UI State Hook (Modals, Search, Alerts, Navigation)
  // Force reload trigger
  const ui = useUI(isDesktop);
  const {
    showError, showSuccess, setAlertConfig,
    activeSettingsSubPage, setActiveSettingsSubPage,
    desktopDetailView, setDesktopDetailView
  } = ui;

  // Privacy & Stealth
  const privacy = usePrivacy(showSuccess);
  const { privacyLevel, handlePrivacyLevel } = privacy;
  const stealth = useStealth(user, showSuccess, showError);

  // Conversations Data
  // We need to pass selectedConversationId to useConversations for notification logic
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  // Also activeTab for desktop
  // Space for navigation state
  const [activeTab, setActiveTab] = useState(initialTab || 'chats'); // 'chats' | 'calls' | 'stories'
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);
  const [pendingSecuritySetup, setPendingSecuritySetup] = useState(null);
  // showNudge: true when usePasswordNudge says it's time to show the bottom-sheet nudge
  const [showNudge, setShowNudge] = useState(false);
  const prevWelcomeDataRef = React.useRef(null);
  const initialSyncRef = React.useRef(false);

  // Handle Initial Tab Param
  const activeTabRef = React.useRef(activeTab);
  React.useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const activeSettingsSubPageRef = React.useRef(activeSettingsSubPage);
  React.useEffect(() => {
    activeSettingsSubPageRef.current = activeSettingsSubPage;
  }, [activeSettingsSubPage]);

  // Manual Tab Change Handler (instantly blocks initial sync)
  const handleTabChange = (tabId) => {
    Logger.log(`[Home] 🧭 Tab changed: ${tabId}`);
    initialSyncRef.current = true; // Block any further automatic sync
    setActiveTab(tabId);
  };

  const showRequestsViewRef = React.useRef(ui?.showRequestsView);
  React.useEffect(() => {
    showRequestsViewRef.current = ui?.showRequestsView;
  }, [ui?.showRequestsView]);

  // Handle Initial Tab Sync (One-time, handles late params)
  React.useEffect(() => {
    if (!initialSyncRef.current && initialTab && ['chats', 'calls', 'stories', 'settings'].includes(initialTab)) {
      setActiveTab(initialTab);
      initialSyncRef.current = true;
    }
  }, [initialTab]);

  // Trigger Onboarding for new users (when welcomeData.type is 'welcome')

  // --- Onboarding & Security Sequence Logic ---
  // Flow: WelcomeModal -> OnboardingSlides -> Security Setup (Google or Password)

  React.useEffect(() => {
    if (welcomeData) {
      Logger.log(`[Home] 🎬 Welcome Flow ACTIVE - Type: ${welcomeData.type}`);

      // Case A: Google user needing password setup (no welcome UI needed)
      if (welcomeData.type === 'security_onboarding') {
        Logger.log("[Home] 🛡️ Google Security path detected - Triggering Security Setup immediately");
        triggerSecurityFlow(welcomeData);
        setWelcomeData(null); 
        return;
      }

      // Case B: Standard Welcome (New or Returning)
      prevWelcomeDataRef.current = welcomeData;
    } else if (prevWelcomeDataRef.current) {
      // WelcomeModal was JUST closed/triggered
      const legacyData = prevWelcomeDataRef.current;
      prevWelcomeDataRef.current = null;

      Logger.log(`[Home] 🏁 Welcome Flow DISMISSED - Type: ${legacyData.type}`);

      // 1. Determine if we need Onboarding Slides
      if (legacyData.type === 'welcome') {
        Logger.log("[Home] 📖 Triggering Onboarding Slides");
        setShowOnboarding(true);
      }

      // 2. Queue Security Setup for after Onboarding (or show now if no onboarding)
      const needsSecuritySetup = (legacyData.method === 'password' && legacyData.type === 'welcome') ||
        (legacyData.method === 'google' && !legacyData.hasSetPassword);

      if (needsSecuritySetup) {
        Logger.log("[Home] 🛡️ Queueing Security Setup for later");
        setPendingSecuritySetup(legacyData);
        
        // If no onboarding slides, trigger immediately
        if (legacyData.type !== 'welcome') {
          triggerSecurityFlow(legacyData);
        }
      }
    }
  }, [welcomeData, ui]);

  const triggerSecurityFlow = async (data) => {
    if (!data) return;

    Logger.log(`[Home] 🛡️ Triggering Security Flow for ${data.method}`);

    if (data.method === 'google') {
      // Show the dedicated Google inline prompt
      setShowSecuritySetup(true);
    } else {
      // Show the standard Security Modal (usually for new email users to set a master password)
      const hasSkipped = await AsyncStorage.getItem('onboarding_password_skipped');
      if (!hasSkipped) {
        ui.setIsSecuritySkippable(true);
        ui.setSecurityMode('password');
        ui.setSecurityStep(2);
        ui.setShowSecurityModal(true);
      }
    }
    setPendingSecuritySetup(null);
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    Logger.log("[Home] ✅ Onboarding Slides closed");

    // Check if there is a pending security setup
    if (pendingSecuritySetup) {
      triggerSecurityFlow(pendingSecuritySetup);
    }
  };

  // --- NEW: Onboarding Sequence (Welcome -> Security) ---
  // Note: Post-welcome action handling is done in the welcomeData useEffect above

  // --- Password Nudge (Google-only users without a backup password) ---
  const isGoogleOnlyNudgeEligible = !!(user && welcomeData === null && !showOnboarding && !showSecuritySetup);
  const googleUserHasNoPassword = !!(welcomeData?.method === 'google' && !welcomeData?.hasSetPassword) ||
    // Also trigger for already-logged-in Google-only users (no welcomeData on re-open)
    false;
  // We drive the nudge from auth method stored on user's profile – read once
  const [googleOnlyFlag, setGoogleOnlyFlag] = React.useState(false);
  React.useEffect(() => {
    if (user && isGoogleOnlyNudgeEligible) {
      // Check if this is a Google-only user (no password)
      const isGoogleProvider = user.providerData?.some(p => p.providerId === 'google.com');
      const hasPasswordProvider = user.providerData?.some(p => p.providerId === 'password');
      setGoogleOnlyFlag(isGoogleProvider && !hasPasswordProvider);
    }
  }, [user, isGoogleOnlyNudgeEligible]);

  const { shouldNudge, isChecking, dismissNudge, completeNudge } = usePasswordNudge(googleOnlyFlag);

  React.useEffect(() => {
    if (shouldNudge && !showSecuritySetup && !showOnboarding && !welcomeData) {
      Logger.log('[Home] 🔔 Password nudge scheduled – showing bottom-sheet');
      setShowNudge(true);
    }
  }, [shouldNudge]);

  const conversationsData = useConversations(user, isDecoyMode, isDesktop, selectedConversationId, privacyLevel);
  const { conversations, nicknames, loading } = conversationsData;

  // Profile Data
  const profile = useProfile(user, showError, showSuccess);

  // Security Data
  const security = useSecurity(stealth.settingsStealthExpanded);

  // Sidebar Logic
  const sidebar = useSidebar(isDesktop);
  const { isSidebarOpen, toggleSidebar, animatedWidth, sidebarOpacity, panResponder, isResizing } = sidebar;

  // --- Mobile Tab Swipe Gesture (Stabilized with useMemo) ---
  const tabSwipePanResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !isDesktop && Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onMoveShouldSetPanResponderCapture: (_, g) =>
      !isDesktop && Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (isDesktop || (activeSettingsSubPageRef.current ?? false) || (showRequestsViewRef.current ?? false)) return;

      const TAB_ORDER = ['chats', 'stories', 'calls', 'settings'];
      const currentIdx = TAB_ORDER.indexOf(activeTabRef.current || 'chats');
      const threshold = 40;

      if (g.dx < -threshold && currentIdx < TAB_ORDER.length - 1) {
        // Swipe Left -> Next Tab
        handleTabChange(TAB_ORDER[currentIdx + 1]);
      } else if (g.dx > threshold && currentIdx > 0) {
        // Swipe Right -> Previous Tab
        handleTabChange(TAB_ORDER[currentIdx - 1]);
      }
    }
  }), [isDesktop]); // Stable across renders, uses Refs for internal checks

  const { requests, latestRequest, handleRespond, dismissRequest } = useConnectionRequests(user, isDecoyMode);

  // Updates & Taglines
  const updates = useUpdates();
  const { taglines, currentTaglineIndex } = useTaglines(isDesktop);

  // Feedback Logic
  const feedback = useFeedback(user, showError, showSuccess);

  // --- 2. Actions & Handlers ---
  const actions = useHomeActions(
    ui,
    user,
    profile,
    privacyLevel,
    isDesktop,
    setSelectedConversationId,
    setDesktopDetailView
  );

  const {
    hasCameraPermission,
    isCreatingChat,
    handleUserSearch,
    handleScanQRCode,
    handleBarCodeScanned,
    handleNewChat,
    handleAddChatUser,
    handleConversationPress,
    handleLogout,
    handleExportData,
    handleDeleteAccount,
    handleRenameContact,
    handleScanAgain
  } = actions;

  const handleInstallUpdate = async () => {
    // Just navigate to the dedicated updates page where the user can see progress
    if (isDesktop) {
      setDesktopDetailView('updates');
    } else {
      setActiveSettingsSubPage('updates');
    }
  };

  const handleLockApp = async () => {
    try {
      // Check preference
      const skipConfirm = await AsyncStorage.getItem('skipLockConfirmation');
      if (skipConfirm === 'true') {
        // Lock immediately
        setIsDecoyMode(true, 'Manual-Lock');
        router.replace("/");
      } else {
        // Show confirmation
        ui.setShowLockConfirmation(true);
      }
    } catch (e) {
      Logger.error('Error reading lock pref', e);
      setIsDecoyMode(true, 'Manual-Lock-Fallback');
      router.replace("/");
    }
  };

  const confirmLock = async (dontAskAgain) => {
    ui.setShowLockConfirmation(false);
    if (dontAskAgain) {
      await AsyncStorage.setItem('skipLockConfirmation', 'true');
    }

    // Slight delay to allow modal to close smoothly before hard navigation
    setTimeout(() => {
      setIsDecoyMode(true, 'Manual-Lock-Confirmed');
      router.replace("/");
    }, 100);
  };

  // --- Rose Pink Scrollbars (Web Only) ---
  React.useEffect(() => {
    if (isWeb) {
      const root = document.documentElement;
      const trackColor = THEME.background;
      const thumbColor = THEME.primary; // Rose Pink (#fb7185)
      const thumbHover = isDark ? '#be185d' : '#f43f5e';

      root.style.setProperty('--sb-track', trackColor);
      root.style.setProperty('--sb-thumb', thumbColor);
      root.style.setProperty('--sb-thumb-hover', thumbHover);

      // Support for Firefox
      root.style.scrollbarColor = `${thumbColor} ${trackColor}`;
    }
  }, [THEME, isDark]);

  // --- 3. Render ---
  return (
    <ScreenContainer background={THEME.background}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Alerts & Modals */}
      <CustomAlert
        visible={ui.alertConfig.visible}
        title={ui.alertConfig.title}
        message={ui.alertConfig.message}
        type={ui.alertConfig.type}
        buttons={ui.alertConfig.buttons}
        onDismiss={() => ui.setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

      <UpdateWalkthrough
        visible={updates.showUpdateWalkthrough}
        onClose={async () => {
          updates.setShowUpdateWalkthrough(false);
          await UpdateManager.markVersionAsViewed();
        }}
      />

      {/* Floating Notifications */}
      <View style={{ position: 'absolute', top: 50, width: '100%', alignItems: 'center', zIndex: 9999, pointerEvents: 'box-none' }}>
        {ui.error && (
          <View style={{
            width: '90%', maxWidth: 400,
            backgroundColor: 'rgba(239, 68, 68, 0.95)', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10,
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

      {/* Global Top Navbar - Desktop & Mobile */}
      <GlobalHeader
        isDesktop={isDesktop}
        taglines={taglines}
        currentTaglineIndex={currentTaglineIndex}
        updates={{ ...updates, setActiveSettingsSubPage: isDesktop ? setDesktopDetailView : setActiveSettingsSubPage }}
        handleScanQRCode={handleScanQRCode}
        setShowSecurityModal={handleLockApp}
        handleLogout={handleLogout}
        requestCount={requests.length}
        onRequestsPress={() => ui.setShowRequestsView(true)}
      />

      {/* Main Layout */}
      <View
        style={[styles.mainContainer, { maxWidth: containerMaxWidth }]}
        {...(!isDesktop ? tabSwipePanResponder.panHandlers : {})}
      >

        {/* === LEFT SIDEBAR === */}
        {/* Desktop Nav Rail */}
        {isDesktop && (
          <NavRail
            THEME={THEME}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setDesktopDetailView={setDesktopDetailView}
            screenshotsBlocked={security.screenshotsBlocked}
            setScreenshotsBlocked={(val) => security.handleToggleScreenshots(val, showSuccess)}
            showError={showError}
          />
        )}

        {/* Resizable Sidebar Panel */}
        <Animated.View style={
          isDesktop
            ? { width: animatedWidth, height: '100%', overflow: 'hidden', pointerEvents: isResizing ? 'none' : 'auto' }
            : { flex: 1, width: '100%', display: (!activeSettingsSubPage) ? 'flex' : 'none' }
        }>
          <SidebarContent
            THEME={THEME}
            isDesktop={isDesktop}
            sidebarOpacity={sidebarOpacity}
            profile={profile}
            handleScanQRCode={handleScanQRCode}
            handleNewChat={handleNewChat}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            conversations={conversations}
            loading={loading}
            nicknames={nicknames}
            handleConversationPress={handleConversationPress}
            selectedConversationId={selectedConversationId}
            user={user}
            activeSettingsSubPage={activeSettingsSubPage}
            setActiveSettingsSubPage={setActiveSettingsSubPage}
            desktopDetailView={desktopDetailView}
            setDesktopDetailView={setDesktopDetailView}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isDecoyMode={isDecoyMode}
            setIsDecoyMode={setIsDecoyMode}
            handleLogout={handleLogout}
            stealth={stealth}
            themePreference={themePreference}
            toggleTheme={toggleTheme}
            security={security}
            handleExportData={handleExportData}
            handleDeleteAccount={handleDeleteAccount}
            ui={ui}
            updates={updates}
            showSuccess={showSuccess}
            showError={showError}
            privacyLevel={privacyLevel}
            handlePrivacyLevel={handlePrivacyLevel}
            UpdateManager={UpdateManager}
            APP_DOCS={APP_DOCS}
          />
        </Animated.View>

        {/* Resizer Handle (Desktop Only) - SIBLING, NOT CHILD */}
        {isDesktop && isSidebarOpen && (
          <View
            {...panResponder.panHandlers}
            style={{
              width: 16,
              height: '100%',
              zIndex: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'col-resize', // Desktop Web cursor
              marginLeft: -8,
              position: 'relative',
              userSelect: 'none', // Prevent text selection on web
            }}
          >
            <View style={{
              width: 1,
              height: '100%',
              backgroundColor: isResizing ? THEME.primary : THEME.border,
              opacity: isResizing ? 1 : 0.5
            }} />
          </View>
        )}

        {/* === RIGHT CONTENT AREA === */}
        {/* Mobile Settings View - STRICTLY MOBILE ONLY */}
        {!isDesktop && (
          <MobileSettingsOverlay
            THEME={THEME}
            insets={insets}
            activeSettingsSubPage={activeSettingsSubPage}
            setActiveSettingsSubPage={setActiveSettingsSubPage}
            profile={profile}
            user={user}
            stealth={stealth}
            themePreference={themePreference}
            toggleTheme={toggleTheme}
            isDecoyMode={isDecoyMode}
            security={security}
            handleLogout={handleLogout}
            handleExportData={handleExportData}
            handleDeleteAccount={handleDeleteAccount}
            ui={ui}
            updates={updates}
            showSuccess={showSuccess}
            showError={showError}
            privacyLevel={privacyLevel}
            handlePrivacyLevel={handlePrivacyLevel}
            privacy={privacy}
            UpdateManager={UpdateManager}
          />
        )}

        {/* Desktop Content Area */}
        {isDesktop && (
          <DesktopContent
            THEME={THEME}
            desktopDetailView={desktopDetailView}
            isLargeDesktop={isLargeDesktop}
            profile={profile}
            security={security}
            ui={ui}
            privacyLevel={privacyLevel}
            handlePrivacyLevel={handlePrivacyLevel}
            privacy={privacy}
            selectedConversationId={selectedConversationId}
            user={user}
            setSelectedConversationId={setSelectedConversationId}
            showSuccess={showSuccess}
            showError={showError}
            stealth={stealth}
            themePreference={themePreference}
            toggleTheme={toggleTheme}
            updates={updates}
            isDecoyMode={isDecoyMode}
            handleRenameContact={handleRenameContact}
          />

        )}

        {/* Connection Requests Center (Mobile Overlay) */}
        {!isDesktop && ui.showRequestsView && (
          <View
            pointerEvents={ui.showRequestsView ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              top: Math.max(insets.top, 20) + 36,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1001
            }}
          >
            <RequestsCenter
              visible={ui.showRequestsView}
              onClose={() => ui.setShowRequestsView(false)}
              requests={requests}
              onRespond={handleRespond}
              THEME={THEME}
              isDesktop={false}
            />
          </View>
        )}

        {/* Desktop Dropdown is rendered inside GlobalHeader or as sibling */}
        {isDesktop && ui.showRequestsView && (
          <RequestsCenter
            visible={ui.showRequestsView}
            onClose={() => ui.setShowRequestsView(false)}
            requests={requests}
            onRespond={handleRespond}
            THEME={THEME}
            isDesktop={true}
          />
        )}
      </View>

      {/* --- MODALS --- */}
      <RenameContactModal
        visible={ui.showRenameModal}
        onClose={() => ui.setShowRenameModal(false)}
        renameTarget={ui.renameTarget}
        setRenameTarget={ui.setRenameTarget}
        handleRenameContact={handleRenameContact}
        THEME={THEME}
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
        isSkippable={ui.isSecuritySkippable}
        onSkip={() => {
          ui.setShowSecurityModal(false);
          ui.setIsSecuritySkippable(false);
        }}
      />

      <UpdateWalkthrough
        visible={updates.showUpdateWalkthrough}
        onClose={updates.handleCloseWalkthrough}
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

      <ScannedUserModal
        visible={ui.showScannedModal}
        onClose={() => ui.setShowScannedModal(false)}
        THEME={THEME}
        user={ui.scannedUser}
        onAddChat={handleAddChatUser}
        onScanAgain={handleScanAgain}
        isCreatingChat={isCreatingChat}
      />

      <AboutModal
        visible={ui.showAboutModal}
        onClose={() => ui.setShowAboutModal(false)}
        THEME={THEME}
        UpdateManager={UpdateManager}
        APP_DOCS={APP_DOCS}
      />

      <FeedbackModal
        visible={ui.showFeedbackModal}
        onClose={() => ui.setShowFeedbackModal(false)}
        THEME={THEME}
        email={feedback.feedbackEmail}
        setEmail={feedback.setFeedbackEmail}
        message={feedback.feedbackMessage}
        setMessage={feedback.setFeedbackMessage}
        isSending={feedback.isSendingFeedback}
        onSend={() => feedback.handleSendFeedback(() => ui.setShowFeedbackModal(false))}
      />

      <ConnectionRequestModal
        visible={!!latestRequest}
        request={latestRequest}
        onRespond={handleRespond}
        onClose={() => dismissRequest(latestRequest?.id)}
        THEME={THEME}
      />

      <LockConfirmationModal
        visible={ui.showLockConfirmation}
        onClose={() => ui.setShowLockConfirmation(false)}
        onConfirm={confirmLock}
        THEME={THEME}
      />

      <UserSearchModal
        visible={ui.showSearchModal}
        onClose={() => ui.setShowSearchModal(false)}
        THEME={THEME}
        searchQuery={ui.userSearchQuery}
        setSearchQuery={ui.setUserSearchQuery}
        onSearch={handleUserSearch}
        isSearching={ui.isSearching}
        searchResult={ui.searchResult}
        onAddChat={handleAddChatUser}
        isCreatingChat={isCreatingChat}
      />

      {/* Welcome Modal (Should be on top of everything) */}
      <WelcomeModal
        visible={!!welcomeData && welcomeData.type !== 'security_onboarding'}
        onClose={() => setWelcomeData(null)}
        userId={welcomeData?.userId}
        pin={welcomeData?.pin}
        type={welcomeData?.type}
        THEME={THEME}
      />

      {/* Google Security Setup View */}
      {/* Blocking mode: first-time onboarding (showSecuritySetup is set by triggerSecurityFlow) */}
      {showSecuritySetup && !welcomeData && !showOnboarding && (
        <GoogleSecurityPrompt
          THEME={THEME}
          showError={showError}
          showSuccess={showSuccess}
          onComplete={() => {
            setShowSecuritySetup(false);
            completeNudge();
          }}
          onSkip={() => {
            setShowSecuritySetup(false);
            dismissNudge();
          }}
          isNudge={false}
        />
      )}

      {/* Nudge mode: bottom-sheet for returning Google-only users */}
      {showNudge && !showSecuritySetup && !showOnboarding && !welcomeData && (
        <GoogleSecurityPrompt
          THEME={THEME}
          showError={showError}
          showSuccess={showSuccess}
          onComplete={() => {
            setShowNudge(false);
            completeNudge();
          }}
          onSkip={() => {
            setShowNudge(false);
            dismissNudge();
          }}
          isNudge={true}
        />
      )}

      {/* Mobile Bottom Navigation */}
      {!isDesktop && !activeSettingsSubPage && !ui.showRequestsView && (
        <>
          {/* Mobile FAB - New Chat (Only on Chats tab AND when chats exist) */}
          {activeTab === 'chats' && conversations.length > 0 && (
            <Pressable
              onPress={() => ui.setShowSearchModal(true)}
              style={({ pressed }) => ({
                position: 'absolute',
                bottom: 80 + Math.max(insets.bottom, 10),
                right: 20,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: THEME.primary,
                justifyContent: 'center',
                alignItems: 'center',
                ...select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4.65,
                  },
                  android: {
                    elevation: 8,
                  },
                  web: {
                    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
                  }
                }),
                transform: [{ scale: pressed ? 0.95 : 1 }],
                zIndex: 100
              })}
            >
              <Feather name="edit" size={24} color="#fff" />
            </Pressable>
          )}

          <BottomNav
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            THEME={THEME}
          />
        </>
      )}

      {/* Custom Themed Image Picker */}
      <CustomImagePicker
        visible={profile.isImagePickerVisible}
        onClose={() => profile.setIsImagePickerVisible(false)}
        onSelect={(asset) => profile.handleSelectImage(asset, showSuccess, showError)}
      />

      {/* Onboarding Slides (Topmost Layer for New Users) */}
      <OnboardingSlides
        visible={showOnboarding}
        onClose={handleOnboardingClose}
        THEME={THEME}
      />

      {/* Account Link Modal: shown when email-user tries Google sign-in on same email */}
      <AccountLinkModal
        visible={!!pendingGoogleLink}
        email={pendingGoogleLink?.email || ''}
        onLink={linkGoogleToEmailAccount}
        onDismiss={clearPendingGoogleLink}
        THEME={THEME}
        showError={showError}
        showSuccess={showSuccess}
      />
    </ScreenContainer>
  );
}
