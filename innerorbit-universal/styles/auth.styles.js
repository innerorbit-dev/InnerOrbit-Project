import { StyleSheet } from 'react-native';
import { select, isWeb } from "../utils/platform";

// 1. Consolidated Color Profiles
export const MOBILE_COLORS = {
    background: "#0F172A",
    surface: "rgba(255, 255, 255, 0.08)",
    primary: "#fb7185",
    primaryGlow: "rgba(251, 113, 133, 0.4)",
    secondary: "#c084fc",
    accent: "#f472b6",
    text: "#F1F5F9",
    textSecondary: "#cbd5e1",
    border: "rgba(255,255,255,0.15)",
    borderFocus: "#fb7185",
    danger: "#EF4444",
    success: "#34D399",
    cardBg: "rgba(15, 23, 42, 0.5)", // Darker translucent for OLED feel
};

export const WEB_COLORS = {
    background: "#030712",
    surface: "rgba(255, 255, 255, 0.05)",
    primary: "#fb7185",
    primaryGlow: "rgba(251, 113, 133, 0.2)",
    secondary: "#c084fc",
    accent: "#f472b6",
    text: "#F1F5F9",
    textSecondary: "#8492a6",
    border: "rgba(255,255,255,0.12)",
    borderFocus: "#fb7185",
    danger: "#EF4444",
    success: "#34D399",
    cardBg: "rgba(255, 255, 255, 0.04)", // Very translucent for glass effect
};

export const DESKTOP_COLORS = {
    background: "#030712",
    surface: "rgba(255, 255, 255, 0.04)",
    primary: "#fb7185",
    primaryGlow: "rgba(251, 113, 133, 0.15)",
    secondary: "#c084fc",
    accent: "#f472b6",
    text: "#F1F5F9",
    textSecondary: "#64748b",
    border: "rgba(255,255,255,0.08)",
    borderFocus: "#fb7185",
    danger: "#EF4444",
    success: "#34D399",
    cardBg: "rgba(255, 255, 255, 0.03)",
};

export const SOFT_LIGHT_COLORS = {
    background: "#F8FAFC",
    surface: "rgba(255, 255, 255, 0.25)", // More translucent white
    primary: "#fb7185",
    primaryGlow: "rgba(251, 113, 133, 0.2)",
    secondary: "#c084fc",
    accent: "#f472b6",
    text: "#0F172A",
    textSecondary: "#475569",
    border: "rgba(0,0,0,0.08)",
    borderFocus: "#fb7185",
    danger: "#EF4444",
    success: "#10B981",
    cardBg: "rgba(255, 255, 255, 0.15)", // Significantly more translucent for light mode glass
};

// 2. Safe Theme Getter
// [NOTE] Strict Visual preservation: Signup uses #000000 while others use #0F172A
export const getAuthTheme = (mode = 'default', isDark = true) => {
    if (!isDark) return SOFT_LIGHT_COLORS;
    const isElectron = isWeb &&
        typeof navigator !== 'undefined' &&
        navigator.userAgent.toLowerCase().includes('electron');

    let theme = !isWeb ? MOBILE_COLORS : (isElectron ? DESKTOP_COLORS : WEB_COLORS);

    // Explicitly preserve the pure black background for signup if on mobile/standard
    if (mode === 'signup' && theme.background === "#0F172A") {
        return { ...theme, background: "#000000" };
    }

    return theme;
};

// 3. Dynamic Style Getter
export const getAuthStyles = (THEME, insets) => StyleSheet.create({
    container: {
        flex: 1,
    },
    errorBanner: {
        position: 'absolute',
        top: isWeb ? 20 : (insets.top + 10),
        left: 20,
        right: 20,
        backgroundColor: '#EF4444',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1000,
        ...select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
            web: {
                boxShadow: '0px 4px 10px rgba(0,0,0,0.3)',
            }
        })
    },
    errorText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        flex: 1,
        marginLeft: 12,
    },
    form: {
        gap: 12,
    },
    inputCard: {
        backgroundColor: THEME.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 54,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: THEME.text,
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 14,
        marginTop: 4,
    },
    forgotPasswordText: {
        color: THEME.primary,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    submitButton: {
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    submitButtonText: {
        fontSize: 16,
        fontFamily: 'Outfit_700Bold',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    footerText: {
        color: THEME.textSecondary,
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
    },
    logoBadge: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 32,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    spinner: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: THEME.background,
        borderTopColor: 'transparent',
        borderRadius: 10,
        marginRight: 12,
    },
    footerLink: {
        color: THEME.primary,
        fontSize: 15,
        fontFamily: 'Outfit_700Bold',
    },
    checkboxWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    checkboxCustom: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    checkboxLabel: {
        fontSize: 14,
        color: THEME.textSecondary,
        fontFamily: 'Inter_500Medium',
    }
});
