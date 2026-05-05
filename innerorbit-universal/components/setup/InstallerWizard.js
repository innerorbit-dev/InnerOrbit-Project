import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable, Image, ActivityIndicator } from 'react-native';
import { isWeb, isIOS } from '../../utils/platform';
import { LinearGradient } from 'expo-linear-gradient';
import { Logger } from '../../lib/logger';

const THEME = {
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#F43F5E',
    primaryDark: '#BE123C',
    textMain: '#FFFFFF',
    textSecondary: '#94A3B8',
    accent: '#8B5CF6'
};

const STEPS = [
    { id: 'welcome', title: 'Welcome to InnerOrbit', subtitle: 'Secure Communication Platform' },
    { id: 'optimizing', title: 'Perfecting Your Experience', subtitle: 'Optimizing modules for Windows...' },
    { id: 'stealth', title: 'Activating Stealth Protocols', subtitle: 'Configuring secure vault gateways...' },
    { id: 'ready', title: 'Setup Complete', subtitle: 'Your secure environment is ready.' }
];

export default function InstallerWizard({ onComplete }) {
    const styles = React.useMemo(() => getInstallerStyles(), []);
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(new Animated.Value(0));
    const [fadeAnim] = useState(new Animated.Value(0));
    const [statusText, setStatusText] = useState('');

    useEffect(() => {
        // Fade in the whole wizard
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: !isWeb,
            easing: Easing.out(Easing.quad)
        }).start();

        // Start the automated installation sequence
        startInstallationSequence();
    }, []);

    const startInstallationSequence = async () => {
        // Welcome Phase
        setStatusText('Initializing Secure Environment...');
        await new Promise(r => setTimeout(r, 2000));

        // Optimizing Phase
        setCurrentStep(1);
        setStatusText('Loading premium modules...');
        animateProgress(30, 2500);
        await new Promise(r => setTimeout(r, 2500));

        // Stealth Phase
        setCurrentStep(2);
        setStatusText('Registering encryption keys...');
        animateProgress(70, 3000);
        await new Promise(r => setTimeout(r, 3000));

        // Ready Phase
        setCurrentStep(3);
        setStatusText('All systems nominal.');
        animateProgress(100, 1000);
    };

    const animateProgress = (toValue, duration) => {
        Animated.timing(progress, {
            toValue,
            duration,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.quad)
        }).start();
    };

    const handleFinish = () => {
        Logger.success('Installer Wizard complete.');
        onComplete();
    };

    const step = STEPS[currentStep];

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.gradient}
            />

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/InnerOrbit-Logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View style={styles.glow} />
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title}>{step.title}</Text>
                    <Text style={styles.subtitle}>{step.subtitle}</Text>
                </View>

                <View style={styles.progressArea}>
                    <View style={styles.progressBarBg}>
                        <Animated.View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: progress.interpolate({
                                        inputRange: [0, 100],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.status}>{statusText}</Text>
                </View>

                {currentStep === 3 ? (
                    <Pressable
                        style={({ pressed }) => [
                            styles.btn,
                            pressed && styles.btnPressed
                        ]}
                        onPress={handleFinish}
                    >
                        <Text style={styles.btnText}>Start InnerOrbit</Text>
                    </Pressable>
                ) : (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={THEME.primary} size="small" />
                        <Text style={styles.tip}>Please do not close this window</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Version 1.0.3 • Windows Dedicated Edition</Text>
            </View>
        </Animated.View>
    );
}

const getInstallerStyles = () => {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: THEME.background,
            alignItems: 'center',
            justifyContent: 'center',
        },
        gradient: {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
        },
        content: {
            width: '100%',
            maxWidth: 500,
            alignItems: 'center',
            padding: 40,
        },
        logoContainer: {
            marginBottom: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        logo: {
            width: 120,
            height: 120,
            zIndex: 2,
        },
        glow: {
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: THEME.primary,
            opacity: 0.1,
            filter: 'blur(30px)',
        },
        textContainer: {
            alignItems: 'center',
            marginBottom: 40,
        },
        title: {
            color: THEME.textMain,
            fontSize: 32,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 8,
        },
        subtitle: {
            color: THEME.textSecondary,
            fontSize: 16,
            textAlign: 'center',
        },
        progressArea: {
            width: '100%',
            marginBottom: 32,
        },
        progressBarBg: {
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 12,
        },
        progressBarFill: {
            height: '100%',
            backgroundColor: THEME.primary,
            borderRadius: 3,
        },
        status: {
            color: THEME.textSecondary,
            fontSize: 12,
            fontFamily: isIOS ? 'Menlo' : 'monospace',
            textAlign: 'center',
            opacity: 0.8,
        },
        loadingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        tip: {
            color: THEME.textSecondary,
            fontSize: 13,
            opacity: 0.6,
        },
        btn: {
            backgroundColor: THEME.primary,
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 100,
            elevation: 4,
            shadowColor: THEME.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
        },
        btnPressed: {
            transform: [{ scale: 0.98 }],
            backgroundColor: THEME.primaryDark,
        },
        btnText: {
            color: '#FFF',
            fontSize: 16,
            fontWeight: 'bold',
        },
        footer: {
            position: 'absolute',
            bottom: 24,
        },
        footerText: {
            color: THEME.textSecondary,
            fontSize: 11,
            opacity: 0.4,
            letterSpacing: 1,
            textTransform: 'uppercase',
        }
    });
};
