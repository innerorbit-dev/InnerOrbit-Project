/** Purpose: Animated floating action button menu for switching between decoy games. */
import React, { useRef, useEffect } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { isWeb, select } from "../../utils/platform";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";
import { Logger } from "../../lib/logger";
import { BlurView } from "expo-blur";

// ===== ANIMATED FAB MENU COMPONENT =====
export default function FabMenuOptions({ switchGame, setIsFabOpen, isDark, THEME, currentGame }) {
  // Animation Values
  // Match item count (5) to prevent "getValue of undefined" crash
  const fades = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const scales = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  const slides = [useRef(new Animated.Value(20)).current, useRef(new Animated.Value(20)).current, useRef(new Animated.Value(20)).current, useRef(new Animated.Value(20)).current, useRef(new Animated.Value(20)).current];

  useEffect(() => {
    const config = { friction: 7, tension: 80, useNativeDriver: !isWeb };
    const animations = fades.map((fade, i) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 150, delay: i * 40, useNativeDriver: !isWeb }),
        Animated.spring(scales[i], { toValue: 1, ...config, delay: i * 40 }),
        Animated.spring(slides[i], { toValue: 0, ...config, delay: i * 40 })
      ])
    );
    Animated.parallel(animations).start();
  }, []);

  const menuItems = [
    { id: 'guess-the-number', label: 'Guess Number', icon: 'help-circle-outline' },
    { id: 'ludo', label: 'Ludo Master', icon: 'dice-5' },
    { id: 'tic-tac-toe', label: 'Tic-Tac-Toe', icon: 'gamepad-variant' },
    { id: 'calculator', label: 'Calculator', icon: 'calculator' },
    { id: 'crash-test', label: 'Test Crash', icon: 'alert-octagon' }
  ];

  const getIconColor = (id) => {
    if (currentGame === id) return isDark ? "#F900BF" : "#E11D48";
    return isDark ? "#334155" : "#E2E8F0";
  };

  const getLabelBg = () => isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)';

  return (
    <View style={styles.menuContainer}>
      {menuItems.map((item, index) => (
        <Animated.View
          key={item.id}
          style={{
            opacity: fades[index],
            transform: [{ scale: scales[index] }, { translateY: slides[index] }]
          }}
        >
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              Logger.log(`[FabMenu] Item pressed: ${item.id}`);
              switchGame(item.id);
              setIsFabOpen(false);
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: getIconColor(item.id) }]}>
              <MaterialCommunityIcons name={item.icon} size={24} color="#FFF" />
            </View>
            <View style={[styles.labelContainer, { backgroundColor: getLabelBg() }]}>
              {!isWeb && <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
              <Text style={[styles.labelText, { color: THEME.textMain }]}>{item.label}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    paddingLeft: 4,
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 55,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  labelContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
    ...select({
      android: { elevation: 55 },
      web: { zIndex: 55 },
      default: { zIndex: 55 }
    }), // Ensure above keypad
  },
  labelText: {
    fontWeight: 'bold',
    fontSize: 13,
  }
});
