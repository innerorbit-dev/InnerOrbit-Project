/** Purpose: Stealth Ludo game for casual engagement and distraction. */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, Dimensions, Animated,
    Easing, Alert, Modal, Vibration, useColorScheme, StatusBar, TouchableWithoutFeedback
} from 'react-native';
import { select, isWeb, isIOS } from '../../utils/platform';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from 'expo-font';
import { useAppTheme } from '../../store/themeStore';
import { Logger } from '../../lib/logger';
import FabMenuOptions from '../ui/FabMenu';
import * as Crypto from 'expo-crypto';

// --- THEME CONSTANTS (MATCHING CALCULATOR) ---
const MOBILE_DARK = {
    bg: "#000000",
    display: "#000000",
    keypad: "#000000",
    btnNumber: ["#1e293b", "#020617"],
    btnOp: ["#fb7185", "#be123c"],
    btnEqual: ["#09cef1f7", "#0891b2"],
    btnTop: ["#94A3B8", "#475569"],
    textMain: "#F8FAFC",
    textAlt: "#94A3B8",
    border: "#1e293b",
    btnEqualEqual: ["#22D3EE", "#06B6D4"],
    glass: "rgba(30,41,59,0.95)",
    glassBorder: "rgba(255,255,255,0.1)"
};

const MOBILE_LIGHT = {
    bg: "#F1F5F9",
    display: "#F8FAFC",
    keypad: "#E2E8F0",
    btnNumber: ["#F8FAFC", "#F1F5F9"],
    btnOp: ["#FB7185", "#E11D48"],
    btnEqual: ["#22D3EE", "#06B6D4"],
    btnTop: ["#94A3B8", "#64748B"],
    textMain: "#0F172A",
    textAlt: "#334155",
    border: "#94A3B8",
    btnEqualEqual: ["#22D3EE", "#06B6D4"],
    glass: "rgba(255,255,255,0.95)",
    glassBorder: "rgba(0,0,0,0.1)"
};

// --- GAME CONSTANTS ---
// BOARD_SIZE is now dynamic inside the component
const COLORS = {
    red: '#D32F2F',      // Rich red (Indian Ludo standard)
    green: '#388E3C',    // Rich green (Indian Ludo standard)
    yellow: '#F57C00',   // Deep orange-yellow (Indian Ludo standard)
    blue: '#1976D2',     // Rich blue (Indian Ludo standard)
};

const SAFE_SPOTS = [8, 21, 34, 47];

// --- SOUND MOCK ---
const playSound = (type) => {/* Mock */ };

// --- DICE COMPONENT (Prettier) ---
const Dice = ({ value, rolling, onRoll, disabled, isPaused, color, THEME }) => {
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (rolling) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(spinValue, { toValue: 1, duration: 150, useNativeDriver: !isWeb, easing: Easing.linear }),
                    Animated.timing(spinValue, { toValue: 0, duration: 0, useNativeDriver: !isWeb })
                ])
            ).start();
        } else {
            spinValue.stopAnimation();
            spinValue.setValue(0);
        }
    }, [rolling]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <Pressable
            disabled={disabled || rolling || isPaused}
            onPress={() => { if (!disabled && !isPaused) { Vibration.vibrate(50); onRoll(); } }}
            style={{ alignItems: 'center', opacity: disabled ? 0.6 : 1 }}
        >
            <View style={{
                width: 70, height: 70, borderRadius: 20,
                backgroundColor: THEME.bg === '#000000' ? '#1e293b' : '#FFF',
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 2, borderColor: color,
                ...select({
                    ios: {
                        shadowColor: color,
                        shadowOpacity: 0.4,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 }
                    },
                    android: {
                        elevation: 10,
                    },
                    web: {
                        boxShadow: `0px 0px 10px ${color}66`
                    }
                })
            }}>
                <Animated.View style={{ transform: [{ rotate: rolling ? spin : '0deg' }] }}>
                    <MaterialCommunityIcons
                        name={rolling ? "dice-d20" : `dice-${value || 1}`}
                        size={48}
                        color={color}
                    />
                </Animated.View>
            </View>
            {
                !rolling && !disabled && (
                    <View style={{ position: 'absolute', bottom: -10, backgroundColor: color, paddingHorizontal: 10, borderRadius: 8 }}>
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>ROLL</Text>
                    </View>
                )
            }
        </Pressable>
    );
};

