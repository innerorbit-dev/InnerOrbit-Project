/** Purpose: Global error handler and boundary for catching and reporting runtime exceptions. */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, LogBox, Animated, Easing, NativeModules, useWindowDimensions } from 'react-native';
import { select, isWeb, isIOS } from '../utils/platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Logger } from '../lib/logger';
import { getErrorData } from '../lib/error-codes';
import { useAppTheme } from '../store/themeStore';

// -----------------------------------------------------------------------------
// HELPER COMPONENTS (Defined before ErrorBoundary to avoid hoisting issues)
// -----------------------------------------------------------------------------

function AnimatedFixBox({ fix }) {
    const { theme } = useAppTheme();
    const travelAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let isMounted = true;
        const animation = Animated.loop(
            Animated.timing(travelAnim, {
                toValue: 4,
                duration: 8000,
                easing: Easing.linear,
                useNativeDriver: !isWeb
            })
        );

        try {
            if (isMounted) animation.start();
        } catch (e) {
            Logger.log(`Animation start suppressed: ${e.message}`);
        }

        return () => {
            isMounted = false;
            try {
                animation.stop();
                travelAnim.stopAnimation();
                travelAnim.removeAllListeners();
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, []);

    const [displayedText, setDisplayedText] = React.useState('');
    const fullText = fix || 'No specific fix available. Check logs.';

    useEffect(() => {
        setDisplayedText('');
        let index = 0;
        const typeInterval = setInterval(() => {
            index++;
            setDisplayedText(fullText.slice(0, index));
            if (index >= fullText.length) {
                clearInterval(typeInterval);
            }
        }, 30);
        return () => clearInterval(typeInterval);
    }, [fullText]);

    return (
        <View style={[styles.fixBoxWrapper, {
            ...select({
                ios: {
                    shadowColor: theme.primary,
                    shadowOpacity: 0.5,
                },
                android: {
                    elevation: 10,
                },
                web: {
                    boxShadow: `0 0 20px ${theme.primary}55`,
                }
            })
        }]}>
            <View style={StyleSheet.absoluteFill}>
                <Animated.View style={[styles.beamContainer, {
                    transform: [
                        { translateX: -250 },
                        { translateY: -250 },
                        {
                            rotate: travelAnim.interpolate({
                                inputRange: [0, 4],
                                outputRange: ['0deg', '360deg']
                            })
                        }
                    ]
                }]}>
                    <LinearGradient
                        colors={[
                            theme.primary, theme.primary,
                            '#3B82F6', '#3B82F6',
                            '#22C55E', '#22C55E',
                            theme.primary, theme.primary,
                            '#3B82F6', '#3B82F6',
                            '#22C55E', '#22C55E',
                            theme.primary
                        ]}
                        style={{ flex: 1, borderRadius: 250 }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>
            </View>

            <View style={[styles.fixBoxInner, { backgroundColor: theme.surface }]}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.12)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 0.6 }}
                />

                <Text style={[styles.fixLabel, { color: theme.primary }]}>SUGGESTED FIX:</Text>
                <Text style={[styles.fixText, { color: theme.text }]}>
                    {displayedText}
                    <Text style={{ color: theme.success }}>_</Text>
                </Text>
            </View>
        </View>
    );
}

