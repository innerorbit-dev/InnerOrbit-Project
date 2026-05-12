import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Switch, Alert } from 'react-native';
import { isWeb } from "../../utils/platform";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlobalHeader } from "../ui/GlobalHeader";
import { getHomeStyles } from "../../styles/home.styles";
import { LoadingDots } from "../ui/loading-dots";

const ACCOUNT_IMG = require('../../assets/account.webp');

// Helper to render a Section Title
const SectionTitle = ({ label, THEME }) => (
    <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 3, marginLeft: 8, marginBottom: 6, marginTop: 5 }}>
        {label}
    </Text>
);

// Helper for CardItem
const CardItem = ({
    THEME, icon, color, label, desc, onPress, active,
    isDestructive, rightElement, style, viewTarget,
    hideChevron, forceNav, customChevron, iconFamily = 'Feather',
    isDesktop, renderInlineDetail, forceAccordion, searchQuery,
    insets
}) => {
    const styles = getHomeStyles(THEME);
    const [expanded, setExpanded] = useState(false);
    const isMobile = !isWeb;
    const isExpandable = (forceAccordion && isMobile) || (!isDesktop && !!renderInlineDetail && !!viewTarget && forceAccordion);
    // Re-enabling expandable logic strictly for forceAccordion items on mobile for now

    // Search Filtering
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const text = (label || "").toLowerCase() + " " + (desc || "").toLowerCase();
        if (!text.includes(query)) return null;
    }

    const handlePress = () => {
        if (isExpandable) {
            setExpanded(!expanded);
        } else if (onPress) {
            onPress();
        }
    };

    return (
        <View>
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => ([
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 10, // More compact vertical padding
                        backgroundColor: active ? `${THEME.primary}15` : (pressed ? 'rgba(255,255,255,0.03)' : 'transparent'),
                        borderBottomWidth: 0,
                        borderBottomColor: 'transparent'
                    },
                    style
                ])}
            >
                <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: isDestructive ? 'rgba(239, 68, 68, 0.1)' : `rgba(${parseInt(color.slice(1, 3), 16) || 0}, ${parseInt(color.slice(3, 5), 16) || 0}, ${parseInt(color.slice(5, 7), 16) || 0}, 0.1)`,
                    justifyContent: 'center', alignItems: 'center', marginRight: 14
                }}>
                    {iconFamily === 'Feather' ? (
                        <Feather name={icon} size={18} color={isDestructive ? '#EF4444' : color} />
                    ) : (
                        <MaterialCommunityIcons name={icon} size={18} color={isDestructive ? '#EF4444' : color} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: isDestructive ? '#EF4444' : THEME.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
                    {desc && <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>{desc}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {rightElement}
                    {!hideChevron && (
                        isExpandable ? (
                            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={THEME.textSecondary} style={{ marginLeft: rightElement ? 10 : 0 }} />
                        ) : (
                            !rightElement && <Feather name={customChevron || "chevron-right"} size={18} color={THEME.textSecondary} />
                        )
                    )}
                </View>
            </Pressable>
            {isExpandable && expanded && (
                <View style={{ borderBottomWidth: 0, borderBottomColor: 'transparent' }}>
                    {renderInlineDetail(viewTarget)}
                </View>
            )}
        </View>
    );
};

const SettingsSection = ({ label, children, THEME, searchQuery }) => {
    // If search is active, check if any children match OR if label matches
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        // If label matches, just pass searchQuery as null to children so they all show? 
        // Or keep filtering? Usually if I search "Account", I want to see account items.
        // Let's strictly filter items for now, unless label is exact match?
        // Simpler: Just filter children.

        let hasMatch = false;
        React.Children.forEach(children, child => {
            if (React.isValidElement(child) && child.props) {
                const l = child.props.label || "";
                const d = child.props.desc || "";
                if (l.toLowerCase().includes(query) || d.toLowerCase().includes(query)) {
                    hasMatch = true;
                }
            }
        });

        if (!hasMatch) return null;
    }

    // Render simple section header and container for both Desktop and Mobile
    return (
        <View>
            <SectionTitle label={label} THEME={THEME} />
            <View style={{
                backgroundColor: THEME.surface,
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 0,
                borderColor: 'transparent'
            }}>
                {React.Children.map(children, child => {
                    if (React.isValidElement(child)) {
                        return React.cloneElement(child, { searchQuery });
                    }
                    return child;
                })}
            </View>
        </View>
    );
};

