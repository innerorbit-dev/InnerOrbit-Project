import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Animated, Easing, ScrollView, ActivityIndicator } from 'react-native';
import { isAndroid } from '../../utils/platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import { UpdateManager } from '../../lib/update-manager';
import { Logger } from '../../lib/logger';

const UpdateScreen = ({ visible, onClose }) => {
    const { theme: THEME, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [status, setStatus] = useState('idle'); // 'idle', 'checking', 'available', 'downloading', 'ready', 'installing'
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress] = useState(0);
    const [downloadPref, setDownloadPref] = useState('wifi_only');
    const [error, setError] = useState(null);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (UpdateManager?.getPreferences) {
            UpdateManager.getPreferences().then(prefs => {
                setDownloadPref(prefs.mobilePref || 'wifi');
            });
        }
    }, []);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress / 100,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.out(Easing.ease)
        }).start();
    }, [progress]);

    const handleCheck = async () => {
        setStatus('checking');
        setError(null);
        try {
            const info = await UpdateManager.checkForUpdate(true);
            if (info.isAvailable) {
                setUpdateInfo(info.manifest);
                setStatus('available');
            } else {
                setStatus('idle');
                setError("App is up to date");
            }
        } catch (e) {
            setStatus('idle');
            setError("Failed to check for updates");
        }
    };

    const handleDownload = async () => {
        if (!updateInfo) return;
        setStatus('downloading');
        setProgress(0);
        setError(null);

        try {
            if (updateInfo.isApk) {
                const uri = await UpdateManager.downloadApk(updateInfo.apkUrl, setProgress);
                setUpdateInfo(prev => ({ ...prev, localUri: uri }));
                setStatus('ready');
            } else {
                // OTA handling via useUpdates hook or direct
                await UpdateManager.fetchUpdate();
                setProgress(100);
                setStatus('ready');
            }
        } catch (e) {
            setStatus('available');
            setError(e.message || "Download failed");
        }
    };

    const handleInstall = async () => {
        if (updateInfo?.isApk) {
            if (!updateInfo.localUri) return;
            setStatus('installing');
            try {
                await UpdateManager.installApk(updateInfo.localUri);
            } catch (e) {
                setStatus('ready');
                setError("Installation failed");
            }
        } else {
            // OTA Reload
            await UpdateManager.reload();
        }
    };

    const updatePref = async (pref) => {
        setDownloadPref(pref);
        await UpdateManager.setPreferences(UpdateManager.CONSTANTS.KEY_MOBILE_PREF, pref);
    };

    if (!visible) return null; // Relaxed platform restriction to allow Universal visibility

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={[styles.container, { backgroundColor: THEME.background, paddingTop: insets.top }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: THEME.border, borderBottomWidth: 1 }]}>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <Feather name="chevron-down" size={28} color={THEME.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: THEME.text }]}>Update Center</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Status Icon Area */}
                    <View style={styles.heroArea}>
                        <View style={[styles.iconContainer, { backgroundColor: isDark ? `${THEME.primary}15` : `${THEME.primary}10` }]}>
                            {status === 'downloading' || status === 'installing' ? (
                                <ActivityIndicator size="large" color={THEME.primary} />
                            ) : (
                                <MaterialCommunityIcons
                                    name={status === 'ready' ? "package-variant-closed-check" : "cloud-download-outline"}
                                    size={48}
                                    color={THEME.primary}
                                />
                            )}
                        </View>
                        <Text style={[styles.title, { color: THEME.text }]}>
                            {status === 'idle' ? 'System Update' :
                                status === 'checking' ? 'Checking for updates...' :
                                    status === 'available' ? 'New Version Available' :
                                        status === 'downloading' ? 'Downloading Update' :
                                            status === 'ready' ? 'Ready to Install' : 'Installing...'}
                        </Text>
                        <Text style={[styles.versionText, { color: THEME.textSecondary }]}>
                            Current Version: {UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : "1.0.3"}
                            {updateInfo && `  →  Target: ${updateInfo.version}`}
                        </Text>
                    </View>

                    {/* Progress Area */}
                    {(status === 'downloading' || status === 'ready' || status === 'installing') && (
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                                <Animated.View style={[styles.progressBarFill, {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    }),
                                    backgroundColor: THEME.primary // Primary Color
                                }]} />
                            </View>
                            <View style={styles.progressLabelRow}>
                                <Text style={[styles.progressLabel, { color: THEME.textSecondary }]}>
                                    {status === 'downloading' ? `Downloading... ${progress}%` :
                                        status === 'ready' ? 'Download Complete' : 'Optimizing system...'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {error && (
                        <View style={styles.errorContainer}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#EF4444" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Network Configuration */}
                    <View style={[styles.section, { borderTopColor: THEME.border }]}>
                        <Text style={[styles.sectionTitle, { color: THEME.text }]}>Network Preferences</Text>
                        <View style={styles.prefGrid}>
                            {[
                                { id: 'all', label: 'Wi-Fi + Mobile Data', icon: 'wifi-star' },
                                { id: 'wifi', label: 'Wi-Fi Only', icon: 'wifi' },
                                { id: 'cellular', label: 'Mobile Data Only', icon: 'cellphone' }
                            ].map((item) => (
                                <Pressable
                                    key={item.id}
                                    style={[styles.prefItem,
                                    { backgroundColor: THEME.surface },
                                    downloadPref === item.id && { backgroundColor: `${THEME.primary}15` }
                                    ]}
                                    onPress={() => updatePref(item.id)}
                                >
                                    <View style={[styles.prefIcon, downloadPref === item.id ? { backgroundColor: THEME.primary } : { backgroundColor: THEME.border }]}>
                                        <MaterialCommunityIcons
                                            name={item.icon}
                                            size={20}
                                            color={downloadPref === item.id ? '#FFF' : THEME.textSecondary}
                                        />
                                    </View>
                                    <Text style={[styles.prefLabel, { color: downloadPref === item.id ? THEME.text : THEME.textSecondary }]}>
                                        {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={[styles.note, { color: THEME.textSecondary }]}>
                            <Feather name="info" size={12} /> Carrier charges may apply when using mobile data.
                        </Text>
                    </View>

                    {/* Changelog */}
                    {updateInfo?.changelog && (
                        <View style={[styles.section, { borderTopColor: THEME.border }]}>
                            <Text style={[styles.sectionTitle, { color: THEME.text }]}>What's New in {updateInfo.version}</Text>
                            {updateInfo.changelog.map((item, idx) => (
                                <View key={idx} style={styles.changelogItem}>
                                    <View style={[styles.bullet, { backgroundColor: THEME.primary }]} />
                                    <Text style={[styles.changelogText, { color: THEME.textSecondary }]}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Footer Action */}
                <View style={[
                    styles.footer,
                    {
                        borderTopColor: THEME.border,
                        paddingBottom: Math.max(insets.bottom, 24) + 8
                    }
                ]}>
                    <Pressable
                        style={[styles.mainBtn, {
                            backgroundColor: THEME.primary,
                            opacity: (status === 'checking' || status === 'downloading' || status === 'installing') ? 0.6 : 1
                        }]}
                        disabled={status === 'checking' || status === 'downloading' || status === 'installing'}
                        onPress={() => {
                            if (status === 'idle' || status === 'checking') handleCheck();
                            else if (status === 'available') handleDownload();
                            else if (status === 'ready') handleInstall();
                        }}
                    >
                        <Text style={styles.mainBtnText}>
                            {status === 'idle' || status === 'checking' ? 'Check for Updates' :
                                status === 'available' ? 'Download and Install' :
                                    status === 'downloading' ? `Downloading (${progress}%)` :
                                        status === 'ready' ? 'Install Now' : 'Installing...'}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 64,
        marginTop: isAndroid ? 24 : 0
    },
    headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Outfit_700Bold' },
    closeBtn: { padding: 8 },
    content: { padding: 24 },
    heroArea: { alignItems: 'center', marginBottom: 40 },
    iconContainer: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center', marginBottom: 20
    },
    title: { fontSize: 24, fontWeight: '800', fontFamily: 'Outfit_700Bold', marginBottom: 8, textAlign: 'center' },
    versionText: { fontSize: 14, opacity: 0.8 },
    progressContainer: { marginBottom: 32 },
    progressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden' },
    progressBarFill: { height: '100%' },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
    progressLabel: { fontSize: 14, fontWeight: '600' },
    errorContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12, borderRadius: 12, marginBottom: 24
    },
    errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
    section: { paddingVertical: 24, borderTopWidth: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
    prefGrid: { gap: 10, marginBottom: 12 },
    prefItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 12, borderRadius: 16
    },
    prefItemActive: { borderColor: '#fb7185', backgroundColor: 'rgba(251, 113, 133, 0.1)' },
    prefIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
        backgroundColor: 'rgba(0,0,0,0.05)'
    },
    prefLabel: { fontSize: 14, fontWeight: '600' },
    note: { fontSize: 12, opacity: 0.7, paddingLeft: 4 },
    changelogItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 4 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
    changelogText: { fontSize: 14, lineHeight: 20 },
    footer: { padding: 24, paddingBottom: 32, borderTopWidth: 1 },
    mainBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});

export default UpdateScreen;
