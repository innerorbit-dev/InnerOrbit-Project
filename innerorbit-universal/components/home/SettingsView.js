import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, Image } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getHomeStyles } from "../../styles/home.styles";
import { LoadingDots } from "../ui/loading-dots";
import { UpdateManager } from "../../lib/update-manager";

export const SettingsView = ({
  THEME,
  user,
  userPhoto,
  ACCOUNT_IMG,
  myUserId,
  userBio,
  isDesktop,
  setDesktopDetailView,
  setActiveSettingsSubPage,

  // Stealth Props
  stealthMode,
  stealthButton,
  stealthCode,
  settingsStealthExpanded,
  setSettingsStealthExpanded,
  expandedStealthOption,
  setExpandedStealthOption,
  handleUpdateStealth,
  handleUpdateStealthButton,
  handleUpdateStealthCode,

  // Theme Props
  themePreference,
  toggleTheme,

  // Security Props
  appLockEnabled,
  handleToggleAppLock,
  biometricsEnabled,
  biometricsSupported,
  handleToggleBiometrics,
  screenshotsBlocked,
  handleToggleScreenshots,

  // Action Handlers
  handleSignOut,
  handleExportData,
  handleDeleteAccount,
  setShowFeedbackModal,
  setShowAboutModal,
  setShowUpdateWalkthrough
}) => {
  const styles = getHomeStyles(THEME);
  const [showSignOutAlert, setShowSignOutAlert] = useState(false);
  const [settingsThemeExpanded, setSettingsThemeExpanded] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100, maxWidth: 600, alignSelf: 'center', width: '100%' }}
      >
        <Text style={{ color: THEME.text, fontSize: 32, fontWeight: '900', marginBottom: 24 }}>Settings</Text>

        {/* SECTION 1: PROFILE CARD */}
        <Pressable
          onPress={() => {
            if (isDesktop) {
              setDesktopDetailView('profile');
            } else {
              setActiveSettingsSubPage('profile');
            }
          }}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, borderRadius: 24, padding: 20, marginBottom: 32,
            borderWidth: 1, borderColor: THEME.border,
            opacity: pressed ? 0.9 : 1
          })}
        >
          <View style={{ width: 64, height: 64, borderRadius: 24, marginRight: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <Image source={userPhoto ? { uri: userPhoto } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <View style={{ flex: 1 }}>
            {['Loading...', 'Syncing...', 'Wait...'].includes(myUserId) ? (
              <LoadingDots color={THEME.primary} size={5} gap={3} />
            ) : (
              <Text style={{ color: THEME.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>{myUserId}</Text>
            )}
            <Text numberOfLines={1} style={{ color: THEME.textSecondary, fontSize: 14 }}>{userBio || "No status bio set"}</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: THEME.border }}>
            <Feather name="chevron-right" size={20} color={THEME.textSecondary} />
          </View>
        </Pressable>

        {/* SECTION 2: PRIVACY & SAFETY */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>PRIVACY & SAFETY</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 24, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          <Pressable
            onPress={() => setSettingsStealthExpanded(!settingsStealthExpanded)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderBottomWidth: settingsStealthExpanded ? 1 : 0,
              borderBottomColor: 'rgba(255,255,255,0.05)'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="eye-off" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Stealth & Camouflage</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Decoy Interface, Triple-Tap, PINs</Text>
            </View>
            <Feather name={settingsStealthExpanded ? "chevron-up" : "chevron-down"} size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* Expanded Stealth Options */}
          {settingsStealthExpanded && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', paddingVertical: 8 }}>
              {/* Option 1: Access Method */}
              <Pressable
                onPress={() => setExpandedStealthOption(expandedStealthOption === 'access' ? null : 'access')}
                style={{ paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="key" size={16} color={THEME.textSecondary} style={{ marginRight: 12 }} />
                  <Text style={{ color: THEME.text, fontSize: 14 }}>Access Method</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: THEME.primary, fontSize: 12, marginRight: 8 }}>{stealthMode === 'header_lock' ? 'Header Lock' : (stealthMode === 'code' ? 'Secret Code' : 'Triple Tap')}</Text>
                  <Feather name={expandedStealthOption === 'access' ? "chevron-up" : "chevron-down"} size={14} color={THEME.textSecondary} />
                </View>
              </Pressable>

              {expandedStealthOption === 'access' && (
                <View style={{ paddingLeft: 48, paddingRight: 20, paddingBottom: 12 }}>
                  {[
                    { id: 'header_lock', label: 'Header Lock', desc: 'Hold "Chats" title for 3s' },
                    { id: 'code', label: 'Secret Code', desc: 'Type code in search bar' },
                    { id: 'display_triple', label: 'Triple Tap', desc: 'Tap "Calculator" title 3x' }
                  ].map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => handleUpdateStealth(opt.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                    >
                      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: THEME.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        {stealthMode === opt.id && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.primary }} />}
                      </View>
                      <View>
                        <Text style={{ color: THEME.text, fontSize: 13 }}>{opt.label}</Text>
                        <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>{opt.desc}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Option 2: Calculator Button */}
              <Pressable
                onPress={() => setExpandedStealthOption(expandedStealthOption === 'button' ? null : 'button')}
                style={{ paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="grid" size={16} color={THEME.textSecondary} style={{ marginRight: 12 }} />
                  <Text style={{ color: THEME.text, fontSize: 14 }}>Calculator Button</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: THEME.primary, fontSize: 12, marginRight: 8 }}>{stealthButton === 'display' ? 'Display' : 'None'}</Text>
                  <Feather name={expandedStealthOption === 'button' ? "chevron-up" : "chevron-down"} size={14} color={THEME.textSecondary} />
                </View>
              </Pressable>

              {expandedStealthOption === 'button' && (
                <View style={{ paddingLeft: 48, paddingRight: 20, paddingBottom: 12 }}>
                  {[{ id: 'display', label: 'Tap Display Area' }, { id: 'none', label: 'No Button (Hidden)' }].map((opt) => (
                    <Pressable key={opt.id} onPress={() => handleUpdateStealthButton(opt.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: THEME.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        {stealthButton === opt.id && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.primary }} />}
                      </View>
                      <Text style={{ color: THEME.text, fontSize: 13 }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <Pressable
            onPress={() => {
              if (isDesktop) {
                setDesktopDetailView('privacy');
              } else {
                setActiveSettingsSubPage('privacy');
              }
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(168, 85, 247, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="shield" size={18} color="#A855F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Social Privacy</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Hide presence, chats & visibility</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="camera-off" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Block Screenshots</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Prevent screen capture (Native/Desktop)</Text>
            </View>
            <Switch
              value={screenshotsBlocked}
              onValueChange={handleToggleScreenshots}
              trackColor={{ false: "#334155", true: "#EF4444" }}
              thumbColor={screenshotsBlocked ? "#FFF" : "#94A3B8"}
            />
          </View>
        </View>

        {/* SECTION 2.5: COMMUNICATION */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>COMMUNICATION</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 24, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          <Pressable
            onPress={() => {
              if (isDesktop) setDesktopDetailView('calls');
              else setActiveSettingsSubPage('calls');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="phone-call" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Calls</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Voice & Video Calls</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)', marginRight: 8 }}>
              <Text style={{ color: '#38BDF8', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>SOON</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => {
              if (isDesktop) setDesktopDetailView('stories');
              else setActiveSettingsSubPage('stories');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(236, 72, 153, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="layers" size={18} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Stories</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>24-Hour Status Updates</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(236, 72, 153, 0.2)', marginRight: 8 }}>
              <Text style={{ color: '#EC4899', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>SOON</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>
        </View>

        {/* SECTION 3: APP SECURITY */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>APP SECURITY</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(234, 179, 8, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="lock" size={18} color="#EAB308" />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>App Lock</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Require auth on open</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: "#334155", true: "#EAB308" }}
              thumbColor={appLockEnabled ? "#FFF" : "#94A3B8"}
            />
          </View>

          {appLockEnabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Feather name="smartphone" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Biometric Unlock</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Use FaceID / Fingerprint to open app</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: "#334155", true: "#10B981" }}
                thumbColor={biometricsEnabled ? "#FFF" : "#94A3B8"}
                disabled={!biometricsSupported}
              />
            </View>
          )}

          <Pressable
            onPress={() => setIsScannerVisible(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <MaterialCommunityIcons name="monitor-cellphone" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Linked Devices</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Link Desktop or Web via QR</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => {
              if (isDesktop) {
                setDesktopDetailView('security');
              } else {
                setActiveSettingsSubPage('security');
              }
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="key" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Security Details</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Credentials, Pin & Hardware Lock</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>
        </View>

        {/* SECTION 4: APP SETTINGS */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>APP SETTINGS</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          {/* Notifications - Placeholder or use existing logic if any */}
          <Pressable
            onPress={() => {
              if (isDesktop) {
                // If there's a notification view, use it, else alert
                // setDesktopDetailView('notifications'); // Assuming this exists or handled
                // For now, just a placeholder or link to OS settings
              } else {
                // setActiveSettingsSubPage('notifications'); 
              }
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="bell" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Notifications</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Configure alerts, sounds & privacy</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => setSettingsThemeExpanded(!settingsThemeExpanded)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderBottomWidth: settingsThemeExpanded ? 1 : 0,
              borderBottomColor: 'rgba(255,255,255,0.05)'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(236, 72, 153, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <MaterialCommunityIcons name="palette" size={18} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Appearance (Theme)</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>{themePreference.charAt(0).toUpperCase() + themePreference.slice(1)} Mode</Text>
            </View>
            <Feather name={settingsThemeExpanded ? "chevron-up" : "chevron-down"} size={18} color={THEME.textSecondary} />
          </Pressable>

          {settingsThemeExpanded && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', paddingVertical: 8 }}>
              {[
                { id: 'system', label: 'System Default', icon: 'monitor' },
                { id: 'light', label: 'Light Mode', icon: 'sun' },
                { id: 'dark', label: 'Dark Mode', icon: 'moon' }
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleTheme(opt.id, 'chat')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    backgroundColor: themePreference === opt.id ? 'rgba(236, 72, 153, 0.1)' : 'transparent'
                  })}
                >
                  <Feather name={opt.icon} size={16} color={themePreference === opt.id ? '#EC4899' : THEME.textSecondary} style={{ marginRight: 12 }} />
                  <Text style={{ color: themePreference === opt.id ? '#EC4899' : THEME.text, fontSize: 14 }}>{opt.label}</Text>
                  {themePreference === opt.id && <Feather name="check" size={14} color="#EC4899" style={{ marginLeft: 'auto' }} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* SECTION 4.5: SESSION & ACCOUNT */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>SESSION & ACCOUNT</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          {/* 1. Log Out */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="log-out" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Log Out</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Securely sign out of this session</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* 2. Export Data */}
          <Pressable
            onPress={handleExportData}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="download" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Export My Data</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Download your encrypted backup</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* 3. Delete Account */}
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Delete Account</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Permanently erase all your data</Text>
            </View>
            <Feather name="alert-triangle" size={16} color="rgba(239, 68, 68, 0.4)" />
          </Pressable>
        </View>

        {/* SECTION 5: INFO & SUPPORT */}
        <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>INFO & SUPPORT</Text>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: THEME.border }}>
          {/* 1. Documentation */}
          <Pressable
            onPress={() => {
              if (isDesktop) setDesktopDetailView('docs');
              else setActiveSettingsSubPage('docs');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(100, 116, 139, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="file-text" size={18} color="#64748B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Documentation</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Guides & Technical Specs</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* 2. Feedback */}
          <Pressable
            onPress={() => setShowFeedbackModal && setShowFeedbackModal(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="help-circle" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Feedback & Support</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Report issues or request features</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* 3. Updates */}
          <Pressable
            onPress={() => {
              if (isDesktop) setDesktopDetailView('updates');
              else setActiveSettingsSubPage('updates');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="download-cloud" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>Updates & Release</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Check version {UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : '1.0.2'}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>

          {/* 4. About */}
          <Pressable
            onPress={() => {
              if (isDesktop) setDesktopDetailView('about');
              else setActiveSettingsSubPage('about');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent'
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Feather name="info" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '600' }}>About InnerOrbit</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Safe messaging mission</Text>
            </View>
            <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};
