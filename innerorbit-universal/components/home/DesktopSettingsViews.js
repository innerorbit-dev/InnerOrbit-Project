import React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Image, TextInput, ActivityIndicator } from 'react-native';
import { isMobile, isMobileLayout } from '../../utils/platform';
import { Feather } from "@expo/vector-icons";
// styles not used here

export const StealthSettingsView = ({
    THEME,
    stealthMode,
    stealthButton,
    stealthCode,
    handleUpdateStealth,
    handleUpdateStealthButton,
    handleUpdateStealthCode,
    isMobile,
    isLocked,
    isInline
}) => (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
        <ScrollView contentContainerStyle={{ padding: (isMobile || isInline) ? 20 : 40, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
            {!isInline && (
                <>
                    <Text style={{ color: THEME.text, fontSize: 36, fontWeight: '900', marginBottom: 8 }}>Stealth Mode</Text>
                    <Text style={{ color: THEME.textSecondary, fontSize: 16, marginBottom: 48 }}>Configure how you access the hidden interface.</Text>
                </>
            )}

            {/* Access Method */}
            <View style={{ marginBottom: 40 }}>
                <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Access Method</Text>
                <View style={{ gap: 12 }}>
                    {[
                        { id: 'header_lock', label: 'Header Lock', desc: 'Hold "Chats" title for 3s to unlock', icon: 'lock' },
                        { id: 'code', label: 'Secret Code', desc: 'Type custom code in search bar', icon: 'hash' },
                        { id: 'display_triple', label: 'Triple Tap', desc: 'Tap "Calculator" title 3x', icon: 'mouse-pointer' }
                    ].map((opt) => (
                        <Pressable
                            key={opt.id}
                            onPress={() => !isLocked && handleUpdateStealth(opt.id)}
                            style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16,
                                backgroundColor: stealthMode === opt.id ? `${THEME.primary}20` : THEME.actionBackground,
                                borderWidth: 0, borderColor: 'transparent',
                                opacity: (pressed || isLocked) ? 0.9 : 1
                            })}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: stealthMode === opt.id ? THEME.primary : THEME.actionBackground, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                <Feather name={opt.icon} size={20} color={stealthMode === opt.id ? THEME.surface : THEME.textSecondary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{opt.label}</Text>
                                <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>{opt.desc}</Text>
                            </View>
                            {stealthMode === opt.id && <Feather name="check-circle" size={24} color="#8B5CF6" />}
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Configuration Section based on selection */}
            {stealthMode === 'display_triple' && (
                <View style={{ marginTop: 20, padding: 32, backgroundColor: THEME.surface, borderRadius: 24, borderWidth: 0 }}>
                    <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Select Trigger Button</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {['display', 'AC', 'DEL', '%', '/', '*', '-', '+', '='].map(btn => (
                            <Pressable
                                key={btn}
                                onPress={() => !isLocked && handleUpdateStealthButton(btn)}
                                style={{
                                    paddingVertical: 12, paddingHorizontal: 20,
                                    backgroundColor: stealthButton === btn ? THEME.primary : 'rgba(255,255,255,0.05)',
                                    borderRadius: 12, borderWidth: 0,
                                    opacity: isLocked ? 0.5 : 1
                                }}
                            >
                                <Text style={{ color: stealthButton === btn ? '#fff' : THEME.text, fontSize: 14, fontWeight: '600' }}>
                                    {btn === 'display' ? 'Display' : btn}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            )}

            {stealthMode === 'code' && (
                <View style={{ marginTop: 20, padding: 32, backgroundColor: THEME.surface, borderRadius: 24, borderWidth: 0 }}>
                    <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Set Secret Code</Text>
                    <TextInput
                        value={stealthCode}
                        onChangeText={(t) => !isLocked && handleUpdateStealthCode(t)}
                        editable={!isLocked}
                        style={{ backgroundColor: THEME.background, color: THEME.text, padding: 16, borderRadius: 12, fontSize: 16, fontFamily: 'monospace', opacity: isLocked ? 0.5 : 1 }}
                        placeholder="Min 8 digits recommended"
                        placeholderTextColor={THEME.textSecondary}
                    />
                </View>
            )}
        </ScrollView>
    </View>
);

export const ThemeSettingsView = ({ THEME, themePreference, toggleTheme, isInline, side = 'chat' }) => {
    // Pull chat customization from the theme store/hook
    const [chatBubbleThemeKey, setChatBubbleTheme] = React.useState(null);
    const [chatBgStyleKey, setChatBgStyle] = React.useState(null);

    // Use dynamic import to avoid circular deps — grab from useAppTheme via a memo
    const { useAppTheme: _unused, BUBBLE_THEMES, CHAT_BG_STYLES } = React.useMemo(() => {
        try {
            const t = require('../../store/themeStore');
            return { BUBBLE_THEMES: t.BUBBLE_THEMES, CHAT_BG_STYLES: t.CHAT_BG_STYLES };
        } catch { return { BUBBLE_THEMES: {}, CHAT_BG_STYLES: {} }; }
    }, []);

    const { chatBubbleThemeKey: storedBubble, chatBgStyleKey: storedBg,
        setChatBubbleTheme: storeBubbleSetter, setChatBgStyle: storeBgSetter } =
        React.useMemo(() => {
            try { return require('../../store/themeStore').useThemeStore.getState(); }
            catch { return { chatBubbleThemeKey: 'rose', chatBgStyleKey: 'clean', setChatBubbleTheme: () => { }, setChatBgStyle: () => { } }; }
        }, []);

    const [localBubble, setLocalBubble] = React.useState(storedBubble || 'rose');
    const [localBg, setLocalBg] = React.useState(storedBg || 'clean');

    const handleBubble = (key) => {
        setLocalBubble(key);
        try { require('../../store/themeStore').useThemeStore.getState().setChatBubbleTheme(key); } catch { }
    };
    const handleBg = (key) => {
        setLocalBg(key);
        try { require('../../store/themeStore').useThemeStore.getState().setChatBgStyle(key); } catch { }
    };

    const bubbleThemes = Object.values(BUBBLE_THEMES || {});
    const bgStyles = Object.values(CHAT_BG_STYLES || {});

    const isDark = THEME.background === '#000000' || THEME.background === '#020617' || THEME.background === '#F8FAFC' && false;
    // Simple heuristic: if background is very dark, we're in dark mode
    const inferDark = THEME.text === '#F1F5F9' || THEME.text === '#FFFFFF';

    // --- Section Components ---
    const SectionLabel = ({ icon, label, desc }) => (
        <View style={{ marginBottom: 14, marginTop: isInline ? 20 : 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{
                    width: 28, height: 28, borderRadius: 8, backgroundColor: `${THEME.primary}20`,
                    alignItems: 'center', justifyContent: 'center', marginRight: 10
                }}>
                    <Feather name={icon} size={14} color={THEME.primary} />
                </View>
                <Text style={{ color: THEME.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>{label}</Text>
            </View>
            {desc && <Text style={{ color: THEME.textSecondary, fontSize: 12, marginLeft: 38 }}>{desc}</Text>}
        </View>
    );

    // Light/Dark mode content (existing)
    const modeContent = (
        <View>
            <SectionLabel icon="sun" label="App Theme" desc="Controls light or dark mode across the app" />
            <View style={{ flexDirection: 'row', gap: isInline ? 8 : 12, marginHorizontal: isInline ? 0 : 0 }}>
                {[
                    { id: 'system', label: isInline ? 'Default' : 'System', icon: 'cpu' },
                    { id: 'light', label: 'Light', icon: 'sun' },
                    { id: 'dark', label: 'Dark', icon: 'moon' }
                ].map((opt) => (
                    <Pressable
                        key={opt.id}
                        onPress={() => toggleTheme(opt.id, side)}
                        style={({ pressed }) => ({
                            flex: 1, height: 70, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
                            backgroundColor: themePreference === opt.id ? `${THEME.primary}20` : THEME.actionBackground,
                            borderWidth: themePreference === opt.id ? 1.5 : 0,
                            borderColor: themePreference === opt.id ? THEME.primary : 'transparent',
                            opacity: pressed ? 0.85 : 1
                        })}
                    >
                        <Feather name={opt.icon} size={20} color={themePreference === opt.id ? THEME.primary : THEME.textSecondary} style={{ marginBottom: 6 }} />
                        <Text style={{ color: themePreference === opt.id ? THEME.primary : THEME.text, fontWeight: '700', fontSize: 12 }}>{opt.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );

    // Bubble color content
    const bubbleContent = (
        <View>
            <SectionLabel icon="message-circle" label="Message Bubble Color" desc="Choose sent & received message colors" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {bubbleThemes.map((bt) => {
                    const isActive = localBubble === bt.key;
                    const sent = inferDark ? bt.sentDark : bt.sentLight;
                    const received = inferDark ? bt.receivedDark : bt.receivedLight;
                    return (
                        <Pressable
                            key={bt.key}
                            onPress={() => handleBubble(bt.key)}
                            style={({ pressed }) => ({
                                width: isInline ? '21%' : '21%',
                                borderRadius: 14,
                                padding: 10,
                                alignItems: 'center',
                                backgroundColor: isActive ? `${THEME.primary}18` : THEME.surface,
                                borderWidth: isActive ? 1.5 : 1,
                                borderColor: isActive ? THEME.primary : `${THEME.primary}20`,
                                opacity: pressed ? 0.8 : 1
                            })}
                        >
                            {/* Preview: two mini bubbles */}
                            <View style={{ width: '100%', gap: 4, marginBottom: 6 }}>
                                <View style={{ height: 16, borderRadius: 8, backgroundColor: sent, alignSelf: 'flex-end', width: '80%' }} />
                                <View style={{ height: 16, borderRadius: 8, backgroundColor: received, alignSelf: 'flex-start', width: '70%' }} />
                            </View>
                            <Text style={{ color: isActive ? THEME.primary : THEME.textSecondary, fontSize: 10, fontWeight: '700' }}>
                                {bt.label}
                            </Text>
                            {isActive && (
                                <View style={{ position: 'absolute', top: 6, right: 6 }}>
                                    <Feather name="check-circle" size={12} color={THEME.primary} />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );

    // Chat background content
    const bgContent = (
        <View>
            <SectionLabel icon="layout" label="Chat Background" desc="Set the look of your chat canvas" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {bgStyles.map((bg) => {
                    const isActive = localBg === bg.key;
                    const bgColor = inferDark ? (bg.bgDark || THEME.background) : (bg.bgLight || THEME.background);
                    return (
                        <Pressable
                            key={bg.key}
                            onPress={() => handleBg(bg.key)}
                            style={({ pressed }) => ({
                                width: isInline ? '29%' : '29%',
                                borderRadius: 14,
                                overflow: 'hidden',
                                borderWidth: isActive ? 2 : 1,
                                borderColor: isActive ? THEME.primary : `${THEME.primary}25`,
                                opacity: pressed ? 0.8 : 1
                            })}
                        >
                            {/* Visual preview */}
                            <View style={{ height: 56, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
                                {bg.key === 'dots' && (
                                    <Text style={{ fontSize: 18, letterSpacing: 2, color: inferDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}>· · · · ·{'\n'}· · · · ·</Text>
                                )}
                                {bg.key === 'grid' && (
                                    <Text style={{ fontSize: 14, letterSpacing: 4, color: inferDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}>┼ ┼ ┼{'\n'}┼ ┼ ┼</Text>
                                )}
                                {bg.key === 'clean' && (
                                    <Feather name="minus" size={20} color={inferDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'} />
                                )}
                            </View>
                            <View style={{ backgroundColor: THEME.surface, paddingVertical: 6, alignItems: 'center' }}>
                                <Text style={{ color: isActive ? THEME.primary : THEME.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                    {bg.label}
                                </Text>
                            </View>
                            {isActive && (
                                <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: THEME.primary, borderRadius: 8, padding: 2 }}>
                                    <Feather name="check" size={10} color="#fff" />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );

    if (isInline) {
        return (
            <View style={{ width: '100%', paddingHorizontal: 16, paddingBottom: 40 }}>
                {modeContent}
                {side === 'chat' && bubbleContent}
                {side === 'chat' && bgContent}
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: THEME.background }}>
            <ScrollView contentContainerStyle={{ padding: 40, maxWidth: 800, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
                <Text style={{ color: THEME.primary, fontSize: 36, fontWeight: '900', marginBottom: 8 }}>Appearance</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: 16, marginBottom: 8 }}>Customize your chat look and feel.</Text>
                {modeContent}
                {side === 'chat' && bubbleContent}
                {side === 'chat' && bgContent}
            </ScrollView>
        </View>
    );
};

export const AboutSettingsView = ({
    THEME,
    setShowUpdateWalkthrough,
    UpdateManager,
    isInline
}) => {
    const isMobile = isMobileLayout;

    const renderContent = () => (
        <View style={{ width: '100%', alignItems: (isInline || isMobile) ? 'center' : 'stretch' }}>
            {/* App Branding */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: (isInline || isMobile) ? 20 : 48, marginTop: (isInline || isMobile) ? 24 : 0 }}>
                <View style={{ width: (isInline || isMobile) ? 56 : 100, height: (isInline || isMobile) ? 56 : 100, borderRadius: (isInline || isMobile) ? 16 : 32, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 0, marginRight: 16 }}>
                    <Feather name="shield" size={(isInline || isMobile) ? 28 : 50} color="#6366F1" />
                </View>
                <View>
                    <Text style={{ fontSize: (isInline || isMobile) ? 24 : 42, fontWeight: '900', color: THEME.text, marginBottom: 2, letterSpacing: 1 }}>InnerOrbit</Text>
                    <Text style={{ fontSize: 13, color: THEME.primary, fontWeight: '800' }}>v{UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : '1.0.2'} Beta</Text>
                </View>
            </View>

            {/* Description */}
            <View style={{ backgroundColor: THEME.surface, padding: 16, borderRadius: 16, borderWidth: 0, marginBottom: 20, maxWidth: (isInline || isMobile) ? '90%' : '100%' }}>
                <Text style={{ fontSize: 13, color: THEME.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                    Secure Communication Platform designed for maximum privacy and stealth. Encrypted messaging masked as a functional calculator.
                </Text>
            </View>

            {/* Actions */}
            <Pressable
                onPress={() => setShowUpdateWalkthrough(true)}
                style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: THEME.surface, padding: 12, borderRadius: 12,
                    borderWidth: 0, marginBottom: 24,
                    width: (isInline || isMobile) ? '90%' : 'auto',
                    opacity: pressed ? 0.8 : 1
                })}
            >
                <Feather name="gift" size={18} color="#EAB308" style={{ marginRight: 8 }} />
                <Text style={{ color: THEME.text, fontWeight: '700', fontSize: 14 }}>View "What's New" Walkthrough</Text>
            </Pressable>

            {/* Footer */}
            <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 20 }}>
                <Text style={{ color: THEME.textSecondary, fontSize: 12, opacity: 0.5 }}>© 2026 InnerOrbit Labs • All Rights Reserved</Text>
            </View>
        </View>
    );

    if (isInline) {
        return renderContent();
    }

    return (
        <View style={{ flex: 1, backgroundColor: THEME.background }}>
            <ScrollView contentContainerStyle={{ padding: isMobile ? 20 : 40, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                {renderContent()}
            </ScrollView>
        </View>
    );
};