export default function LudoGame() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const BOARD_SIZE = Math.min(width, height) * 0.90;
    const insets = useSafeAreaInsets();
    const systemTheme = useColorScheme();

    // STRICT RESTRICTION: Mobile Only (Android/iOS)
    const isElectron = isWeb && typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    const platformType = isElectron ? 'desktop' : (isWeb ? 'web' : 'mobile');

    useEffect(() => {
        if (platformType !== 'mobile') {
            router.replace("/home");
        }
    }, [platformType]);

    if (platformType !== 'mobile') return <View style={{ flex: 1, backgroundColor: '#000' }} />;

    // --- THEME & SETTINGS STATE ---
    const { isDark: isDarkMode, toggleTheme, decoyThemePreference: themePreference } = useAppTheme();
    const [savePreference, setSavePreference] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);

    const THEME = isDarkMode ? MOBILE_DARK : MOBILE_LIGHT;

    // Load Settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSavePromise = await AsyncStorage.getItem("savePreference");
                setSavePreference(savedSavePromise === 'true');
            } catch (e) { }
        };
        loadSettings();
    }, []);

    const updateThemePreference = (pref) => toggleTheme(pref, 'decoy');

    const updateSavePreference = async (val) => {
        try {
            setSavePreference(val);
            await AsyncStorage.setItem("savePreference", String(val));
        } catch (e) { }
    };

    const switchGame = (game) => {
        if (game === 'ludo') {
            setIsFabOpen(false);
            return;
        }
        if (game === 'calculator') router.push("/CalcX");
        else router.push(`/game/${game}`);
        setIsFabOpen(false);
    };


    // --- GAME STATE ---
    const [gameType, setGameType] = useState('system');
    const [numPlayers, setNumPlayers] = useState(2);
    const [difficulty, setDifficulty] = useState('medium');
    const [isSetup, setIsSetup] = useState(true);

    const [activePlayer, setActivePlayer] = useState(0);
    const [diceValue, setDiceValue] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [canMove, setCanMove] = useState(false);
    const [playerTokens, setPlayerTokens] = useState([[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]);
    const [selectedToken, setSelectedToken] = useState(null);
    const [tokensHome, setTokensHome] = useState([0, 0, 0, 0]);
    const [winners, setWinners] = useState([]);
    const [consecutiveSixes, setConsecutiveSixes] = useState(0);
    const tokenAnimations = useRef({}).current;

    // --- LOGIC WITH AUTHENTIC BOARD PATHS ---

    // Get starting position for each player (entry point on board)
    const getStartPosition = (playerIdx) => {
        return playerIdx * 13; // Red: 0, Green: 13, Yellow: 26, Blue: 39
    };

    // Get home path start position (after completing main board, enter home path)
    const getHomePathStart = (playerIdx) => {
        return 100 + playerIdx * 10; // Home paths start from position 100+
    };

    // Calculate total position considering main board + home path
    const getAbsolutePosition = (playerIdx, pos) => {
        if (pos <= 52) return pos; // On main board
        return getHomePathStart(playerIdx) + (pos - 52); // On home path
    };

    // Check if position is a safe spot on main board
    const isSafeSpot = (pos) => {
        const safeSpots = [0, 13, 26, 39]; // Start positions are always safe
        const midSafeSpots = [8, 21, 34, 47]; // Traditional safe spots
        return [...safeSpots, ...midSafeSpots].includes(pos % 52);
    };

    const getColorName = (idx) => ['Red', 'Green', 'Yellow', 'Blue'][idx];
    const getColorCode = (idx) => [COLORS.red, COLORS.green, COLORS.yellow, COLORS.blue][idx];

    const canTokenMove = (pIdx, i, roll, pos) => {
        if (winners.includes(pIdx)) return false; // Winner can't move
        if (pos === -1 && roll !== 6) return false; // Need 6 to come out
        if (pos >= 57) return false; // Already home
        if (pos + roll > 57) return false; // Can't overshoot end
        return true;
    };

    const checkCapture = (pIdx, newPos) => {
        if (newPos >= 52 || isSafeSpot(newPos)) return false; // Can't capture on home path or safe spots

        let captured = [];
        for (let p = 0; p < 4; p++) {
            if (p === pIdx) continue;
            playerTokens[p].forEach((tokenPos, i) => {
                if (tokenPos === newPos && tokenPos !== -1) {
                    captured.push([p, i]);
                }
            });
        }
        return captured;
    };

    const handleRollDice = () => {
        Logger.log(`[LudoGame] handleRollDice called. Rolling: ${rolling}, Winners: ${winners.includes(activePlayer)}, Paused: ${isPaused}`);
        if (rolling || winners.includes(activePlayer) || isPaused) return;
        setRolling(true);
        playSound('roll');
        Vibration.vibrate(50);

        setTimeout(() => {
            // CRYPTO RANDOM VALUES (SECURE)
            const randomBuffer = new Uint8Array(1);
            Crypto.getRandomValues(randomBuffer);
            const val = (randomBuffer[0] % 6) + 1;

            setDiceValue(val);
            setRolling(false);

            const currentTokens = playerTokens[activePlayer];
            const hasMoves = currentTokens.some((pos, i) => canTokenMove(activePlayer, i, val, pos));

            if (hasMoves) {
                setCanMove(true);
                setConsecutiveSixes(val === 6 ? consecutiveSixes + 1 : 0);
            } else {
                setConsecutiveSixes(0);
                setTimeout(nextTurn, 800);
            }
        }, 600);
    };

    const nextTurn = () => {
        // Check if player rolled 6 and hasn't exceeded 3 consecutive sixes
        if (diceValue === 6 && consecutiveSixes < 3) {
            // Player gets another roll - just clear selection
            setCanMove(false);
            setSelectedToken(null);
        } else {
            // Turn ends - move to next player
            setDiceValue(null);
            setCanMove(false);
            setConsecutiveSixes(0);
            setSelectedToken(null);

            let next = (activePlayer + 1) % numPlayers;
            while (gameType === 'human' && numPlayers === 2 && next % 2 === 1) {
                next = (next + 1) % numPlayers;
            }
            setActivePlayer(next);
        }
    };

    const moveToken = (pIdx, i, roll) => {
        if (!canTokenMove(pIdx, i, diceValue, playerTokens[pIdx][i])) return;

        const newTokens = JSON.parse(JSON.stringify(playerTokens));
        let newPos = newTokens[pIdx][i] === -1 ? 1 : newTokens[pIdx][i] + roll;

        newTokens[pIdx][i] = newPos;
        setPlayerTokens(newTokens);

        // Check for captures
        const capturedTokens = checkCapture(pIdx, newPos);
        if (capturedTokens.length > 0) {
            playSound('capture');
            Vibration.vibrate([50, 100, 50]);
            capturedTokens.forEach(([capturedPIdx, capturedIdx]) => {
                newTokens[capturedPIdx][capturedIdx] = -1; // Send back home
            });
            setPlayerTokens(newTokens);
        }

        // Check for win
        if (newPos === 57) {
            setWinners([...winners, pIdx]);
            playSound('win');
            Vibration.vibrate([100, 50, 100, 50, 100]);

            if (winners.length === numPlayers - 1) {
                // Game over
                setTimeout(() => {
                    Alert.alert('Game Over', `${getColorName(pIdx)} wins!`);
                }, 800);
            }
        }

        playSound('move');
        Vibration.vibrate(30);

        setTimeout(() => {
            nextTurn();
        }, 300);
    };

    // AI Logic Hook
    useEffect(() => {
        const isAiTurn = gameType === 'system' && activePlayer !== 0 && !winners.includes(activePlayer);
        if (isPaused) return;

        if (!isSetup && isAiTurn && !rolling && !diceValue) {
            const delayMs = difficulty === 'hard' ? 400 : (difficulty === 'medium' ? 800 : 1200);
            const timeoutId = setTimeout(handleRollDice, delayMs);
            return () => clearTimeout(timeoutId);
        }

        if (!isSetup && isAiTurn && diceValue && !rolling && canMove) {
            const tokens = playerTokens[activePlayer];
            const validMoves = tokens
                .map((p, i) => canTokenMove(activePlayer, i, diceValue, p) ? i : -1)
                .filter(idx => idx !== -1);

            if (validMoves.length > 0) {
                const timeoutId = setTimeout(() => {
                    let bestMove = validMoves[0];

                    if (difficulty === 'hard') {
                        // Prioritize: bringing token out (if none out), capturing, or advancing furthest
                        const outTokens = validMoves.filter(i => tokens[i] === -1);
                        if (outTokens.length > 0) bestMove = outTokens[0];
                        else {
                            // Find move that captures or advances most
                            let bestScore = -1;
                            validMoves.forEach(i => {
                                const newPos = tokens[i] === -1 ? 1 : tokens[i] + diceValue;
                                const captureBonus = checkCapture(activePlayer, newPos).length > 0 ? 100 : 0;
                                const score = newPos + captureBonus;
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestMove = i;
                                }
                            });
                        }
                    } else if (difficulty === 'medium') {
                        // Randomly pick between valid moves with slight preference for bringing out
                        if (Math.random() < 0.6 && validMoves.some(i => tokens[i] === -1)) {
                            bestMove = validMoves.find(i => tokens[i] === -1) || validMoves[0];
                        } else {
                            bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                        }
                    }

                    moveToken(activePlayer, bestMove, diceValue);
                }, 600);

                return () => clearTimeout(timeoutId);
            } else {
                const timeoutId = setTimeout(nextTurn, 600);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [activePlayer, isSetup, gameType, rolling, diceValue, difficulty, canMove, playerTokens, winners]);


    // --- RENDER HELPERS ---

    // Get board cell positions for AUTHENTIC INDIAN LUDO board layout
    const getBoardCells = () => {
        const cellSize = (BOARD_SIZE - 40) / 15;

        const boardGrid = [
            // RED HOME PATH (top-left diagonal) - positions 0-5
            { x: 1, y: 6, cellIdx: 0, isSafe: true, color: COLORS.RED }, // Red Start
            { x: 2, y: 6, cellIdx: 1, isSafe: false, color: COLORS.RED },
            { x: 3, y: 6, cellIdx: 2, isSafe: false, color: COLORS.RED },
            { x: 4, y: 6, cellIdx: 3, isSafe: false, color: COLORS.RED },
            { x: 5, y: 6, cellIdx: 4, isSafe: false, color: COLORS.RED },
            { x: 6, y: 6, cellIdx: 5, isSafe: false, color: COLORS.RED }, // Not used in this map logic? Wait, home path is usually X:6, Y:6 ???
            // Actually, let's stick to the visual grid coordinates based on standard ludo

            // Standard Path Loop Corrected for Visual Grid (0-14)
            // Left-Bottom (Red Home Run): (1,6) -> (5,6)
            // ... I will use the generic logic below to color specific cells based on standard Ludo layout

            // Let's just iterate 15x15 grid and render relevant cells
        ];

        // We will render the 15x15 grid cells that are part of the track
        // Tracks: (x:0-5, y:6-8), (x:6-8, y:0-5), (x:9-14, y:6-8), (x:6-8, y:9-14)
        // Center: (x:6-8, y:6-8)

        const cells = [];

        // Helper to determine cell type
        const getCellType = (x, y) => {
            // Center
            if (x >= 6 && x <= 8 && y >= 6 && y <= 8) return 'CENTER';

            // Home Areas (Visual blank, handled by renderHomeBase)
            if ((x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8)) return 'HOME_BASE';

            // Tracks
            return 'TRACK';
        };

        const getCellColor = (x, y) => {
            // Home Runs (Colored Paths)
            if (y === 7 && x >= 1 && x <= 5) return COLORS.RED;     // Red Home Run
            if (x === 7 && y >= 1 && y <= 5) return COLORS.GREEN;   // Green Home Run (Top, usually Green is Top-Right? No, standard is: Red-BL, Blue-TL, Yellow-TR, Green-BR -> Wait.
            // Let's stick to: 
            // 0: Red (Bottom-Left)
            // 1: Green (Top-Left) -> Wait, our logic says 1 is Green. Standard Ludo: Red, Green, Yellow, Blue clockwise.
            // If Red is BL. Clockwise -> Green (TL) -> Yellow (TR) -> Blue (BR).
            // Let's check `renderHomeBase` positions.

            // Based on previous logic:
            // 0: Red, 1: Green, 2: Yellow, 3: Blue

            // Let's configure the home runs based on our index:
            if (y === 7 && x >= 1 && x <= 5) return { bg: COLORS.RED, type: 'HOME_PATH' }; // Red (Left)
            if (x === 7 && y >= 1 && y <= 5) return { bg: COLORS.GREEN, type: 'HOME_PATH' }; // Green (Top)
            if (y === 7 && x >= 9 && x <= 13) return { bg: COLORS.YELLOW, type: 'HOME_PATH' }; // Yellow (Right) - Wait, usually Home path is the middle row/col.
            if (x === 7 && y >= 9 && y <= 13) return { bg: COLORS.BLUE, type: 'HOME_PATH' }; // Blue (Bottom)

            // Safe Spots (Stars)
            if (x === 1 && y === 6) return { bg: COLORS.RED, type: 'START' }; // Red Start
            if (x === 8 && y === 1) return { bg: COLORS.GREEN, type: 'START' }; // Green Start
            if (x === 13 && y === 8) return { bg: COLORS.YELLOW, type: 'START' }; // Yellow Start
            if (x === 6 && y === 13) return { bg: COLORS.BLUE, type: 'START' }; // Blue Start

            // Globe/Star Safe Spots (Non-colored safe spots)
            if ((x === 6 && y === 2) || (x === 12 && y === 6) || (x === 8 && y === 12) || (x === 2 && y === 8)) return { bg: 'white', type: 'SAFE' };

            return { bg: 'white', type: 'NORMAL' };
        };

        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const type = getCellType(x, y);
                if (type === 'HOME_BASE' || type === 'CENTER') continue;

                const cellInfo = getCellColor(x, y);

                cells.push(
                    <View
                        key={`${x}-${y}`}
                        style={{
                            position: 'absolute',
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: cellInfo.bg,
                            borderWidth: 0.5,
                            borderColor: '#94A3B8',
                            left: 20 + x * cellSize,
                            top: 20 + y * cellSize,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {/* Star for Safe Spots */}
                        {(cellInfo.type === 'START' || cellInfo.type === 'SAFE') && (
                            <MaterialCommunityIcons
                                name="star"
                                size={cellSize * 0.7}
                                color={cellInfo.type === 'START' ? 'rgba(255,255,255,0.8)' : '#CBD5E1'}
                            />
                        )}

                        {/* Arrow for Home Entry */}
                        {cellInfo.type === 'HOME_PATH' && (x === 1 || y === 1 || x === 13 || y === 13) && (
                            <MaterialCommunityIcons name={x === 1 ? "arrow-right" : y === 1 ? "arrow-down" : x === 13 ? "arrow-left" : "arrow-up"} size={cellSize * 0.6} color="rgba(255,255,255,0.5)" />
                        )}
                    </View>
                );
            }
        }

        // Add Center Triangle
        cells.push(
            <View key="center-bg" style={{ position: 'absolute', left: 20 + 6 * cellSize, top: 20 + 6 * cellSize, width: 3 * cellSize, height: 3 * cellSize, backgroundColor: 'white' }}>
                {/* Triangles */}
                <View style={{ position: 'absolute', width: 0, height: 0, borderLeftWidth: 1.5 * cellSize, borderRightWidth: 1.5 * cellSize, borderBottomWidth: 1.5 * cellSize, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.BLUE, top: 0, transform: [{ rotate: '180deg' }] }} />
                <View style={{ position: 'absolute', width: 0, height: 0, borderLeftWidth: 1.5 * cellSize, borderRightWidth: 1.5 * cellSize, borderBottomWidth: 1.5 * cellSize, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.GREEN, left: -1.5 * cellSize, top: 0.75 * cellSize, transform: [{ rotate: '90deg' }] }} />
                {/* Simplified Cross for Center - Using SVG or absolute views relative to center */}
                {/* Left Triangle (Red) */}
                <View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderTopWidth: 1.5 * cellSize, borderBottomWidth: 1.5 * cellSize, borderLeftWidth: 1.5 * cellSize, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: COLORS.RED }} />
                {/* Right Triangle (Yellow) */}
                <View style={{ position: 'absolute', right: 0, top: 0, width: 0, height: 0, borderTopWidth: 1.5 * cellSize, borderBottomWidth: 1.5 * cellSize, borderRightWidth: 1.5 * cellSize, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: COLORS.YELLOW }} />
                {/* Top Triangle (Green) */}
                <View style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderLeftWidth: 1.5 * cellSize, borderRightWidth: 1.5 * cellSize, borderTopWidth: 1.5 * cellSize, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.GREEN }} />
                {/* Bottom Triangle (Blue) */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, width: 0, height: 0, borderLeftWidth: 1.5 * cellSize, borderRightWidth: 1.5 * cellSize, borderBottomWidth: 1.5 * cellSize, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.BLUE }} />
            </View>
        );

        return cells;
    };

    // Get token visual positions on board
    const renderBoardTokens = () => {
        const cellSize = (BOARD_SIZE - 40) / 15;
        const tokens = [];

        // Authentic 52-cell board path for Indian Ludo
        // Maps position index to grid coordinates
        const getTokenPosition = (playerIdx, position) => {
            const boardMap = [
                // Red path: positions 0-51
                { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, // 0-5: Home path
                { x: 5, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, // 6-12: Top row to green
                { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, // 13-20: Left side
                { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, // 21-27: Green home
                { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 7 }, // 28-34: Bottom row
                { x: 14, y: 6 }, { x: 14, y: 5 }, { x: 14, y: 4 }, { x: 14, y: 3 }, { x: 14, y: 2 }, { x: 14, y: 1 }, // 35-40: Yellow home
                { x: 14, y: 0 }, { x: 13, y: 0 }, { x: 12, y: 0 }, { x: 11, y: 0 }, { x: 10, y: 0 }, { x: 9, y: 0 }, { x: 8, y: 0 }, { x: 7, y: 0 }, // 41-48: Right side
                { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, // 49-51: Blue home
            ];

            if (position < 0 || position >= boardMap.length) return { x: 7, y: 7 }; // Center
            return boardMap[position];
        };

        playerTokens.forEach((playerTokenArray, pIdx) => {
            playerTokenArray.forEach((pos, tokenIdx) => {
                if (pos === -1) return; // Not on board
                if (pos > 51) return; // Already won (in home)

                const cellPos = getTokenPosition(pIdx, pos);
                const tokenSize = cellSize * 0.5;

                tokens.push(
                    <Pressable
                        key={`token-${pIdx}-${tokenIdx}`}
                        onPress={() => {
                            if (!isPaused && activePlayer === pIdx && canMove && canTokenMove(pIdx, tokenIdx, diceValue, pos)) {
                                moveToken(pIdx, tokenIdx, diceValue);
                            }
                        }}
                        style={{
                            position: 'absolute',
                            width: tokenSize,
                            height: tokenSize,
                            borderRadius: tokenSize / 2,
                            backgroundColor: getColorCode(pIdx),
                            top: 20 + cellPos.y * cellSize + (cellSize - tokenSize) / 2,
                            left: 20 + cellPos.x * cellSize + (cellSize - tokenSize) / 2,
                            borderWidth: 2,
                            borderColor: '#FFF',
                            ...select({
                                ios: {
                                    shadowColor: '#000',
                                    shadowOpacity: 0.4,
                                    shadowRadius: 5,
                                    shadowOffset: { width: 0, height: 2 }
                                },
                                android: {
                                    elevation: 8,
                                },
                                web: {
                                    boxShadow: '0px 2px 5px rgba(0,0,0,0.4)',
                                }
                            }),
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF' }}>{tokenIdx + 1}</Text>
                    </Pressable>
                );
            });
        });

        return tokens;
    };

    // Render colored home areas in corners (authentic design)
    const renderHomeBase = (pIdx, color) => {
        const cellSize = (BOARD_SIZE - 40) / 15;
        // Calculate position based on index (0: BL, 1: TL, 2: TR, 3: BR)
        // Ludo Standard: Red (BL), Green (TL), Yellow (TR), Blue (BR) - Wait, usually:
        // Red (Bottom-Left), Blue (Top-Left), Yellow (Top-Right), Green (Bottom-Right)?
        // Re-checking standard visual: 
        // 0: Bottom-Left (Red)
        // 1: Top-Left (Green in our logic)

        let top = 0, left = 0;
        if (pIdx === 0) { top = 20 + 9 * cellSize; left = 20; }  // Bottom-Left
        else if (pIdx === 1) { top = 20; left = 20; }           // Top-Left
        else if (pIdx === 2) { top = 20; left = 20 + 9 * cellSize; } // Top-Right
        else if (pIdx === 3) { top = 20 + 9 * cellSize; left = 20 + 9 * cellSize; } // Bottom-Right

        const baseSize = 6 * cellSize;

        return (
            <View style={{
                position: 'absolute',
                top: top,
                left: left,
                width: baseSize,
                height: baseSize,
                backgroundColor: color,
                borderWidth: 1,
                borderColor: '#000',
                justifyContent: 'center',
                alignItems: 'center',
                ...select({
                    ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3 },
                    android: { elevation: 5 },
                    web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.2)' }
                })
            }}>
                {/* Inner White Box */}
                <View style={{
                    width: baseSize * 0.7,
                    height: baseSize * 0.7,
                    backgroundColor: '#FFFFFF',
                    borderRadius: baseSize * 0.1,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: baseSize * 0.05
                }}>
                    {[0, 1, 2, 3].map((i) => {
                        const pos = playerTokens[pIdx][i];
                        const isHome = pos === -1;
                        return (
                            <Pressable
                                key={i}
                                onPress={() => {
                                    if (isPaused) return; // FIX: Respect Paused State
                                    if (isHome && activePlayer === pIdx && canMove && diceValue === 6) {
                                        moveToken(pIdx, i, diceValue);
                                        setSelectedToken(null);
                                    } else if (!isHome && activePlayer === pIdx) {
                                        // Already out
                                    }
                                }}
                                style={{
                                    width: '50%',
                                    height: '50%',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <View style={{
                                    width: baseSize * 0.2,
                                    height: baseSize * 0.2,
                                    borderRadius: baseSize * 0.1,
                                    backgroundColor: isHome ? color : 'rgba(0,0,0,0.1)', // Colored if home, empty if out
                                    borderWidth: 2,
                                    borderColor: isHome ? '#DDD' : '#EEE',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    {/* Show Token if Home */}
                                    {isHome && (
                                        <View style={{
                                            width: '70%',
                                            height: '70%',
                                            borderRadius: 999,
                                            backgroundColor: color,
                                            borderWidth: 2,
                                            borderColor: '#FFF',
                                            shadowColor: '#000',
                                            shadowOpacity: 0.3,
                                            shadowRadius: 2,
                                            elevation: 3
                                        }} />
                                    )}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        );
    };

    // --- SETUP SCREEN (MATCHING THEME) ---
    if (isSetup) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
                <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                <View style={styles.setupContainer}>
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: isDarkMode ? '#334155' : '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialCommunityIcons name="dice-5" size={48} color={THEME.textMain} />
                        </View>
                        <Text style={[styles.title, { color: THEME.textMain }]}>Ludo Master</Text>
                        <Text style={{ color: THEME.textAlt, letterSpacing: 2, fontSize: 12, fontWeight: '700' }}>LUDO GAME</Text>
                    </View>

                    <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: THEME.border }]}>
                        {/* 1. MODE */}
                        <Text style={[styles.label, { color: THEME.textAlt }]}>Select Game Mode</Text>
                        <View style={styles.playerRow}>
                            {['system', 'human'].map(mode => (
                                <Pressable key={mode} onPress={() => setGameType(mode)} style={[styles.modeBtn, gameType === mode && { backgroundColor: THEME.btnEqual[0] }]}>
                                    <Text style={[styles.btnText, { color: gameType === mode ? '#FFF' : THEME.textMain, textAlign: 'center' }]}>{mode === 'system' ? "You vs System" : "Multiplayer"}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* 2. PLAYERS */}
                        <Text style={[styles.label, { color: THEME.textAlt }]}>Number of Players</Text>
                        <View style={styles.playerRow}>
                            {[1, 2, 3, 4].map(n => {
                                const disabled = gameType === 'human' && n === 1;
                                return (
                                    <Pressable
                                        key={n}
                                        disabled={disabled}
                                        onPress={() => setNumPlayers(n)}
                                        style={[
                                            styles.playerBtn,
                                            numPlayers === n && { backgroundColor: THEME.btnEqual[0] },
                                            disabled && { opacity: 0.5 }
                                        ]}
                                    >
                                        <Text style={[
                                            styles.btnText,
                                            {
                                                color: numPlayers === n ? '#FFF' : THEME.textMain,
                                                fontSize: 18
                                            }
                                        ]}>
                                            {n}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* 3. DIFFICULTY */}
                        {gameType === 'system' && (
                            <>
                                <Text style={[styles.label, { color: THEME.textAlt }]}>Difficulty</Text>
                                <View style={styles.playerRow}>
                                    {['easy', 'medium', 'hard'].map(level => (
                                        <Pressable key={level} onPress={() => setDifficulty(level)} style={[styles.playerBtn, difficulty === level && { backgroundColor: THEME.btnEqual[0] }]}>
                                            <Text style={[styles.btnText, { color: difficulty === level ? '#FFF' : THEME.textMain, textTransform: 'capitalize', fontSize: 12 }]}>{level}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </>
                        )}

                        <Pressable
                            onPress={() => {
                                playSound('tap');
                                setIsSetup(false);
                            }}
                            style={({ pressed }) => [
                                {
                                    width: '100%',
                                    marginTop: 24,
                                    transform: [{ scale: pressed ? 0.98 : 1 }],
                                    ...Platform.select({
                                        ios: { shadowColor: THEME.btnEqual[0], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
                                        android: { elevation: 8 },
                                        web: { boxShadow: `0px 4px 15px ${THEME.btnEqual[0]}66` }
                                    })
                                }
                            ]}
                        >
                            <LinearGradient
                                colors={isDarkMode ? ['#0EA5E9', '#2563EB'] : ['#38BDF8', '#3B82F6']} // Vibrant Blue Gradient
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 18,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.2)'
                                }}
                            >
                                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 }}>START GAME</Text>
                                <Feather name="play-circle" size={24} color="#FFF" />
                            </LinearGradient>
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => ({
                            position: 'absolute',
                            bottom: 40,
                            paddingVertical: 12,
                            paddingHorizontal: 24,
                            borderRadius: 30,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'center',
                            transform: [{ scale: pressed ? 0.95 : 1 }]
                        })}
                    >
                        <Feather name="log-out" size={18} color={THEME.textAlt} />
                        <Text style={{ color: THEME.textAlt, fontWeight: '600', fontSize: 13, letterSpacing: 0.5 }}>EXIT TO CALCULATOR</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // --- GAME UI ---
    return (
        <View style={[styles.gameContainer, { backgroundColor: THEME.bg, flex: 1 }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* FAB */}
            <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 20) + 10, left: 24, alignItems: 'flex-start', zIndex: 100 }}>
                {isFabOpen && <FabMenuOptions switchGame={switchGame} setIsFabOpen={setIsFabOpen} isDark={isDarkMode} THEME={THEME} currentGame={'ludo'} />}
                <Pressable
                    style={{
                        width: 56, height: 56, borderRadius: 28,
                        backgroundColor: isFabOpen ? THEME.textMain : (isDarkMode ? '#334155' : '#FFFFFF'),
                        justifyContent: 'center', alignItems: 'center',
                        ...Platform.select({
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

            {/* Header */}
            <View style={[styles.header, { height: 60 + insets.top, paddingTop: insets.top, borderBottomColor: THEME.border }]}>
                <Pressable
                    onPress={() => setIsSetup(true)}
                    style={{ position: 'absolute', left: 16, top: insets.top + (60 - 44) / 2, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                >
                    <Feather name="arrow-left" size={24} color={THEME.primary} />
                </Pressable>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: THEME.textMain, letterSpacing: 1.2, fontFamily: 'Outfit_700Bold' }}>LUDO MASTER</Text>

                <Pressable
                    onPress={() => setIsPaused(!isPaused)}
                    style={{ position: 'absolute', right: 60, top: insets.top + (60 - 44) / 2, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                >
                    <Feather name={isPaused ? "play" : "pause"} size={24} color={THEME.textMain} />
                </Pressable>

                <Pressable
                    onPress={() => setShowSettings(true)}
                    style={{ position: 'absolute', right: 16, top: insets.top + (60 - 44) / 2, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                >
                    <Feather name="more-vertical" size={24} color={THEME.textMain} />
                </Pressable>
            </View>

            {/* Game Board */}
            <View style={styles.boardWrapper}>
                <View style={[styles.board, {
                    width: BOARD_SIZE,
                    height: BOARD_SIZE,
                    backgroundColor: isDarkMode ? '#5C4033' : '#D2B48C',
                    borderColor: isDarkMode ? '#3E2723' : '#8B7355',
                    borderWidth: 3,
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                }]}>
                    {isPaused && (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderRadius: 0, zIndex: 100 }]}>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 24, letterSpacing: 4 }}>PAUSED</Text>
                            </View>
                        </View>
                    )}
                    {/* Wooden board texture overlay */}
                    <View style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'transparent',
                        borderRadius: 4,
                        opacity: 0.15,
                    }}
                    />

                    {/* Board cells */}
                    {getBoardCells()}

                    {/* Tokens on board */}
                    {renderBoardTokens()}

                    {/* Center finishing area (star-shaped home) */}
                    <View style={[styles.centerHome, {
                        backgroundColor: isDarkMode ? '#2C2C2C' : '#E8E8E8',
                        borderColor: isDarkMode ? '#1a1a1a' : '#CCCCCC',
                        borderWidth: 2,
                        elevation: 4,
                        shadowColor: '#000',
                        shadowOpacity: 0.3,
                        shadowRadius: 3,
                    }]}>
                        <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="star-circle" size={BOARD_SIZE * 0.09} color="#FFD700" style={{ opacity: 0.7 }} />
                            <Text style={{ fontSize: 8, color: '#FFD700', fontWeight: 'bold', letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' }}>Home</Text>
                        </View>
                    </View>

                    {/* Corners - Home bases for all 4 players */}
                    <View style={[styles.corner, { top: 0, left: 0 }]}>{renderHomeBase(0, COLORS.red)}</View>
                    <View style={[styles.corner, { top: 0, right: 0 }]}>{renderHomeBase(1, COLORS.green)}</View>
                    <View style={[styles.corner, { bottom: 0, right: 0 }]}>{renderHomeBase(2, COLORS.yellow)}</View>
                    <View style={[styles.corner, { bottom: 0, left: 0 }]}>{renderHomeBase(3, COLORS.blue)}</View>
                </View>
            </View>

            {/* Footer Controls */}
            <View style={[styles.controls, { backgroundColor: isDarkMode ? '#1e293b' : '#FFF', borderTopColor: THEME.border }]}>
                <View style={styles.playerInfo}>
                    <View style={[styles.avatar, { backgroundColor: getColorCode(activePlayer) }]}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>{getColorName(activePlayer)[0]}</Text>
                    </View>
                    <View>
                        <Text style={[styles.turnText, { color: THEME.textMain }]}>{getColorName(activePlayer)}'s Turn</Text>
                        <Text style={[styles.statusText, { color: THEME.textAlt }]}>
                            {canMove ? 'Tap a token to move' : (rolling ? 'Rolling...' : 'Roll Dice')}
                        </Text>
                    </View>
                </View>

                <Dice
                    value={diceValue}
                    rolling={rolling}
                    color={getColorCode(activePlayer)}
                    onRoll={handleRollDice}
                    disabled={(gameType === 'system' && activePlayer !== 0) || (diceValue !== null && !canMove) || winners.includes(activePlayer)}
                    isPaused={isPaused}
                    THEME={THEME}
                />
            </View>

            {/* SETTINGS MODAL (GLASSMORPHISM) */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showSettings}
                onRequestClose={() => setShowSettings(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowSettings(false)}>
                    <TouchableWithoutFeedback>
                        <View style={[
                            styles.modalContent,
                            {
                                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)',
                                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                                overflow: 'hidden',
                            }
                        ]}>
                            <BlurView intensity={50} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={isDarkMode ? ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.2)'] : ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)']}
                                style={StyleSheet.absoluteFill}
                            />

                            <Text style={[styles.modalTitle, { color: THEME.textMain }]}>Ludo Settings</Text>

                            <Text style={[styles.sectionTitle, { color: THEME.textAlt }]}>Appearance</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, width: '100%' }}>
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

                            <View style={{ width: '100%', borderBottomWidth: 1, borderBottomColor: THEME.border, marginBottom: 8 }} />
                            <Text style={[styles.sectionTitle, { color: THEME.textAlt }]}>Data</Text>
                            <Pressable
                                style={[styles.modalButton, { borderColor: THEME.border, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                                onPress={() => updateSavePreference(!savePreference)}
                            >
                                <Text style={[styles.modalButtonText, { color: THEME.textMain }]}>Save Game</Text>
                                <Feather name={savePreference ? "check-circle" : "circle"} size={20} color={savePreference ? '#FF4B4B' : THEME.textAlt} />
                            </Pressable>

                            <Pressable
                                style={[styles.modalButton, { marginTop: 20, borderColor: '#ed293dff', borderWidth: 1, backgroundColor: 'rgba(237, 41, 61, 0.1)' }]}
                                onPress={() => setShowSettings(false)}
                            >
                                <Text style={{ color: '#ed293dff', fontWeight: 'bold' }}>Close</Text>
                            </Pressable>
                        </View>
                    </TouchableWithoutFeedback>
                </Pressable>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontFamily: 'Outfit_700Bold', fontWeight: '900', marginBottom: 4 },
    card: { width: '85%', padding: 24, borderRadius: 24, borderWidth: 1 },
    label: { fontSize: 13, textTransform: 'uppercase', marginBottom: 12, fontWeight: '700', letterSpacing: 1 },
    playerRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    playerBtn: { flex: 1, backgroundColor: 'rgba(100,116,139,0.2)', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modeBtn: { flex: 1, backgroundColor: 'rgba(100,116,139,0.2)', padding: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
    btnText: { fontWeight: 'bold' },
    startBtn: { padding: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 },
    startBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    backBtn: { position: 'absolute', bottom: 40, flexDirection: 'row', gap: 8, alignItems: 'center' },

    // Game Styles
    gameContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: 1, fontWeight: '900' },
    iconBtn: { padding: 8 },

    boardWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
    board: { borderRadius: 4, padding: 15, elevation: 5 },
    corner: { position: 'absolute', width: '40%', height: '40%', padding: 5 },
    baseBox: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 4 },
    baseInner: { flex: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    baseTokenGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '60%', height: '60%', justifyContent: 'space-between', alignContent: 'space-between' },
    tokenBaseContainer: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
    token: { width: 20, height: 20, borderRadius: 10, elevation: 2 },
    emptyTokenSlot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.1)' },
    glow: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#FFF' },
    centerHome: { position: 'absolute', width: '20%', height: '20%', top: '40%', left: '40%' },

    controls: { padding: 24, borderTopWidth: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    turnText: { fontSize: 16, fontWeight: 'bold' },
    statusText: { fontSize: 12 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', maxWidth: 340, padding: 16, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', marginBottom: 12 },
    sectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', alignSelf: 'flex-start' },
    themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8, borderColor: '#475569' },
    themeOptionText: { fontSize: 11, fontWeight: '700' },
    modalButton: { width: '100%', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
    modalButtonText: { fontSize: 14, fontWeight: '600' }
});