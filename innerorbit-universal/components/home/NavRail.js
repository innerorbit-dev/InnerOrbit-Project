import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { isIOS } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { getHomeStyles } from "../../styles/home.styles";

export const NavRail = ({
  THEME,
  isSidebarOpen,
  toggleSidebar,
  activeTab,
  setActiveTab,
  setDesktopDetailView,
  screenshotsBlocked,
  setScreenshotsBlocked,
  showError
}) => {
  const styles = getHomeStyles(THEME);
  const NavItem = ({ icon, label, isActive, onPress, showBadge, badgeCount, rotateIcon }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        { backgroundColor: isActive ? (THEME.primary + '10') : 'transparent' },
        { opacity: pressed ? 0.7 : 1, height: 72 }
      ]}
    >
      <View style={rotateIcon ? { transform: [{ rotate: '90deg' }] } : {}}>
        <Feather
          name={icon}
          size={28}
          color={isActive ? THEME.primary : THEME.textSecondary}
        />
      </View>
      <Text style={{
        color: isActive ? THEME.primary : THEME.textSecondary,
        fontSize: 12,
        fontWeight: isActive ? '700' : '600',
        marginTop: 6
      }}>
        {label}
      </Text>

      {showBadge && (
        <View style={[styles.navBadge, { borderColor: THEME.background }]}>
          <Text style={styles.navBadgeText}>{badgeCount}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.navRail, { backgroundColor: THEME.navRail, borderRightColor: THEME.separator }]}>
      {/* Menu / Hamburger - Top Item */}
      <View style={{ gap: 16 }}>
        <NavItem
          icon="menu"
          label="Menu"
          isActive={isSidebarOpen}
          onPress={toggleSidebar}
        />

        <NavItem
          icon="message-circle"
          label="Chats"
          isActive={activeTab === 'chats'}
          onPress={() => {
            if (activeTab === 'chats' && isSidebarOpen) {
              toggleSidebar();
            } else {
              if (!isSidebarOpen) toggleSidebar();
              setActiveTab('chats');
              setDesktopDetailView(null);
            }
          }}
        />

        <NavItem
          icon="phone"
          label="Calls"
          isActive={activeTab === 'calls'}
          onPress={() => {
            if (activeTab === 'calls' && isSidebarOpen) {
              toggleSidebar();
            } else {
              if (!isSidebarOpen) toggleSidebar();
              setActiveTab('calls');
              setDesktopDetailView(null);
            }
          }}
        />

        <NavItem
          icon="layers"
          label="Stories"
          isActive={activeTab === 'stories'}
          onPress={() => {
            if (activeTab === 'stories' && isSidebarOpen) {
              toggleSidebar();
            } else {
              if (!isSidebarOpen) toggleSidebar();
              setActiveTab('stories');
              setDesktopDetailView(null);
            }
          }}
          rotateIcon={true}
        />
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Screen Guard Feature */}
      <View style={{ alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: THEME.separator, width: '100%', gap: 4 }}>
        <Feather name="shield" size={18} color={THEME.info} />
        <Text style={{ color: THEME.info, fontSize: 9, fontWeight: '600', textAlign: 'center', marginBottom: 2 }}>
          Screen Guard
        </Text>
        <Switch
          value={screenshotsBlocked}
          onValueChange={setScreenshotsBlocked}
          trackColor={{ false: THEME.separator, true: THEME.primary }}
          thumbColor={screenshotsBlocked ? THEME.surface : (isIOS ? '#fff' : '#f4f3f4')}
          style={{ transform: [{ scale: 0.6 }] }}
        />
      </View>

      {/* Settings at Bottom */}
      <NavItem
        icon="settings"
        label="Settings"
        isActive={activeTab === 'settings'}
        onPress={() => {
          if (activeTab === 'settings' && isSidebarOpen) {
            toggleSidebar();
          } else {
            if (!isSidebarOpen) toggleSidebar();
            setActiveTab('settings');
          }
        }}
      />
    </View>
  );
};