export const SettingsSidebar = ({
    THEME,
    setDesktopDetailView,
    selectedView,
    handleLogout,
    handleExportData,
    handleDeleteAccount,
    setShowFeedbackModal,
    user,
    profile,
    isDecoyMode,
    isDesktop,
    renderInlineDetail,
    ui,
    security,
    screenshotsBlocked,
    handleToggleScreenshots,
    searchQuery
}) => {
    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: isDesktop ? 40 : 120 }}
            >
                {/* User Profile Card */}
                {!searchQuery && (
                    <SettingsSection label="MY PROFILE" THEME={THEME}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 0, borderBottomColor: 'transparent' }}>
                            <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', marginRight: 16, borderWidth: 2, borderColor: THEME.primary }}>
                                <Image source={profile?.photoURL ? { uri: profile.photoURL } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            </View>
                            <View style={{ flex: 1 }}>
                                {['Loading...', 'Syncing...', 'Wait...', '...'].includes(profile?.myUserId) || !profile?.myUserId ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ color: THEME.primary, fontSize: 18, fontWeight: '900', marginRight: 8 }}>User ID: </Text>
                                        <LoadingDots color={THEME.primary} size={5} gap={3} />
                                    </View>
                                ) : (
                                    <Text style={{ color: THEME.primary, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>User ID: {profile.myUserId}</Text>
                                )}
                                <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={1}>{user?.email}</Text>
                            </View>
                        </View>
                        <CardItem
                            THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                            icon="user" color="#3B82F6" label="Edit Profile" desc="Customize your public profile"
                            viewTarget="profile"
                            onPress={() => setDesktopDetailView('profile')}
                            active={selectedView === 'profile'}
                        />
                        <CardItem
                            THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                            icon="share-2" color={THEME.primary} label="Connect" desc="Show QR Code"
                            viewTarget="connect"
                            onPress={() => setDesktopDetailView('connect')}
                            active={selectedView === 'connect'}
                            forceAccordion={true}
                            style={{ borderBottomWidth: 0 }}
                        />
                    </SettingsSection>
                )}

                {/* Communication Section */}
                <SettingsSection label="COMMUNICATION" THEME={THEME} searchQuery={searchQuery}>
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="phone-call" color="#38BDF8" label="Calls" desc="Voice Calls"
                        viewTarget="calls"
                        onPress={() => setDesktopDetailView('calls')}
                        active={selectedView === 'calls'}
                        rightElement={
                            <View style={{ backgroundColor: `${THEME.primary}10`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: `${THEME.primary}20` }}>
                                <Text style={{ color: THEME.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>SOON</Text>
                            </View>
                        }
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="layers" color="#EC4899" label="Stories" desc="24-Hour Status Updates"
                        viewTarget="stories"
                        onPress={() => setDesktopDetailView('stories')}
                        active={selectedView === 'stories'}
                        style={{ borderBottomWidth: 0 }}
                        rightElement={
                            <View style={{ backgroundColor: `${THEME.primary}10`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: `${THEME.primary}20` }}>
                                <Text style={{ color: THEME.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>SOON</Text>
                            </View>
                        }
                    />
                </SettingsSection>

                {/* Privacy Section */}
                <SettingsSection label="PRIVACY & SAFETY" THEME={THEME} searchQuery={searchQuery}>
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="eye-off" color="#8B5CF6" label="Social Privacy" desc="Hide presence, chats & visibility"
                        viewTarget="privacy"
                        onPress={() => setDesktopDetailView('privacy')}
                        active={selectedView === 'privacy'}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="shield" color="#10B981" label="Stealth Mode" desc="Triggers & Decoy App"
                        viewTarget="stealth"
                        onPress={() => setDesktopDetailView('stealth')}
                        active={selectedView === 'stealth'}
                    />
                </SettingsSection>

                {/* Account & Security Section */}
                <SettingsSection label="ACCOUNT SECURITY" THEME={THEME} searchQuery={searchQuery}>
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="lock" color="#3B82F6" label="Security Details" desc="Credentials, Pin & Hardware Lock"
                        viewTarget="security"
                        onPress={() => setDesktopDetailView('security')}
                        active={selectedView === 'security'}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="monitor-cellphone" color="#3B82F6" label="Linked Devices" desc="Link Desktop or Web via QR"
                        onPress={() => ui?.setShowScanner(true)}
                        rightElement={null}
                        iconFamily="MaterialCommunityIcons"
                        style={{ borderBottomWidth: 0 }}
                    />
                </SettingsSection>

                {/* App Settings */}
                <SettingsSection label="APP SETTINGS" THEME={THEME} searchQuery={searchQuery}>
                    {!isWeb && (
                        <CardItem
                            THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                            icon="lock" color="#3B82F6" label="App Lock" desc="Require auth on open"
                            rightElement={
                                <Switch
                                    value={security?.biometricsEnabled}
                                    onValueChange={(val) => security?.handleToggleBiometrics(val, null)}
                                    trackColor={{ false: "#334155", true: THEME.primary }}
                                    thumbColor={security?.biometricsEnabled ? "#FFF" : "#94A3B8"}
                                />
                            }
                        />
                    )}
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="eye-off" color="#EF4444" label="Prevent Screenshots" desc="Block capture & recording"
                        rightElement={
                            <Switch
                                value={screenshotsBlocked}
                                onValueChange={(val) => security?.handleToggleScreenshots(val, null)}
                                trackColor={{ false: "#334155", true: THEME.primary }}
                                thumbColor={screenshotsBlocked ? "#FFF" : "#94A3B8"}
                            />
                        }
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="bell" color="#f43f5e" label="Notifications"
                        viewTarget="notifications"
                        onPress={() => {
                            const message = "Our advanced stealth notification system is being optimized for maximum privacy. Manual controls are temporarily disabled to ensure security protocol integrity.";
                            if (isWeb) {
                                alert(message);
                            } else {
                                Alert.alert("Security Notification", message);
                            }
                        }}
                        active={selectedView === 'notifications'}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="palette" color="#EC4899" label="Appearance" desc="Themes & Wallpapers"
                        viewTarget="theme"
                        onPress={() => setDesktopDetailView('theme')}
                        active={selectedView === 'theme'}
                        style={{ borderBottomWidth: 0 }}
                        iconFamily="MaterialCommunityIcons"
                    />
                </SettingsSection>

                {/* Info & Support */}
                <SettingsSection label="INFO & SUPPORT" THEME={THEME} searchQuery={searchQuery}>
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="file-text" color="#64748B" label="Documentation"
                        viewTarget="docs"
                        onPress={() => setDesktopDetailView('docs')}
                        active={selectedView === 'docs'}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="help-circle" color="#10B981" label="Feedback & Support"
                        onPress={() => setShowFeedbackModal && setShowFeedbackModal(true)}
                        rightElement={null}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="refresh-cw" color="#8B5CF6" label="Updates & Patches"
                        viewTarget="updates"
                        onPress={() => setDesktopDetailView('updates')}
                        active={selectedView === 'updates'}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="info" color="#3B82F6" label="About InnerOrbit"
                        viewTarget="about"
                        onPress={() => isDesktop ? setDesktopDetailView('about') : setDesktopDetailView('about')} // setDesktopDetailView is setActiveSettingsSubPage on mobile
                        active={selectedView === 'about'}
                        forceNav={true}
                        style={{ borderBottomWidth: 0 }}
                    />
                </SettingsSection>

                {/* Session & Account */}
                <SettingsSection label="SESSION & ACCOUNT" THEME={THEME} searchQuery={searchQuery}>
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="log-out" color="#EF4444" label="Log Out"
                        onPress={handleLogout}
                        rightElement={null}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="download" color="#3B82F6" label="Export My Data"
                        onPress={handleExportData}
                        rightElement={null}
                    />
                    <CardItem
                        THEME={THEME} isDesktop={isDesktop} renderInlineDetail={renderInlineDetail}
                        icon="trash-2" color="#EF4444" label="Delete Account" isDestructive
                        onPress={handleDeleteAccount}
                        style={{ borderBottomWidth: 0 }}
                        rightElement={<Feather name="alert-triangle" size={16} color="rgba(239, 68, 68, 0.4)" />}
                    />
                </SettingsSection>

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
};
