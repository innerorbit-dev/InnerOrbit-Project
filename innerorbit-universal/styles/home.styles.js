import { StyleSheet, Platform } from 'react-native';

export const getHomeStyles = (THEME) => StyleSheet.create({
    navRail: {
        width: 96,
        alignItems: 'center',
        paddingTop: 30,
        borderRightWidth: 1,
        borderColor: THEME.border || 'rgba(128,128,128,0.1)',
        zIndex: 10,
        paddingBottom: 20,
    },
    navItem: {
        width: 80, // Wider hit area
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    navItemActive: {
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
    },
    navBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: THEME.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: THEME.background,
    },
    navBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#FFF',
    },
    header: {
        paddingTop: 50, // Restored original baseline
        paddingHorizontal: 16,
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: 0.5,
        color: THEME.text,
    },
    myIdPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(128,128,128,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44, // Standard height
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: THEME.surfaceAlt || 'rgba(128,128,128,0.05)',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
        color: THEME.text,
    },
    itemContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        backgroundColor: THEME.primary,
    },
    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128,128,128,0.1)',
        paddingBottom: 12,
        paddingTop: 4, // Restored baseline
    },
    rowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4, // Restored baseline
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.text,
        // Noto Sans fallback ensures non-Latin names (Tamil, Hindi, Arabic, etc.) render on web
        fontFamily: '"Noto Sans", system-ui, sans-serif',
    },
    timeText: {
        fontSize: 12,
        color: THEME.textSecondary || '#94a3b8',
    },
    rowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    messageText: {
        fontSize: 14,
        flex: 1,
        marginRight: 10,
        color: THEME.textSecondary || '#94a3b8',
    },
    unreadBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: THEME.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFF',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(128,128,128,0.1)',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: THEME.text,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
        color: THEME.textSecondary || '#94a3b8',
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 24,
        backgroundColor: THEME.primary,
    },
    emptyButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: THEME.primary,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4.65,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.4)',
                cursor: 'pointer'
            }
        })
    },
    // Missing Layout Styles Restored
    mainContainer: {
        flex: 1,
        flexDirection: "row",
        backgroundColor: THEME?.background || '#000000',
    },
    sidebar: {
        width: 300,
        backgroundColor: THEME?.background || '#000000',
        borderRightWidth: 1,
        borderRightColor: THEME?.border || 'rgba(128,128,128,0.1)',
    },
    contentArea: {
        flex: 1,
        height: '100%',
        overflow: 'hidden',
    },
    mobileSettingsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: THEME.border || 'rgba(128,128,128,0.1)',
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});

export default getHomeStyles;
