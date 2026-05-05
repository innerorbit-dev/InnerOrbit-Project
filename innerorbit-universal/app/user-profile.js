/** Purpose: Public profile view for users, including ID, bio, and screenshot protection. */
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { isWeb, select } from '../utils/platform';
import { useAppTheme } from '../store/themeStore';
import { GlobalHeader } from '../components/ui/GlobalHeader';
import { ScreenContainer } from '../components/screen-container';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserProfileScreen() {
    const router = useRouter();
    const { theme: THEME } = useAppTheme();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    // Get params
    const params = useLocalSearchParams();
    const { userId, name, photoURL, nickname, bio } = params;

    const isDesktop = width > 768;

    // Screenshot Protection (native only — not supported on web)
    React.useEffect(() => {
        if (isWeb) return;

        ScreenCapture.preventScreenCaptureAsync();
        // Listener to alert on screenshot attempt (iOS/some androids)
        const subscription = ScreenCapture.addScreenshotListener(() => {
            alert("Screenshots are disabled for privacy.");
        });

        return () => {
            ScreenCapture.allowScreenCaptureAsync();
            subscription.remove();
        };
    }, []);

    return (
        <ScreenContainer background={THEME.background}>
            {/* Global Header */}
            <View style={{ zIndex: 100 }}>
                <GlobalHeader
                    isDesktop={isDesktop}
                    onLogoPress={() => router.replace('/home')}
                    handleLogout={() => router.replace('/')} // Minimal implementation
                />
            </View>

            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingBottom: insets.bottom + 20 }}>
                <View style={[styles.mainContainer, { maxWidth: isDesktop ? 600 : '100%', marginTop: 20 }]}>

                    {/* Back Button */}
                    <View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 10 }}>
                        <Pressable
                            onPress={() => router.back()}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8, alignSelf: 'flex-start' }}
                        >
                            <Feather name="arrow-left" size={24} color={THEME.primary} style={{ marginRight: 8 }} />
                            <Text style={{ color: THEME.primary, fontSize: 16, fontWeight: '600' }}>Back</Text>
                        </Pressable>
                    </View>

                    {/* Profile Card */}
                    <View style={[styles.detailsCard, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
                        {/* Header / Cover Area */}
                        <View style={{ height: 100, backgroundColor: THEME.primary + '20', width: '100%' }} />

                        <View style={{ alignItems: 'center', marginTop: -50 }}>
                            <View style={[styles.avatarContainer, { borderColor: THEME.background }]}>
                                <Image
                                    source={photoURL ? { uri: photoURL } : require('../assets/account.webp')}
                                    style={styles.avatarImage}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>

                        <View style={{ padding: 24, width: '100%' }}>
                            {/* 1. User ID Row */}
                            <View style={[styles.infoRow, { borderColor: THEME.border }]}>
                                <Feather name="hash" size={20} color={THEME.textSecondary} style={{ marginRight: 16 }} />
                                <View>
                                    <Text style={[styles.label, { color: THEME.textSecondary }]}>User ID</Text>
                                    <Text style={[styles.value, { color: THEME.text }]}>{userId || "N/A"}</Text>
                                </View>
                            </View>

                            {/* 2. Display Name Row */}
                            <View style={[styles.infoRow, { borderColor: THEME.border }]}>
                                <Feather name="user" size={20} color={THEME.textSecondary} style={{ marginRight: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: THEME.textSecondary }]}>Display Name</Text>
                                    <Text style={[styles.value, { color: THEME.text }]}>
                                        {nickname ? nickname : (name === userId ? "Unset" : name)}
                                    </Text>
                                </View>
                            </View>

                            {/* 3. Bio Row */}
                            <View style={[styles.infoRow, { borderColor: THEME.border }]}>
                                <Feather name="info" size={20} color={THEME.textSecondary} style={{ marginRight: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: THEME.textSecondary }]}>Bio</Text>
                                    <Text style={[styles.value, { color: THEME.text, fontWeight: '400', lineHeight: 22 }]}>
                                        {bio || "This user hasn't set a bio yet."}
                                    </Text>
                                </View>
                            </View>

                            {/* 4. Security Status Row */}
                            <View style={[styles.infoRow, { borderColor: THEME.border, borderBottomWidth: 0 }]}>
                                <Feather name="shield" size={20} color={THEME.textSecondary} style={{ marginRight: 16 }} />
                                <View>
                                    <Text style={[styles.label, { color: THEME.textSecondary }]}>Security Status</Text>
                                    <Text style={[styles.value, { color: THEME.text }]}>Verified</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        width: '100%',
        alignItems: 'center',
    },
    detailsCard: {
        width: '90%',
        borderRadius: 24,
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        overflow: 'hidden',
        marginBottom: 16,
        ...select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
            },
            android: {
                elevation: 5,
            },
            web: {
                boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
            }
        }),
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    userIdBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    userIdText: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
    }
});
