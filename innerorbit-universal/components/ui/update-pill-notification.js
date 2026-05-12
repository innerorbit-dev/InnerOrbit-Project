/** Purpose: Pill-style notification for OTA updates and patch management. */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { isWeb, select } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { UpdateManager } from '../../lib/update-manager';
import { Logger } from '../../lib/logger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../store/themeStore';

export function UpdatePillNotification({ isDecoyMode }) {
    const { theme: THEME, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [manifest, setManifest] = useState(null);
    const [visible, setVisible] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDownloaded, setIsDownloaded] = useState(false);

    // Initial position depends on current device type
    // If mobile: starts at -200 (above screen)
    // If desktop: starts at 200 (below screen)
    const translateY = useSharedValue(isDesktop ? 200 : -200);
    const opacity = useSharedValue(0);

    const hide = useCallback((immediate = false) => {
        const targetY = isDesktop ? 200 : -200;
        translateY.value = withTiming(targetY, { duration: immediate ? 0 : 500 });
        opacity.value = withTiming(0, { duration: immediate ? 0 : 500 }, (finished) => {
            if (finished) runOnJS(setVisible)(false);
        });
    }, [isDesktop]);

    const show = useCallback((updateManifest) => {
        setManifest(updateManifest);
        setVisible(true);
        // Correct starting point if user resized since mount
        translateY.value = isDesktop ? 200 : -200;
        translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
        opacity.value = withTiming(1, { duration: 300 });
    }, [isDesktop]);

    const handleClose = () => {
        hide();
    };

    const handleLater = () => {
        hide();
    };

    const handleInstall = async () => {
        if (!manifest) return;

        try {
            if (isWeb && window.electron) {
                if (isDownloaded) {
                    await window.electron.invoke('quit-and-install');
                } else {
                    setIsDownloading(true);
                    await window.electron.invoke('start-update-download');
                }
                return;
            }

            if (manifest.isApk) {
                setIsDownloading(true);
                setProgress(0);
                const uri = await UpdateManager.downloadApk(manifest.url, (p) => setProgress(p));
                
                // Final verification before install
                const isValid = await UpdateManager.verifyApk(uri, manifest.sha256);
                if (!isValid) {
                    throw new Error("APK Checksum Verification Failed. The file might be corrupted.");
                }

                await UpdateManager.installApk(uri);
            } else {
                await UpdateManager.fetchUpdate();
                UpdateManager.reload();
            }
        } catch (e) {
            Logger.error("[UpdatePill] Update failed:", e.message);
            setIsDownloading(false);
            // Trigger diagnostic screen for technical failures
            if (global.__triggerErrorBoundary) {
                global.__triggerErrorBoundary(new Error(`Update System Error: ${e.message}`));
            }
            alert(`Update Error: ${e.message}`);
        } finally {
            // For mobile non-APK (OTA), we reload anyway, so state doesn't matter
            // For APK, if it reaches here it means it failed or intent was launched
            if (manifest.isApk) setIsDownloading(false);
        }
    };

    useEffect(() => {
        // Desktop IPC Listeners
        if (isWeb && window.electron) {
            const unsubAvailable = window.electron.on('update-available', (info) => {
                show({ ...info, isDesktop: true });
            });
            const unsubProgress = window.electron.on('update-download-progress', (p) => {
                setProgress(p);
            });
            const unsubDownloaded = window.electron.on('update-downloaded', () => {
                setIsDownloading(false);
                setIsDownloaded(true);
                setProgress(100);
            });
            const unsubError = window.electron.on('update-error', (err) => {
                Logger.error("[UpdatePill] Desktop update error:", err);
                setIsDownloading(false);
            });

            return () => {
                unsubAvailable();
                unsubProgress();
                unsubDownloaded();
                unsubError();
            };
        }
    }, [isWeb, show]);

    useEffect(() => {
        const check = async () => {
            try {
                const update = await UpdateManager.checkForUpdate();
                if (update.isAvailable) {
                    show(update.manifest);
                }
            } catch (e) {
                Logger.log("[UpdatePill] Silent check failed (expected if offline)");
            }
        };

        // Check on mount and then every 30 mins
        check();
        const interval = setInterval(check, 1800000);
        return () => clearInterval(interval);
    }, [show]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value
    }));

    if (!visible || isDecoyMode) return null; // Restored privacy guard for Calculator mode

    const currentVersion = UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : '1.0.2';
    const isMajorUpdate = (() => {
        if (!manifest?.version || !currentVersion) return false;
        const currentMajor = currentVersion.split('.')[0];
        const newMajor = manifest.version.split('.')[0];
        return currentMajor !== newMajor;
    })();

    const updateTitle = isMajorUpdate ? "Version Update" : "Patch Available";

    return (
        <Animated.View style={[
            styles.container,
            isDesktop ? styles.desktopPos : { top: insets.top + 40 },
            animatedStyle
        ]}>
            <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={[
                    styles.pill,
                    isDesktop && { maxWidth: 350 },
                    isWeb && {
                        backdropFilter: 'blur(20px)',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'
                    }
                ]}
            >
                <View style={styles.content}>
                    <View style={styles.infoRow}>
                        <View style={[styles.iconCircle, { backgroundColor: `${THEME.primary}20` }]}>
                            <Feather name="download" size={16} color={THEME.primary} />
                        </View>
                        <View style={styles.textColumn}>
                            <Text style={[styles.title, { color: THEME.text }]}>{updateTitle}</Text>
                            <Text style={[styles.subtitle, { color: THEME.textSecondary }]}>
                                {isDownloaded ? "Update downloaded. Restart now?" : 
                                 isDownloading ? `Downloading... ${progress}%` : 
                                 `Version ${manifest?.version || ''} is ready`}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            onPress={handleLater}
                            style={[styles.button, styles.laterBtn]}
                            disabled={isDownloading}
                        >
                            <Text style={[styles.laterText, { color: THEME.textSecondary }]}>Later</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleInstall}
                            style={[styles.button, styles.installBtn, { backgroundColor: THEME.primary }]}
                            disabled={isDownloading}
                        >
                            <Text style={styles.installText}>
                                {isDownloaded ? 'Restart & Install' : isDownloading ? 'Installing...' : 'Install Now'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 20000,
    },
    desktopPos: {
        bottom: 30,
        right: 30,
        left: undefined,
        alignItems: 'flex-end',
    },
    pill: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)', // Brighter border for glass edge
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent for blur visibility
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: { elevation: 10 },
            web: { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)' },
        }),
    },
    content: {
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(233, 30, 99, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textColumn: {
        flex: 1,
    },
    title: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 1,
    },
    closeBtn: {
        padding: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    laterBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    installBtn: {
        backgroundColor: '#E91E63',
    },
    laterText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    installText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    }
});
