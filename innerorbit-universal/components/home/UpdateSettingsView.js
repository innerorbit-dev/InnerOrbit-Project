import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { isWeb } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { getHomeStyles } from "../../styles/home.styles";
import { GlobalHeader } from "../ui/GlobalHeader";
import { UpdateManager } from "../../lib/update-manager";

export const UpdateSettingsView = ({
    THEME,
    UpdateManager: PropUpdateManager,
    updateCheckStatus: propStatus,
    handleCheckForUpdate: propCheck,
    updatePrefs: propPrefs,
    handleUpdatePrefChange: propPrefChange,
    downloadProgress = 0,
    handleDownloadUpdate: propDownload,
    handleInstallUpdate: propInstall,
    isInline = false
}) => {
    const styles = getHomeStyles(THEME);
    // Fallback to local state if props not provided (standalone test usage)
    const [localStatus, setLocalStatus] = useState('idle');
    const [localPrefs, setLocalPrefs] = useState({});

    const updateCheckStatus = propStatus || localStatus;
    const updatePrefs = propPrefs || localPrefs;
    const usedUpdateManager = PropUpdateManager || UpdateManager;

    // Safety check for getCurrentVersion
    const currentVersion = usedUpdateManager?.getCurrentVersion ? usedUpdateManager.getCurrentVersion() : '1.0.2';

    useEffect(() => {
        if (!propPrefs) {
            usedUpdateManager.getPreferences()
                .then(setLocalPrefs)
                .catch(e => console.warn("[UpdateSettingsView] Failed to load preferences:", e));
        }
    }, [propPrefs, usedUpdateManager]);

    const handleCheckForUpdate = async () => {
        if (propCheck) return propCheck();
        setLocalStatus('checking');
        const res = await usedUpdateManager.checkForUpdate(true);
        setLocalStatus(res.isAvailable ? 'available' : 'none');
    };

    const handleUpdatePrefChange = async (key, val) => {
        if (propPrefChange) return propPrefChange(key, val);
        await usedUpdateManager.setPreferences(key, val);
        const newPrefs = await usedUpdateManager.getPreferences();
        setLocalPrefs(newPrefs);
    };

    const getStatusText = () => {
        if (updateCheckStatus === 'checking') return 'Checking for updates...';
        if (updateCheckStatus === 'available') return 'Patch available!';
        if (updateCheckStatus === 'downloading') {
            if (downloadProgress < 40) return 'Downloading packages...';
            if (downloadProgress < 80) return 'Installing patch...';
            if (downloadProgress < 95) return 'Finalizing...';
            return 'Restarting app...';
        }
        if (updateCheckStatus === 'none') return 'Application is up to date';
        if (updateCheckStatus === 'error') return 'Update check failed';
        return 'System Ready';
    };

    const renderUpdateCard = () => (
        <View style={{
            backgroundColor: THEME.surface,
            borderRadius: isInline ? 20 : 24,
            padding: isInline ? 20 : 32,
            borderWidth: 0,
            borderColor: 'transparent',
            marginBottom: isInline ? 16 : 32
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: THEME.textSecondary, fontSize: 12, marginBottom: 4 }}>CURRENT VERSION</Text>
                    <Text style={{ color: THEME.text, fontSize: isInline ? 24 : 32, fontWeight: '800' }}>v{currentVersion}</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        {updateCheckStatus === 'checking' && <ActivityIndicator size="small" color={THEME.primary} style={{ marginRight: 8 }} />}
                        <Text style={{
                            color: (updateCheckStatus === 'available' || updateCheckStatus === 'downloading') ? THEME.primary : (updateCheckStatus === 'error' ? '#EF4444' : '#10B981'),
                            fontSize: 14, fontWeight: '700'
                        }}>
                            {getStatusText()}
                        </Text>
                    </View>

                    {updateCheckStatus === 'downloading' && (
                        <View style={{ marginTop: 16 }}>
                            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                <View style={{ height: '100%', width: `${downloadProgress}%`, backgroundColor: THEME.primary }} />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>{Math.round(downloadProgress)}% Complete</Text>
                                <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: 'bold' }}>DO NOT CLOSE</Text>
                            </View>
                        </View>
                    )}
                </View>

                {(updateCheckStatus !== 'downloading' && updateCheckStatus !== 'installing') && (
                    <Pressable
                        onPress={updateCheckStatus === 'ready' ? propInstall : (updateCheckStatus === 'available' ? propDownload : handleCheckForUpdate)}
                        disabled={updateCheckStatus === 'checking'}
                        style={({ pressed }) => ({
                            marginLeft: 16,
                            paddingHorizontal: 20, paddingVertical: 12,
                            backgroundColor: (updateCheckStatus === 'available' || updateCheckStatus === 'ready') ? '#8B5CF6' : THEME.primary,
                            borderRadius: 12,
                            opacity: pressed || updateCheckStatus === 'checking' ? 0.7 : 1
                        })}
                    >
                        <Text style={{ color: (updateCheckStatus === 'available' || updateCheckStatus === 'ready') ? '#FFF' : '#0F172A', fontWeight: '800' }}>
                            {updateCheckStatus === 'available' ? 'DOWNLOAD' :
                                updateCheckStatus === 'ready' ? 'INSTALL' :
                                    (updateCheckStatus === 'checking' ? '...' : 'CHECK')}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );

    const renderContent = () => (
        <>
            {!isInline && (
                <>
                    <Text style={{ color: THEME.text, fontSize: 36, fontWeight: '900', marginBottom: 8 }}>Updates & Release</Text>
                    <Text style={{ color: THEME.textSecondary, fontSize: 16, marginBottom: 48 }}>Manage application version and auto-update policies.</Text>
                </>
            )}

            {renderUpdateCard()}

            {/* Auto-Update Preferences */}
            <Text style={{ color: THEME.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 8, marginBottom: 12 }}>CONFIGURATION</Text>
            <View style={{ backgroundColor: THEME.surface, borderRadius: 24, padding: 0, borderWidth: 0, borderColor: 'transparent', overflow: 'hidden' }}>

                {/* Desktop Options */}
                {isWeb ? (
                    <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 0, borderBottomColor: 'transparent' }}>
                            <View>
                                <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '700' }}>Auto-Download Updates</Text>
                                <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 2 }}>Download updates automatically in background</Text>
                            </View>
                            <Switch
                                value={updatePrefs.desktopAuto !== false}
                                onValueChange={(val) => handleUpdatePrefChange(usedUpdateManager.CONSTANTS.KEY_DESKTOP_AUTO, val)}
                                trackColor={{ false: THEME.border, true: THEME.primary }}
                                thumbColor={updatePrefs.desktopAuto !== false ? "#FFF" : "#94A3B8"}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24 }}>
                            <View>
                                <Text style={{ color: THEME.text, fontSize: 16, fontWeight: '700' }}>Metered Connections</Text>
                                <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 2 }}>Allow updates over metered networks</Text>
                            </View>
                            <Switch
                                value={updatePrefs.desktopMetered}
                                onValueChange={(val) => handleUpdatePrefChange(usedUpdateManager.CONSTANTS.KEY_DESKTOP_METERED, val)}
                                trackColor={{ false: THEME.border, true: THEME.primary }}
                                thumbColor={updatePrefs.desktopMetered ? "#FFF" : "#94A3B8"}
                            />
                        </View>
                    </>
                ) : (
                    /* Mobile Options */
                    [
                        { id: 'wifi', label: 'Wi-Fi Only', desc: 'Save mobile data' },
                        { id: 'all', label: 'Wi-Fi and Mobile Data', desc: 'Update anytime (charges may apply)' },
                        { id: 'cellular', label: 'Mobile Data Only', desc: 'Strictly cellular networks' }
                    ].map((opt, i) => (
                        <Pressable
                            key={opt.id}
                            onPress={() => handleUpdatePrefChange(usedUpdateManager.CONSTANTS.KEY_MOBILE_PREF, opt.id)}
                            style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center', padding: isInline ? 16 : 24,
                                backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent',
                                borderTopWidth: 0, borderTopColor: 'transparent'
                            })}
                        >
                            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: updatePrefs.mobilePref === opt.id ? THEME.primary : THEME.textSecondary, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                {updatePrefs.mobilePref === opt.id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: THEME.primary }} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: THEME.text, fontSize: isInline ? 15 : 16, fontWeight: '600' }}>{opt.label}</Text>
                                <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>{opt.desc}</Text>
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </>
    );

    if (isInline) {
        return <View style={{ padding: 16 }}>{renderContent()}</View>;
    }

    return (
        <View style={{ flex: 1, backgroundColor: THEME.background }}>
            <ScrollView contentContainerStyle={{ padding: 40, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                {renderContent()}
            </ScrollView>
        </View>
    );
};
