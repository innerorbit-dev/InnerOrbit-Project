import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Animated } from 'react-native';
import { isWeb } from '../utils/platform';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// layout constants
const KEY_MARGIN = 3;
const KEYBOARD_PADDING = 5;
const ROW_WIDTH = SCREEN_WIDTH - (KEYBOARD_PADDING * 2);

const LAYOUTS = {
  qwerty: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACKSPACE'],
    ['123', 'SPACE', 'SEND']
  ],
  symbols: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['#+=', '.', ',', '?', '!', "'", 'BACKSPACE'],
    ['ABC', 'SPACE', 'SEND']
  ],
  alt_symbols: [
    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
    ['123', '.', ',', '?', '!', "'", 'BACKSPACE'],
    ['ABC', 'SPACE', 'SEND']
  ]
};

const Key = ({ label, onPress, flex = 1, isAction = false, isShiftActive = false, theme }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      friction: 4
    }).start();
    if (!isWeb) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4
    }).start();
  };

  const renderLabel = () => {
    if (label === 'BACKSPACE') return <Feather name="delete" size={20} color="#fff" />;
    if (label === 'SHIFT') return <Feather name="arrow-up" size={20} color={isShiftActive ? '#3B82F6' : '#fff'} />;
    if (label === 'SPACE') return <MaterialCommunityIcons name="keyboard-space" size={20} color="#fff" />;
    if (label === 'SEND') return <MaterialCommunityIcons name="send" size={20} color="#fff" />;
    
    let displayLabel = label;
    if (!isAction && isShiftActive) displayLabel = label.toUpperCase();
    
    return <Text style={[styles.keyText, { color: isAction ? '#94A3B8' : '#fff' }]}>{displayLabel}</Text>;
  };

  return (
    <Animated.View style={{ flex, transform: [{ scale }], margin: KEY_MARGIN }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(label)}
        style={({ pressed }) => [
          styles.key,
          {
            backgroundColor: isAction ? 'rgba(255,255,255,0.08)' : (pressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'),
            borderColor: isShiftActive && label === 'SHIFT' ? '#3B82F6' : 'rgba(255,255,255,0.1)'
          }
        ]}
      >
        {renderLabel()}
      </Pressable>
    </Animated.View>
  );
};

export const StealthKeyboard = ({ onKeyPress, onBackspace, onSend, visible }) => {
  const [currentLayout, setCurrentLayout] = useState('qwerty');
  const [isShiftActive, setIsShiftActive] = useState(false);
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const handleKeyPress = (key) => {
    if (key === 'SHIFT') {
      setIsShiftActive(!isShiftActive);
    } else if (key === 'BACKSPACE') {
      onBackspace();
    } else if (key === 'SEND') {
      onSend();
    } else if (key === '123') {
      setCurrentLayout('symbols');
    } else if (key === 'ABC') {
      setCurrentLayout('qwerty');
    } else if (key === '#+=') {
      setCurrentLayout('alt_symbols');
    } else if (key === 'SPACE') {
      onKeyPress(' ');
    } else {
      onKeyPress(isShiftActive ? key.toUpperCase() : key.toLowerCase());
      // Auto-unlock shift after one key press if not caps-locked? 
      // For now just stay as is
    }
  };

  const renderRow = (row, rowIndex) => {
    return (
      <View key={rowIndex} style={styles.row}>
        {row.map((key, index) => {
          let flex = 1;
          let isAction = false;
          
          if (['SHIFT', 'BACKSPACE', '123', 'ABC', '#+=', 'SEND'].includes(key)) {
            isAction = true;
            flex = 1.4;
          }
          if (key === 'SPACE') flex = 4;

          return (
            <Key
              key={index}
              label={key}
              onPress={handleKeyPress}
              flex={flex}
              isAction={isAction}
              isShiftActive={isShiftActive}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.keyboard}>
        {LAYOUTS[currentLayout].map((row, index) => renderRow(row, index))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  keyboard: {
    padding: KEYBOARD_PADDING,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  key: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#fff',
  }
});
