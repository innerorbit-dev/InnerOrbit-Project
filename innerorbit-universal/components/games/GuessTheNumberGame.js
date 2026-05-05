/** Purpose: Stealth game "Guess the Number" used as a cover activity. */
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, useWindowDimensions, Keyboard, TouchableWithoutFeedback, useColorScheme, Dimensions, Alert, ScrollView, Animated } from 'react-native';
import { select, isWeb, isIOS } from '../../utils/platform';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../store/themeStore';
import FabMenuOptions from '../ui/FabMenu';
import { Logger } from '../../lib/logger';

const { width, height } = Dimensions.get("window");

export default function GuessTheNumberGame() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = windowWidth > windowHeight;
  const isTablet = windowWidth > 768;

  // --- THEME LOGIC ---
  const { isDark, toggleTheme, decoyThemePreference: themePreference } = useAppTheme();
  const [savePreference, setSavePreference] = useState(false);

  // Platform Colors
  const MOBILE_DARK = {
    bg: "#020617",
    textMain: "#F8FAFC",
    textAlt: "#94A3B8",
    border: "rgba(255,255,255,0.1)",
    btnEqual: ["#06b6d4", "#0891b2"],
    inputBg: "rgba(30, 41, 59, 0.6)",
    success: "#34D399",
    error: "#F43F5E",
    warning: "#FBBF24",
  };

  const MOBILE_LIGHT = {
    bg: "#F8FAFC",
    textMain: "#0F172A",
    textAlt: "#475569",
    border: "rgba(0,0,0,0.1)",
    btnEqual: ["#06b6d4", "#0891b2"],
    inputBg: "#FFFFFF",
    success: "#059669",
    error: "#E11D48",
    warning: "#D97706",
  };

  const THEME = isDark ? MOBILE_DARK : MOBILE_LIGHT;

  // --- GAME STATE ---
  const [targetNumber, setTargetNumber] = useState(0);
  const [currentGuess, setCurrentGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState('Start guessing!');
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameRange, setGameRange] = useState(100); // 100 or 1000
  const [showSettings, setShowSettings] = useState(false);
  const [highScore, setHighScore] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Settings Animation
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  useEffect(() => {
    startNewGame();
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const storedSave = await AsyncStorage.getItem("savePreference");
      const save = storedSave === 'true';
      setSavePreference(save);

      if (save) {
        const hs = await AsyncStorage.getItem("guessHighScore");
        if (hs) setHighScore(parseInt(hs));
      }
    } catch (e) {
      Logger.log("Error loading state", e);
    }
  };

  const saveState = async () => {
    try {
      await AsyncStorage.setItem("savePreference", String(savePreference));
      if (savePreference && highScore !== null) {
        await AsyncStorage.setItem("guessHighScore", String(highScore));
      }
    } catch (e) {
      Logger.log("Error saving state", e);
    }
  };

  useEffect(() => {
    saveState();
  }, [savePreference, highScore]);

  const startNewGame = (range = gameRange) => {
    const max = range;
    const random = Math.floor(Math.random() * max) + 1;
    setTargetNumber(random);
    setAttempts(0);
    setHistory([]);
    setMessage('Start guessing!');
    setGameOver(false);
    setCurrentGuess('');
    setGameRange(range);
  };

  const handleGuess = () => {
    const guess = parseInt(currentGuess);
    if (isNaN(guess)) {
      Alert.alert("Invalid Input", "Please enter a valid number");
      return;
    }

    if (guess < 1 || guess > gameRange) {
      Alert.alert("Out of Range", `Please enter a number between 1 and ${gameRange}`);
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let result = '';
    let icon = '';

    if (guess === targetNumber) {
      result = 'Correct! You Won!';
      icon = 'check-circle';
      setGameOver(true);
      if (highScore === null || newAttempts < highScore) {
        setHighScore(newAttempts);
        if (savePreference) AsyncStorage.setItem("guessHighScore", String(newAttempts));
      }
    } else if (guess < targetNumber) {
      result = 'Too Low!';
      icon = 'arrow-up-circle';
    } else {
      result = 'Too High!';
      icon = 'arrow-down-circle';
    }

    setMessage(result);
    setHistory([{ guess, result, icon }, ...history]);
    setCurrentGuess('');
    Keyboard.dismiss();
  };

  const updateThemePreference = (pref) => toggleTheme(pref, 'decoy');

  const switchGame = (game) => {
    if (game === 'guess-the-number') {
      setIsFabOpen(false);
      return;
    }
    if (game === 'calculator') router.push("/CalcX");
    else router.push(`/game/${game}`);
    setIsFabOpen(false);
  };

  const flipToSettings = () => {
    setIsFlipped(true);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 1, friction: 8, tension: 10 }).start();
  };

  const flipToGame = () => {
    setIsFlipped(false);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 0, friction: 8, tension: 10 }).start();
  };

  // --- RENDER ---
  return (
    <View style={[styles.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={isDark ? ['#0f172a', '#000000'] : ['#f1f5f9', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Content (Flippable) */}
      <View style={{ flex: 1 }}>
        {/* GAME FACE */}
        <Animated.View style={[styles.cardFace, { opacity: isFlipped ? 0 : 1, transform: [{ rotateY: frontInterpolate }] }, isFlipped && { pointerEvents: 'none' }]}>
          {/* Header */}
          <View style={{ height: 60 + insets.top, width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.border }}>
            {/* Title */}
            <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: THEME.textMain, letterSpacing: 1.2, fontFamily: 'Outfit_700Bold' }}>GUESS THE NUMBER</Text>
            </View>

            {/* Back Button */}
            <Pressable
              onPress={() => router.back()}
              style={{ position: 'absolute', left: 16, top: insets.top + 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
            >
              <Feather name="arrow-left" size={24} color={THEME.primary} />
            </Pressable>

            {/* Pause Button */}
            <Pressable
              onPress={() => setIsPaused(!isPaused)}
              style={{ position: 'absolute', right: 64, top: insets.top + 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
            >
              <Feather name={isPaused ? "play" : "pause"} size={24} color={THEME.textMain} />
            </Pressable>

            {/* Settings Button */}
            <Pressable
              onPress={flipToSettings}
              style={{ position: 'absolute', right: 16, top: insets.top + 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
            >
              <Feather name="settings" size={24} color={THEME.textMain} />
            </Pressable>
          </View>

          {/* FAB - Game Switcher */}
          <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 20) + 10, left: 24, alignItems: 'flex-start', zIndex: 100 }}>
            {isFabOpen && <FabMenuOptions switchGame={switchGame} setIsFabOpen={setIsFabOpen} isDark={isDark} THEME={THEME} currentGame={'guess-the-number'} />}
            <Pressable
              style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: isFabOpen ? THEME.textMain : (isDark ? '#334155' : '#FFFFFF'),
                justifyContent: 'center', alignItems: 'center',
                ...select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  },
                  android: {
                    elevation: 8,
                  },
                  web: {
                    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
                  },
                }),
              }}
              onPress={() => setIsFabOpen(!isFabOpen)}
            >
              <MaterialCommunityIcons name={isFabOpen ? "close" : "apps"} size={28} color={isFabOpen ? THEME.bg : '#A855F7'} />
            </Pressable>
          </View>


          {/* Game Content */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 20 }}>
            {/* Main Glass Card */}
            <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.6)', borderColor: THEME.border }]}>
              {!isWeb && <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}

              {/* Info Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="target" size={16} color={THEME.textAlt} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: THEME.textAlt }}>1 - {gameRange}</Text>
                </View>
                {highScore !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="award" size={16} color={THEME.warning} />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: THEME.warning }}>Best: {highScore}</Text>
                  </View>
                )}
              </View>

              {/* Message */}
              <Text style={[styles.heroMessage, { color: gameOver ? THEME.btnEqual[0] : THEME.textMain }]}>
                {message}
              </Text>

              {/* Input Area */}
              <View style={{ gap: 16 }}>
                <TextInput
                  style={[{
                    backgroundColor: THEME.inputBg,
                    color: THEME.textMain,
                    borderColor: THEME.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    fontSize: 32,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    height: 72,
                    width: '100%',
                    letterSpacing: 4
                  }]}
                  placeholder="?"
                  placeholderTextColor={THEME.textAlt}
                  keyboardType="number-pad"
                  value={currentGuess}
                  onChangeText={setCurrentGuess}
                  maxLength={4}
                  editable={!gameOver && !isPaused}
                />

                <Pressable
                  style={({ pressed }) => [{
                    backgroundColor: THEME.btnEqual[0],
                    height: 56,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: (gameOver || !currentGuess) ? 0.5 : (pressed ? 0.8 : 1),
                    ...select({
                      ios: {
                        shadowColor: THEME.btnEqual[0],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: (gameOver || !currentGuess) ? 0 : 0.3,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: (gameOver || !currentGuess) ? 0 : 6
                      },
                      web: {
                        boxShadow: (gameOver || !currentGuess) ? 'none' : `0px 4px 8px ${THEME.btnEqual[0]}4D`, // 4D = 30% alpha roughly
                      }
                    })
                  }]}
                  onPress={handleGuess}
                  disabled={gameOver || !currentGuess || isPaused}
                >
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>GUESS</Text>
                </Pressable>
              </View>

              {/* Game Over Reset */}
              {gameOver && (
                <Pressable
                  style={{ marginTop: 20, paddingVertical: 12, alignItems: 'center' }}
                  onPress={() => startNewGame(gameRange)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                    <Feather name="refresh-cw" size={16} color={THEME.textMain} />
                    <Text style={{ color: THEME.textMain, fontWeight: 'bold' }}>Play Again</Text>
                  </View>
                </Pressable>
              )}

              {isPaused && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center', borderRadius: 24, zIndex: 100 }]}>
                  {!isWeb && <BlurView intensity={10} style={StyleSheet.absoluteFill} />}
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 20, letterSpacing: 4 }}>PAUSED</Text>
                  </View>
                </View>
              )}
            </View>

            {/* History Card */}
            <View style={{ flex: 1, overflow: 'hidden', borderRadius: 24, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: THEME.border }}>
              {!isWeb && <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.textAlt, textTransform: 'uppercase', letterSpacing: 1 }}>History ({history.length})</Text>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {history.map((item, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: THEME.textMain, fontFamily: isIOS ? 'Courier' : 'monospace' }}>#{item.guess}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: item.result.includes('Correct') ? THEME.success : (item.result.includes('Low') ? THEME.warning : THEME.error) }}>{item.result}</Text>
                      <Feather name={item.icon} size={16} color={item.result.includes('Correct') ? THEME.success : (item.result.includes('Low') ? THEME.warning : THEME.error)} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Animated.View>

        {/* SETTINGS FACE */}
        <Animated.View style={[styles.cardFace, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: isFlipped ? 1 : 0, transform: [{ rotateY: backInterpolate }] }, !isFlipped && { pointerEvents: 'none' }]}>
          <View style={{ height: 60 + insets.top, width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.border }}>
            {/* Title */}
            <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: THEME.textMain, letterSpacing: 1.2, fontFamily: 'Outfit_700Bold' }}>SETTINGS</Text>
            </View>

            {/* Back Button */}
            <Pressable
              onPress={flipToGame}
              style={{ position: 'absolute', left: 16, top: insets.top + 8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
            >
              <Feather name="arrow-left" size={24} color={THEME.primary} />
            </Pressable>
          </View>

          <View style={{ flex: 1, padding: 16 }}>
            <View style={[styles.glassCard, { flex: 1, marginBottom: 0, padding: 0, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.6)', borderColor: THEME.border }]}>
              {!isWeb && <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
              <ScrollView contentContainerStyle={{ padding: 24 }}>
                {/* Theme Section */}
                <Text style={[styles.sectionTitle, { color: THEME.textAlt }]}>Appearance</Text>
                <View style={styles.themeRow}>
                  {[{ id: 'system', icon: 'monitor', label: 'System' }, { id: 'light', icon: 'sun', label: 'Light' }, { id: 'dark', icon: 'moon', label: 'Dark' }].map(opt => (
                    <Pressable
                      key={opt.id}
                      style={[styles.themeOption, themePreference === opt.id && { backgroundColor: THEME.btnEqual[0], borderColor: THEME.btnEqual[0] }]}
                      onPress={() => updateThemePreference(opt.id)}
                    >
                      <Feather name={opt.icon} size={16} color={themePreference === opt.id ? '#FFF' : THEME.textMain} />
                      <Text style={[styles.themeOptionText, { color: themePreference === opt.id ? '#FFF' : THEME.textMain }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Difficulty Section */}
                <Text style={[styles.sectionTitle, { color: THEME.textAlt, marginTop: 32 }]}>Difficulty Range</Text>
                <View style={styles.themeRow}>
                  {[100, 500, 1000].map(r => (
                    <Pressable
                      key={r}
                      style={[styles.themeOption, gameRange === r && { backgroundColor: THEME.btnEqual[0], borderColor: THEME.btnEqual[0] }]}
                      onPress={() => startNewGame(r)}
                    >
                      <Text style={[styles.themeOptionText, { color: gameRange === r ? '#FFF' : THEME.textMain }]}>1 - {r}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Data Section */}
                <Text style={[styles.sectionTitle, { color: THEME.textAlt, marginTop: 32 }]}>Data</Text>
                <Pressable
                  style={[styles.modalButton, { borderColor: THEME.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}
                  onPress={() => setSavePreference(!savePreference)}
                >
                  <Text style={[styles.modalButtonText, { color: THEME.textMain }]}>Save High Score</Text>
                  <Feather name={savePreference ? "check-circle" : "circle"} size={20} color={savePreference ? THEME.success : THEME.textAlt} />
                </Pressable>

                <Pressable
                  style={[styles.modalButton, { marginTop: 40, borderColor: THEME.error, borderWidth: 1, backgroundColor: 'rgba(237, 41, 61, 0.05)' }]}
                  onPress={flipToGame}
                >
                  <Text style={{ color: THEME.error, fontWeight: 'bold' }}>Close Settings</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glassCard: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroMessage: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  cardFace: {
    flex: 1,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#475569',
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});