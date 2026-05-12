/** Purpose: Universal header providing branding, navigation, and global actions. */
import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import { isIOS, isWeb, Platform } from "../../utils/platform";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOGO_IMG = require("../../assets/InnerOrbit-Logo.png");


/**
 * GlobalHeader Component
 * Provides a consistent branding and navigation bar across screens.
 * 
 * @param {Object} props
 * @param {boolean} props.isDesktop - Whether the app is in desktop view
 * @param {Array} props.taglines - Array of taglines for desktop
 * @param {number} props.currentTaglineIndex - Current index for tagline rotation
 * @param {Object} props.updates - Update state object (optional)
 * @param {Function} props.handleScanQRCode - Handler for scanning QR code (mobile)
 * @param {Function} props.setShowSecurityModal - Handler to show security modal (mobile)
 * @param {Function} props.handleLogout - Handler for logout (mobile)
 * @param {Function} props.onLogoPress - Handler for logo press
 */
export const GlobalHeader = ({
    isDesktop,
    taglines = [],
    currentTaglineIndex = 0,
    updates = {},
    handleScanQRCode,
    setShowSecurityModal,
    handleLogout,
    onLogoPress,
    notificationCount = 0,
    onNotificationsPress
}) => {
    const { theme: THEME } = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 0,
            paddingTop: isDesktop ? 4 : Math.max(insets.top, 20) - 2,
            backgroundColor: THEME.surface,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderTopColor: THEME.separator,
            borderBottomColor: THEME.separator,
            width: '100%',
            zIndex: 2000
        }}>
            {/* Left: InnerOrbit Logo/Text */}
            <Pressable
                onPress={() => {
                    if (onLogoPress) {
                        onLogoPress();
                    } else if (isWeb) {
                        window.location.reload();
                    }
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
            >
                <Image source={LOGO_IMG} style={{ width: 24, height: 24, marginRight: 8 }} resizeMode="contain" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.primary, letterSpacing: 0.5 }}>InnerOrbit</Text>
            </Pressable>

            {/* Center: Tagline (Desktop Only) */}
            {isDesktop && taglines.length > 0 && (
                <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 20 }}>
                    <Text style={{
                        color: THEME.textSecondary,
                        fontSize: 15,
                        fontFamily: isIOS ? 'Courier' : 'monospace',
                        letterSpacing: 1.2,
                        textAlign: 'center',
                        opacity: 0.6
                    }}>
                        {taglines[currentTaglineIndex]}
                    </Text>
                </View>
            )}

            {/* Right: Actions */}
            <View style={{ minWidth: 100, alignItems: 'flex-end', justifyContent: 'center' }}>
                {isDesktop ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable
                            onPress={() => onNotificationsPress?.()}
                            style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: pressed ? THEME.actionBackground : 'transparent',
                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                                marginRight: 8
                            })}
                        >
                            <Feather name="bell" size={14} color={notificationCount > 0 ? THEME.info : THEME.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={{ color: notificationCount > 0 ? THEME.info : THEME.textSecondary, fontSize: 13, fontWeight: '600' }}>Notification Center</Text>
                            {notificationCount > 0 && (
                                <View style={{
                                    marginLeft: 6,
                                    backgroundColor: THEME.error,
                                    minWidth: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    paddingHorizontal: 4
                                }}>
                                    <Text style={{ color: THEME.surface, fontSize: 10, fontWeight: '900' }}>{notificationCount}</Text>
                                </View>
                            )}
                        </Pressable>

                        {setShowSecurityModal && (
                            <Pressable
                                onPress={() => setShowSecurityModal(true)}
                                style={({ pressed }) => ({
                                    flexDirection: 'row', alignItems: 'center',
                                    backgroundColor: pressed ? `${THEME.info}10` : 'transparent',
                                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                                    marginRight: 8, borderWidth: 1, borderColor: `${THEME.info}30`
                                })}
                            >
                                <Feather name="lock" size={14} color={THEME.info} style={{ marginRight: 6 }} />
                                <Text style={{ color: THEME.info, fontSize: 13, fontWeight: '600' }}>Lock</Text>
                            </Pressable>
                        )}

                        {handleLogout && (
                            <Pressable
                                onPress={handleLogout}
                                style={({ pressed }) => ({
                                    flexDirection: 'row', alignItems: 'center',
                                    backgroundColor: pressed ? `${THEME.error}10` : 'transparent',
                                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                                    marginRight: 8, borderWidth: 1, borderColor: `${THEME.error}30`
                                })}
                            >
                                <Feather name="log-out" size={14} color={THEME.error} style={{ marginRight: 6 }} />
                                <Text style={{ color: THEME.error, fontSize: 13, fontWeight: '600' }}>Logout</Text>
                            </Pressable>
                        )}

                        <Pressable
                            onPress={() => updates.setActiveSettingsSubPage?.('updates')}
                            style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: updates.updateAvailable ? 'rgba(251, 113, 133, 0.1)' : 'transparent',
                                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                                opacity: pressed ? 0.7 : 1
                            })}
                        >
                            <View style={{
                                width: 6, height: 6, borderRadius: 3,
                                backgroundColor: updates.updateAvailable ? THEME.primary : THEME.primary + '40',
                                marginRight: 6
                            }} />
                            <Text style={{ color: updates.updateAvailable ? THEME.primary : THEME.textSecondary, fontSize: 11, fontWeight: '600' }}>
                                v1.0.0
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Notification Center Bell */}
                        <Pressable
                            onPress={() => onNotificationsPress?.()}
                            style={({ pressed }) => ({ padding: 8, marginRight: 4, opacity: pressed ? 0.7 : 1, position: 'relative' })}
                        >
                            <Feather name="bell" size={20} color={notificationCount > 0 ? THEME.info : THEME.textSecondary} />
                            {notificationCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    backgroundColor: THEME.error,
                                    minWidth: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: THEME.surface,
                                    zIndex: 1
                                }}>
                                    <Text
                                        allowFontScaling={false}
                                        style={{
                                            color: THEME.surface,
                                            fontSize: 10,
                                            fontWeight: '900',
                                            textAlign: 'center',
                                            includeFontPadding: false,
                                            // Centering nudge for larger font
                                            marginTop: -1
                                        }}
                                    >
                                        {notificationCount}
                                    </Text>
                                </View>
                            )}
                        </Pressable>

                        {/* QR Code Icon - STRICTLY NO WEB */}
                        {handleScanQRCode && !isWeb && (
                            <Pressable
                                onPress={handleScanQRCode}
                                style={({ pressed }) => ({ padding: 8, marginRight: 4, opacity: pressed ? 0.7 : 1 })}
                            >
                                <MaterialCommunityIcons name="qrcode-scan" size={20} color={THEME.primary} />
                            </Pressable>
                        )}
                        {/* Lock Icon */}
                        {setShowSecurityModal && (
                            <Pressable
                                onPress={() => setShowSecurityModal(true)}
                                style={({ pressed }) => ({ padding: 8, marginRight: 4, opacity: pressed ? 0.7 : 1 })}
                            >
                                <Feather name="lock" size={20} color={THEME.info} />
                            </Pressable>
                        )}
                        {/* Logout Icon */}
                        {handleLogout && (
                            <Pressable
                                onPress={handleLogout}
                                style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.7 : 1 })}
                            >
                                <Feather name="log-out" size={20} color={THEME.error} />
                            </Pressable>
                        )}
                    </View>
                )}
            </View>
        </View >
    );
};