const ThemedErrorBoundaryLayout = ({ error, errorInfo, errorData, onRestart }) => {
    const { theme, isDark } = useAppTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktop = width >= 768;
    const [copied, setCopied] = React.useState(false);
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: !isWeb
            })
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const handleCopy = async () => {
        try {
            const textToCopy = `Error: ${error}\n\nStack Trace:\n${errorInfo?.componentStack || 'N/A'}`;
            await Clipboard.setStringAsync(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            Logger.log('Failed to copy logs');
        }
    };

    return (
        <View style={[styles.container, {
            backgroundColor: theme.background,
            paddingTop: isWeb ? 40 : 60,
            paddingBottom: 0
        }]}>
            <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}>
                <View style={isDesktop ? styles.desktopMaxContent : { width: '100%' }}>
                    <View style={styles.header}>
                        <MaterialCommunityIcons name="alert-octagon" size={64} color={theme.error} style={{ marginBottom: 16 }} />
                        <Text style={[styles.title, { color: theme.text }]}>System Interruption</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                            The application encountered an unexpected crash.
                        </Text>
                    </View>

                    {/* Terminal Box */}
                    <View style={[styles.terminalBox, { backgroundColor: '#000', borderColor: theme.border }]}>
                        <View style={[styles.terminalHeader, { borderBottomColor: theme.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.terminalLabel}>DIAGNOSTICS</Text>
                                <Text style={[styles.terminalLabel, { opacity: 0.5 }]}>•</Text>
                                <Text style={[styles.terminalLabel, { opacity: 0.7 }]}>{new Date().toLocaleTimeString()}</Text>
                            </View>

                            <Pressable
                                onPress={handleCopy}
                                style={({ pressed }) => ({
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    opacity: pressed ? 0.7 : 1,
                                    backgroundColor: copied ? theme.success + '22' : 'rgba(255,255,255,0.1)',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                })}
                            >
                                <MaterialCommunityIcons
                                    name={copied ? "check" : "content-copy"}
                                    size={12}
                                    color={copied ? theme.success : '#AAA'}
                                />
                                <Text style={[styles.terminalLabel, {
                                    marginLeft: 6,
                                    color: copied ? theme.success : '#AAA',
                                    fontSize: 10,
                                    letterSpacing: 0.5
                                }]}>
                                    {copied ? 'COPIED' : 'COPY'}
                                </Text>
                            </Pressable>
                        </View>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                            <Text style={styles.terminalText}>
                                {error ? String(error) : "Unknown Error"}
                            </Text>
                            {errorInfo && (
                                <Text style={styles.stackTrace}>
                                    {errorInfo.componentStack}
                                </Text>
                            )}
                        </ScrollView>
                    </View>

                    <AnimatedFixBox fix={errorData?.fix} />
                </View>
            </ScrollView>

            <View style={[styles.footer, {
                backgroundColor: theme.background,
                borderTopColor: theme.border,
                paddingBottom: isWeb ? 40 : Math.max(insets.bottom + 12, 24)
            }]}>
                <View style={isDesktop ? styles.desktopMaxContent : { width: '100%' }}>
                    <Pressable
                        onPress={onRestart}
                        style={({ pressed }) => [
                            styles.buttonShadowWrapper,
                            {
                                transform: [{ scale: pressed ? 0.97 : 1 }],
                                ...select({
                                    ios: {
                                        shadowColor: isDark ? theme.success : '#000',
                                        shadowOpacity: isDark ? 0.3 : 0.12,
                                        shadowRadius: 10,
                                        shadowOffset: { width: 0, height: 4 }
                                    },
                                    android: { elevation: isDark ? 10 : 4 },
                                    web: {
                                        boxShadow: isDark
                                            ? `0 8px 25px ${theme.success}33`
                                            : `0 4px 15px rgba(0,0,0,0.08)`
                                    }
                                })
                            }
                        ]}
                    >
                        <View style={[
                            styles.modernButton,
                            {
                                borderColor: isDark ? theme.success + '88' : theme.success + '44',
                                backgroundColor: theme.surface,
                            }
                        ]}>
                            <LinearGradient
                                colors={isDark ? [theme.success + '33', theme.success + '11'] : [theme.success + '15', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradientBtn}
                            >
                                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                                    <MaterialCommunityIcons name="restart" size={24} color={theme.success} />
                                </Animated.View>
                                <Text style={[styles.buttonText, { color: theme.success }]}>
                                    RESTART APPLICATION NOW
                                </Text>
                            </LinearGradient>
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        Logger.log("[ErrorBoundary] Initialized");
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showManualButton: true,
            errorData: null
        };
    }

    static getDerivedStateFromError(error) {
        Logger.log(`[ErrorBoundary] getDerivedStateFromError: ${error.message}`);
        const errorData = getErrorData(error);
        return { hasError: true, error, errorData };
    }

    componentDidMount() {
        // Register a global bridge so that suppress-redbox.js can trigger the UI
        global.__triggerErrorBoundary = (error) => {
            if (!this.state.hasError) {
                Logger.log("[ErrorBoundary] Triggered via global bridge");
                const errorData = getErrorData(error);
                this.setState({ hasError: true, error, errorData });
            }
        };
    }

    componentWillUnmount() {
        global.__triggerErrorBoundary = null;
    }

    componentDidCatch(error, errorInfo) {
        Logger.log("[ErrorBoundary] componentDidCatch caught an error");
        Logger.error("Uncaught Error:", error, errorInfo);
        this.setState({ errorInfo });
        this.logError();
    }

    logError = async () => {
        try {
            const now = Date.now();
            await AsyncStorage.setItem('last_crash_ts', String(now));
        } catch (e) {
            // ignore
        }
    };

    handleRestart = async () => {
        try {
            Logger.log("[ErrorBoundary] Attempting Nuclear Restart...");

            // 1. Clear any crash-inducing persistent flags if possible
            try {
                await AsyncStorage.removeItem('last_calc_mode'); // Example: reset to basic if it was a mode crash
            } catch (e) { }

            // 2. Try Expo Updates Reload (Best for OTA/Production)
            if (Updates.reloadAsync) {
                await Updates.reloadAsync();
                return;
            }

            // 3. Fallback to Native DevSettings Reload (Best for Development)
            const { DevSettings } = NativeModules;
            if (DevSettings && DevSettings.reload) {
                DevSettings.reload();
            } else if (isWeb) {
                window.location.reload();
            } else {
                // Last resort: just clear state and hope for the best
                this.setState({ hasError: false, error: null, errorInfo: null });
            }
        } catch (e) {
            Logger.log('Reload failed: ' + e.message);
            // Emergency fallback
            if (isWeb) {
                window.location.reload();
            } else {
                this.setState({ hasError: false, error: null, errorInfo: null });
            }
        }
    };

    render() {
        if (this.state.hasError) {
            Logger.log("[ErrorBoundary] Attempting to render fallback UI...");
            try {
                return (
                    <ThemedErrorBoundaryLayout
                        error={this.state.error}
                        errorInfo={this.state.errorInfo}
                        errorData={this.state.errorData}
                        onRestart={this.handleRestart}
                    />
                );
            } catch (renderError) {
                Logger.log(`[ErrorBoundary] Falling back to Tank Mode UI: ${renderError.message}`);
                // Tank Mode Fallback: No providers, no complex hooks, just basic components
                return (
                    <View style={{ flex: 1, backgroundColor: '#000', padding: 40, justifyContent: 'center' }}>
                        <Text style={{ color: '#FF5555', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Critical System Error</Text>
                        <Text style={{ color: '#FFF', fontSize: 14, marginBottom: 40 }}>
                            The primary Error Boundary itself crashed. Tank Mode activated.
                        </Text>
                        <View style={{ backgroundColor: '#111', padding: 20, borderRadius: 10, marginBottom: 40 }}>
                            <Text style={{ color: '#FF5555', fontFamily: isIOS ? 'Courier' : 'monospace' }}>
                                {String(this.state.error)}
                            </Text>
                            <Text style={{ color: '#888', marginTop: 10 }}>{renderError.message}</Text>
                        </View>
                        <Pressable
                            onPress={this.handleRestart}
                            style={{ backgroundColor: '#EF4444', padding: 15, borderRadius: 10, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>RESTART SYSTEM</Text>
                        </Pressable>
                    </View>
                );
            }
        }

        return this.props.children;
    }
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    contentScroll: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 60,
    },
    fixBoxWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        padding: 1.5, // The border thickness
        marginBottom: 24,
    },
    fixBoxInner: {
        padding: 20,
        borderRadius: 18.5,
        overflow: 'hidden',
    },
    beamContainer: {
        position: 'absolute',
        width: 500,
        height: 500,
        top: '50%',
        left: '50%',
        opacity: 0.9,
    },
    fixLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 1.5,
    },
    fixText: {
        fontSize: 15,
        lineHeight: 22,
    },
    terminalBox: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 24,
    },
    terminalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        paddingBottom: 8,
    },
    terminalLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    terminalText: {
        color: '#FF5555',
        fontFamily: isIOS ? 'Courier' : 'monospace',
        fontSize: 14,
        marginBottom: 12,
        lineHeight: 22,
    },
    stackTrace: {
        color: '#64748B',
        fontFamily: isIOS ? 'Courier' : 'monospace',
        fontSize: 11,
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 24,
        paddingTop: 12,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    buttonText: {
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 2.5,
        textAlignVertical: 'center',
    },
    buttonShadowWrapper: {
        width: '100%',
        borderRadius: 20,
    },
    modernButton: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1.5,
    },
    gradientBtn: {
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    desktopScrollContent: {
        alignItems: 'center',
    },
    desktopMaxContent: {
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
    },
});
