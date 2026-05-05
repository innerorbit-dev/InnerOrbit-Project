/** Purpose: Stealth Tic-Tac-Toe game used as an alternate functional interface. */
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, useWindowDimensions, ScrollView, Modal, TouchableWithoutFeedback, useColorScheme, Dimensions } from 'react-native';
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

export default function TicTacToeGame() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = windowWidth > windowHeight;
  const isTablet = windowWidth > 768;

  // --- THEME LOGIC ---
  const { isDark: isDarkMode, toggleTheme, decoyThemePreference: themePreference } = useAppTheme();
  const [savePreference, setSavePreference] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // 100% Strict Platform Color Variables (Mobile Only)
  const MOBILE_DARK = {
    bg: "#000000",
    textMain: "#F8FAFC",
    textAlt: "#94A3B8",
    border: "#1e293b",
    btnEqual: ["#09cef1f7", "#0891b2"],
  };

  const MOBILE_LIGHT = {
    bg: "#F1F5F9",
    textMain: "#0F172A",
    textAlt: "#334155",
    border: "#94A3B8",
    btnEqual: ["#22D3EE", "#06B6D4"],
  };

  const THEME = isDarkMode ? MOBILE_DARK : MOBILE_LIGHT;

  // --- GAME STATE ---
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);
  const [scores, setScores] = useState({ X: 0, Y: 0, draws: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSystemMode, setIsSystemMode] = useState(true);
  const [difficulty, setDifficulty] = useState('medium');

  // Animation State
  const [isFlipped, setIsFlipped] = useState(false);
  const [settingsTab, setSettingsTab] = useState('game'); // 'game' or 'app'
  const flipAnim = useRef(new Animated.Value(0)).current;
  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  // Load Settings
  useEffect(() => {
    const loadState = async () => {
      try {
        const storedSave = await AsyncStorage.getItem("savePreference");
        const save = storedSave === 'true';
        setSavePreference(save);

        if (save) {
          const s = await AsyncStorage.getItem("tttScores");
          const m = await AsyncStorage.getItem("tttMode");
          if (s) {
            const parsedScores = JSON.parse(s);
            // Migrate O scores to Y if needed
            if ('O' in parsedScores) {
              parsedScores.Y = parsedScores.O;
              delete parsedScores.O;
            }
            setScores(parsedScores);
          }
          if (m) setIsSystemMode(m === 'system');
        }
      } catch (e) {
        Logger.log("Error loading state", e);
      }
    };
    loadState();
  }, []);

  // Save Settings
  useEffect(() => {
    const saveState = async () => {
      await AsyncStorage.setItem("savePreference", String(savePreference));
      if (savePreference) {
        AsyncStorage.setItem("tttScores", JSON.stringify(scores));
        AsyncStorage.setItem("tttMode", isSystemMode ? 'system' : 'pvp');
      }
    }
    saveState();
  }, [savePreference, scores, isSystemMode]);

  const updateThemePreference = (pref) => toggleTheme(pref, 'decoy');
  const updateSavePreference = (val) => setSavePreference(val);

  const flipToSettings = () => {
    setIsFlipped(true);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 1, friction: 8, tension: 10 }).start();
  };

  const flipToGame = () => {
    setIsFlipped(false);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 0, friction: 8, tension: 10 }).start();
  };

  // UI THEME FOR TIC-TAC-TOE
  const TTT_THEME = {
    grid: isDarkMode ? "rgba(255, 255, 255, 0.36)" : "rgba(15, 23, 42, 0.15)",
    xColor: "#00F0FF",
    yColor: "#F900BF",
    winner: "#10B981",
    accent: isDarkMode ? "#F900BF" : "#E11D48",
    cardBg: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
  };

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  };

  const getStatus = () => {
    if (winner === 'Draw') return "It's a Draw!";
    if (winner) return winner === 'X' ? "You Won!" : (isSystemMode ? "System Won!" : "Y Won!");
    return isXNext ? "Your Turn (X)" : (isSystemMode ? "System is thinking..." : "Y's Turn");
  };

  // --- System AI Strategy ---
  const minimax = (boardState, depth, isMaximizing) => {
    const result = calculateWinner(boardState);
    if (result === 'Y') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (!boardState.includes(null)) return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === null) {
          boardState[i] = 'Y';
          const score = minimax(boardState, depth + 1, false);
          boardState[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === null) {
          boardState[i] = 'X';
          const score = minimax(boardState, depth + 1, true);
          boardState[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  };

  const getSystemMove = (currentBoard) => {
    const emptyIndices = currentBoard.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (emptyIndices.length === 0) return null;

    if (difficulty === 'expert') {
      if (emptyIndices.length >= 8 && currentBoard[4] === null) return 4;
      let bestScore = -Infinity;
      let bestMove = null;
      for (let i of emptyIndices) {
        currentBoard[i] = 'Y';
        let score = minimax(currentBoard, 0, false);
        currentBoard[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
      return bestMove ?? emptyIndices[0];
    }

    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const findKeyMove = (target) => {
      for (const [a, b, c] of lines) {
        const vals = [currentBoard[a], currentBoard[b], currentBoard[c]];
        if (vals.filter(v => v === target).length === 2 && vals.filter(v => v === null).length === 1) {
          return [a, b, c].find(i => currentBoard[i] === null);
        }
      }
      return null;
    }

    if (difficulty === 'low' && Math.random() < 0.7) return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const winMove = findKeyMove('Y');
    if (winMove !== null) return winMove;
    if (difficulty !== 'low' || Math.random() < 0.5) {
      const blockMove = findKeyMove('X');
      if (blockMove !== null) return blockMove;
    }
    if (difficulty === 'hard') {
      if (currentBoard[4] === null) return 4;
      const corners = [0, 2, 6, 8].filter(i => currentBoard[i] === null);
      if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
    }
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  };

  useEffect(() => {
    if (isSystemMode && !isXNext && !winner && !isPaused) {
      const timer = setTimeout(() => {
        const move = getSystemMove(board);
        if (move !== null) handlePress(move, true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isXNext, isSystemMode, winner, board]);

  const handlePress = (index, isSystemMove = false) => {
    if (board[index] || winner || isPaused || (isSystemMode && !isXNext && !isSystemMove)) return;
    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'Y';
    setBoard(newBoard);
    setIsXNext(!isXNext);
    const gameWinner = calculateWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setScores(prev => ({ ...prev, [gameWinner]: prev[gameWinner] + 1 }));
    } else if (newBoard.every(square => square !== null)) {
      setWinner('Draw');
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
    }
  };

  const resetGame = () => {
    if (isPaused) return;
    setBoard(Array(9).fill(null));
    setWinner(null);
    const userStarts = Math.random() < 0.5;
    setIsXNext(userStarts);
  };

  const resetScores = () => {
    setScores({ X: 0, Y: 0, draws: 0 });
    resetGame();
  };

  const switchGame = (game) => {
    if (game === 'tic-tac-toe') {
      setIsFabOpen(false);
      return;
    }
    if (game === 'calculator') router.push("/CalcX");
    else router.push(`/game/${game}`);
    setIsFabOpen(false);
  };

  const renderSquare = (index) => (
    <View key={index}>
      <Pressable
        style={({ pressed }) => [
          styles.square,
          pressed && styles.squarePressed,
          { borderColor: TTT_THEME.grid, width: Math.min((windowWidth - 40) / 3, 110), height: Math.min((windowWidth - 40) / 3, 110) }
        ]}
        onPress={() => handlePress(index)}
      >
        {board[index] === 'X' && <Feather name="x" size={isTablet ? 64 : 48} color={TTT_THEME.xColor} style={select({ web: { textShadow: `0px 0px 10px ${TTT_THEME.xColor}` }, default: { textShadowColor: TTT_THEME.xColor, textShadowRadius: 10 } })} />}
        {board[index] === 'Y' && <Text style={{ fontSize: isTablet ? 64 : 48, fontWeight: '900', color: TTT_THEME.yColor, ...select({ web: { textShadow: `0px 0px 10px ${TTT_THEME.yColor}` }, default: { textShadowColor: TTT_THEME.yColor, textShadowRadius: 10 } }) }}>Y</Text>}
      </Pressable>
    </View >
  );

  return (
    <View style={[styles.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 20) + 10, left: 24, alignItems: 'flex-start', zIndex: 100 }}>
        {isFabOpen && <FabMenuOptions switchGame={switchGame} setIsFabOpen={setIsFabOpen} isDark={isDarkMode} THEME={THEME} currentGame={'tic-tac-toe'} />}
        <Pressable
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: isFabOpen ? THEME.textMain : (isDarkMode ? '#334155' : '#FFFFFF'),
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

      <View style={styles.mobileGameContainer}>
        {/* Header Title & Buttons */}
        <Animated.View
          style={[
            { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
            { transform: [{ rotateY: frontInterpolate }] },
            isWeb && { pointerEvents: isFlipped ? 'none' : 'auto' }
          ]}
          pointerEvents={isWeb ? undefined : (isFlipped ? 'none' : 'auto')}
        >
          {/* Header Title */}
          <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: THEME.textMain, letterSpacing: 1.2, fontFamily: 'Outfit_700Bold' }}>TIC-TAC-TOE</Text>
          </View>

          {/* Settings Button */}
          <Pressable
            style={[styles.settingsButton, { top: insets.top + 8, left: 16 }]}
            onPress={() => { setSettingsTab('game'); flipToSettings(); }}
          >
            <Feather name="settings" size={isTablet ? 32 : 24} color={THEME.textMain} />
          </Pressable>

          <Pressable
            style={[styles.settingsButton, { top: insets.top + 8, right: 60 }]}
            onPress={() => setIsPaused(!isPaused)}
          >
            <Feather name={isPaused ? "play" : "pause"} size={isTablet ? 32 : 24} color={THEME.textMain} />
          </Pressable>

          <Pressable
            style={[styles.settingsButton, { top: insets.top + 8, right: 16 }]}
            onPress={() => setShowSettings(true)}
          >
            <Feather name="more-vertical" size={isTablet ? 32 : 24} color={THEME.textMain} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: insets.top + 70 }}>
            {isSystemMode ? (
              <>
                <Feather name="user" size={18} color={THEME.textAlt} />
                <Text style={{ color: THEME.textAlt, fontSize: 18 }}>You vs</Text>
                <Feather name="cpu" size={18} color={THEME.textAlt} />
                <Text style={{ color: THEME.textAlt, fontSize: 18 }}>System ({difficulty})</Text>
              </>
            ) : (
              <>
                <Feather name="users" size={18} color={THEME.textAlt} />
                <Text style={{ color: THEME.textAlt, fontSize: 18 }}>Local Multi-Player</Text>
              </>
            )}
          </View>

          {/* Scores */}
          <View style={[styles.scoreBoard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 20, padding: 15 }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: TTT_THEME.xColor, fontWeight: 'bold' }}>X (You)</Text>
              <Text style={[styles.scoreText, { color: THEME.textMain, fontSize: 28 }]}>{scores.X}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: THEME.textAlt, fontWeight: 'bold' }}>Draws</Text>
              <Text style={[styles.scoreText, { color: THEME.textMain, fontSize: 28 }]}>{scores.draws}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: TTT_THEME.yColor, fontWeight: 'bold' }}>{isSystemMode ? "System" : "Y"}</Text>
              <Text style={[styles.scoreText, { color: THEME.textMain, fontSize: 28 }]}>{scores.Y}</Text>
            </View>
          </View>

          {/* Game Status */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.statusText, { color: winner ? (winner === 'Draw' ? THEME.textAlt : TTT_THEME.winner) : THEME.textMain, fontSize: 24, fontWeight: '300' }]}>
              {getStatus().toUpperCase()}
            </Text>
          </View>

          {/* Game Board */}
          <View style={styles.ticTacToeBoard}>
            {[0, 1, 2].map(row => (
              <View key={row} style={styles.boardRow}>
                {[0, 1, 2].map(col => renderSquare(row * 3 + col))}
              </View>
            ))}
            {isPaused && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderRadius: 12, zIndex: 10 }]}>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 24, letterSpacing: 4 }}>PAUSED</Text>
                </View>
              </View>
            )}
          </View>

          {/* Controls */}
          <View style={[styles.gameControls, { flexDirection: 'column', gap: 12, marginTop: 24, marginBottom: 20 }]}>
            <Pressable
              style={({ pressed }) => [{
                width: width * 0.65,
                maxWidth: 260,
                height: 54,
                borderRadius: 27,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
                elevation: 10,
                ...select({
                  ios: {
                    shadowColor: isXNext ? '#3B82F6' : '#EC4899',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.8, // Increased for visibility
                    shadowRadius: 15, // Increased for visibility
                  },
                  android: {
                    elevation: 12,
                  },
                  web: {
                    boxShadow: `0px 6px 15px ${isXNext ? 'rgba(59, 130, 246, 0.6)' : 'rgba(236, 72, 153, 0.6)'}`,
                  },
                }),
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.4)',
              }]}
              onPress={resetGame}
            >
              <LinearGradient
                colors={isDarkMode ? ['#00F0FF', '#7000FF', '#F900BF'] : ['#F900BF', '#E11D48']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="restart" size={22} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 17, letterSpacing: 1.5 }}>REPLAY ROUND</Text>
              </View>
            </Pressable>

            <Pressable style={{ paddingHorizontal: 24, paddingVertical: 12, marginTop: 12, borderWidth: 1, borderColor: THEME.border, borderRadius: 24 }} onPress={resetScores}>
              <Text style={{ color: THEME.textAlt, fontWeight: '700', fontSize: 16, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 1 }}>Reset Tournament</Text>
            </Pressable>
          </View>

          <View style={{ height: 20 }} />
        </Animated.View>

        {/* BACK FACE: SETTINGS */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', zIndex: 50 },
            { transform: [{ rotateY: backInterpolate }] },
            isWeb && { pointerEvents: isFlipped ? 'auto' : 'none' }
          ]}
          pointerEvents={isWeb ? undefined : (isFlipped ? 'auto' : 'none')}
        >
          <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={[styles.modalTitle, { color: THEME.textMain, fontSize: 28, marginBottom: 30 }]}>
              {settingsTab === 'game' ? 'Game Settings' : 'App Settings'}
            </Text>
            <View style={{ width: '100%', maxWidth: 400 }}>
              {settingsTab === 'app' && (
                /* App Settings (Appearance, Persistence) */
                <>
                  <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 12, fontSize: 13, textTransform: 'uppercase' }]}>Appearance</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, width: '100%' }}>
                    {[{ id: 'system', icon: 'monitor', label: 'System' }, { id: 'light', icon: 'sun', label: 'Light' }, { id: 'dark', icon: 'moon', label: 'Dark' }].map(opt => (
                      <Pressable key={opt.id} style={[styles.themeOption, themePreference === opt.id && { backgroundColor: isDarkMode ? '#475569' : MOBILE_LIGHT.btnEqual[0], borderColor: isDarkMode ? '#475569' : MOBILE_LIGHT.btnEqual[0] }]} onPress={() => updateThemePreference(opt.id)}>
                        <Feather name={opt.icon} size={18} color={themePreference === opt.id ? '#FFF' : THEME.textMain} />
                        <Text style={[styles.themeOptionText, { color: themePreference === opt.id ? '#FFF' : THEME.textMain }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ width: '100%', borderBottomWidth: 1, borderBottomColor: THEME.border, marginBottom: 12 }} />
                  <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 8, fontSize: 13, textTransform: 'uppercase' }]}>Data Persistence</Text>
                  <Pressable style={[styles.modalButton, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: THEME.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 }]} onPress={() => updateSavePreference(!savePreference)}>
                    <Text style={[styles.modalButtonText, { color: THEME.textMain }]}>Save Session Data</Text>
                    <Feather name={savePreference ? "check-circle" : "circle"} size={24} color={savePreference ? '#FF4B4B' : THEME.textAlt} />
                  </Pressable>
                </>
              )}
              {settingsTab === 'game' && (
                /* Game Settings (Mode, Difficulty) */
                <>
                  <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', fontWeight: '700' }]}>Game Mode</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <Pressable
                      style={[
                        styles.modalButton,
                        {
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          backgroundColor: isSystemMode ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                          paddingVertical: 14,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSystemMode ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                          ...Platform.select({
                            ios: {
                              shadowColor: THEME.btnEqual[0],
                              shadowOpacity: isSystemMode ? 0.3 : 0,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 4 }
                            },
                            android: {
                              elevation: isSystemMode ? 4 : 0,
                            },
                            web: {
                              boxShadow: isSystemMode ? `0px 4px 8px ${THEME.btnEqual[0]}66` : 'none',
                            }
                          })
                        }
                      ]}
                      onPress={() => setIsSystemMode(true)}
                    >
                      <Feather name="cpu" size={20} color={isSystemMode ? "#FFF" : THEME.textAlt} />
                      <Text style={[styles.modalButtonText, { color: isSystemMode ? "#FFF" : THEME.textAlt, fontSize: 13, fontWeight: isSystemMode ? '800' : '600' }]}>VS SYSTEM</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modalButton,
                        {
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          backgroundColor: !isSystemMode ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                          paddingVertical: 14,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: !isSystemMode ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                          ...Platform.select({
                            ios: {
                              shadowColor: THEME.btnEqual[0],
                              shadowOpacity: !isSystemMode ? 0.3 : 0,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 4 }
                            },
                            android: {
                              elevation: !isSystemMode ? 4 : 0,
                            },
                            web: {
                              boxShadow: !isSystemMode ? `0px 4px 8px ${THEME.btnEqual[0]}66` : 'none',
                            }
                          })
                        }
                      ]}
                      onPress={() => setIsSystemMode(false)}
                    >
                      <Feather name="users" size={20} color={!isSystemMode ? "#FFF" : THEME.textAlt} />
                      <Text style={[styles.modalButtonText, { color: !isSystemMode ? "#FFF" : THEME.textAlt, fontSize: 13, fontWeight: !isSystemMode ? '800' : '600' }]}>2 PLAYERS</Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', fontWeight: '700', opacity: isSystemMode ? 1 : 0.5 }]}>Difficulty</Text>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, opacity: isSystemMode ? 1 : 0.5 }}
                    pointerEvents={isSystemMode ? 'auto' : 'none'}
                  >
                    {['low', 'medium', 'hard', 'expert'].map(level => (
                      <Pressable
                        key={level}
                        style={[
                          styles.modalButton,
                          {
                            flex: 1,
                            minWidth: '40%',
                            paddingVertical: 12,
                            backgroundColor: difficulty === level ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                            borderWidth: 1,
                            borderColor: difficulty === level ? THEME.btnEqual[0] : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                            borderRadius: 12,
                            ...select({
                              ios: {
                                shadowColor: THEME.btnEqual[0],
                                shadowOpacity: difficulty === level ? 0.3 : 0,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 }
                              },
                              android: {
                                elevation: difficulty === level ? 4 : 0,
                              },
                              web: {
                                boxShadow: difficulty === level ? `0px 2px 6px ${THEME.btnEqual[0]}66` : 'none',
                              }
                            })
                          }
                        ]}
                        onPress={() => setDifficulty(level)}
                      >
                        <Text style={{ textAlign: 'center', color: difficulty === level ? '#FFF' : THEME.textAlt, fontWeight: difficulty === level ? '800' : '600', textTransform: 'capitalize' }}>{level}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
            <View style={{ height: 40 }} />
            <Pressable style={[styles.modalButton, styles.modalButtonCancel, { width: '100%', maxWidth: 400 }]} onPress={flipToGame}>
              <Text style={[styles.modalButtonText, styles.modalButtonCancelText]}>Back to Game</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>

        {/* App Settings Modal (Popup) */}
        <Modal animationType="fade" transparent={true} visible={showSettings} onRequestClose={() => setShowSettings(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSettings(false)}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)', overflow: 'hidden', ...(isWeb ? { backdropFilter: 'blur(15px)' } : {}) }]}>
                {!isWeb && <BlurView intensity={50} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
                <LinearGradient colors={isDarkMode ? ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.2)'] : ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)']} style={StyleSheet.absoluteFill} />
                <Text style={[styles.modalTitle, { color: THEME.textMain, marginBottom: 12 }]}>App Settings</Text>
                <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 6, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }]}>Appearance</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' }}>
                  {[{ id: 'system', icon: 'monitor', label: 'System' }, { id: 'light', icon: 'sun', label: 'Light' }, { id: 'dark', icon: 'moon', label: 'Dark' }].map(opt => (
                    <Pressable key={opt.id} style={[styles.themeOption, themePreference === opt.id && { backgroundColor: isDarkMode ? '#475569' : '#E2E8F0', borderColor: isDarkMode ? '#475569' : '#E2E8F0' }]} onPress={() => updateThemePreference(opt.id)}>
                      <Feather name={opt.icon} size={18} color={themePreference === opt.id ? '#FFF' : THEME.textMain} />
                      <Text style={[styles.themeOptionText, { color: themePreference === opt.id ? '#FFF' : THEME.textMain }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ width: '100%', borderBottomWidth: 1, borderBottomColor: THEME.border, marginBottom: 8 }} />
                <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 6, fontSize: 13, textTransform: 'uppercase' }]}>Data</Text>
                <Pressable style={[styles.modalButton, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: THEME.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 0 }]} onPress={() => updateSavePreference(!savePreference)}>
                  <Text style={[styles.modalButtonText, { color: THEME.textMain }]}>Save Session Data</Text>
                  <Feather name={savePreference ? "check-circle" : "circle"} size={20} color={savePreference ? '#FF4B4B' : THEME.textAlt} />
                </Pressable>
                <Pressable style={[styles.modalButton, styles.modalButtonCancel, { width: '100%', marginTop: 20 }]} onPress={() => setShowSettings(false)}>
                  <Text style={[styles.modalButtonText, styles.modalButtonCancelText]}>Close</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </Modal>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    paddingTop: 0,
  },
  mobileGameContainer: {
    flex: 1,
    padding: 0,
    justifyContent: 'flex-end',
    width: '100%',
  },
  settingsButton: {
    position: 'absolute',
    top: 10,
    right: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 340,
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    alignItems: 'center',
    ...select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: isIOS ? 'System' : 'Roboto',
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#ed293dff',
    marginTop: 8,
  },
  modalButtonCancelText: {
    color: '#ca0d0dff',
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  ticTacToeBoard: {
    marginBottom: 30,
  },
  boardRow: {
    flexDirection: 'row',
  },
  square: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  squarePressed: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  gameControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    paddingBottom: 40,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calcFooter: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
    paddingBottom: 20,
    letterSpacing: 6,
    textTransform: 'uppercase',
    ...select({
      ios: {
        textShadowColor: 'rgba(168, 85, 247, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      },
      android: {
        elevation: 5, // Approximate text shadow on Android if applicable, widely unsupported but valid prop
        textShadowColor: 'rgba(168, 85, 247, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      },
      web: {
        textShadow: '0px 0px 10px rgba(168, 85, 247, 0.5)',
      },
    }),
    opacity: 0.9,
  },
});
