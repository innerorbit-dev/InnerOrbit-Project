/** Purpose: Main Calculator component with stealth features and multi-mode support (Scientific, MBA, CAT). */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Alert, Modal, FlatList, TouchableWithoutFeedback, Animated, ScrollView, Vibration, PanResponder } from "react-native";
import { isWeb, isIOS, isAndroid, select } from "../utils/platform";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { UpdateManager } from "../lib/update-manager";
import { useAuth } from "../context/auth-context";
import { useAppTheme } from "../store/themeStore";
import { AuthProtector, StealthCodeProtector } from '../lib/security-utils';
import UpdateScreen from "./updates/UpdateScreen";
import * as Haptics from 'expo-haptics';
import { Logger } from "../lib/logger";

// ===== HELPER FUNCTIONS =====  
const gcd = (a, b) => (!b ? a : gcd(b, a % b));
const lcm = (a, b) => (a * b) / gcd(b, a % b);

const safeEvaluate = (expression, mode = 'deg') => {
  try {
    // Whitelist allowed characters for security
    // Allows numbers, operators, dots, parentheses, brackets, and math function names
    const whitelist = /[0-9+\-*/.()\[\]{}|^√πe% \s,]|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|asinh|acosh|atanh|log|ln|logb|fact|nPr|nCr|sqrt|cbrt|abs|nroot|Math/g;
    
    // Explicitly block sensitive JS keywords and property access
    const blacklisted = /constructor|__proto__|prototype|eval|Function|window|global|process|require|import/i;
    
    if (blacklisted.test(expression)) {
      Logger.warn('[Calculator] Blocked blacklisted keyword in expression:', expression);
      return "Error";
    }

    const sanitizedExpr = expression.match(whitelist)?.join('') || '';

    if (sanitizedExpr !== expression.replace(/\s/g, '')) {
      // If original (without spaces) differs from sanitized, it might contain malicious code
      Logger.warn('[Calculator] Blocked potentially unsafe expression:', expression);
      return "Error";
    }

    let expr = sanitizedExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\^/g, '**')
      .replace(/[[{]/g, '(')
      .replace(/[\]}]/g, ')')
      .replace(/\|([^|]+)\|/g, 'Math.abs($1)')
      .replace(/(\d)\(/g, '$1*(') // Implicit multiplication: 2(3) -> 2*(3)
      .replace(/\)(\d)/g, ')*$1') // Implicit multiplication: )3 -> )*3
      .replace(/%/g, '/100')      // Percentage: 50% -> 50/100
      .replace(/(\d+)√(\d+)/g, 'nroot($1,$2)')
      .replace(/(\d+)√\(([^)]+)\)/g, 'nroot($1,$2)')
      .replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)')
      .replace(/√(\d+)/g, 'Math.sqrt($1)');

    // Auto-close parentheses
    const openParens = (expr.match(/\(/g) || []).length;
    const closeParens = (expr.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      expr += ')'.repeat(openParens - closeParens);
    }

    const toRad = (x) => mode === 'deg' ? x * (Math.PI / 180) : x;
    const toDeg = (x) => mode === 'deg' ? x * (180 / Math.PI) : x;

    const scope = {
      sin: (x) => Math.sin(toRad(x)),
      cos: (x) => Math.cos(toRad(x)),
      tan: (x) => Math.tan(toRad(x)),
      asin: (x) => toDeg(Math.asin(x)),
      acos: (x) => toDeg(Math.acos(x)),
      atan: (x) => toDeg(Math.atan(x)),
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      asinh: Math.asinh,
      acosh: Math.acosh,
      atanh: Math.atanh,
      log: Math.log10,
      ln: Math.log,
      logb: (b, x) => Math.log(x) / Math.log(b),
      fact: (n) => {
        if (n < 0) return NaN;
        if (n === 0) return 1;
        let res = 1;
        for (let i = 1; i <= n; i++) res *= i;
        return res;
      },
      nPr: (n, r) => {
        if (n < r) return 0;
        const f = (x) => { let v = 1; for (let i = 1; i <= x; i++)v *= i; return v; };
        return f(n) / f(n - r);
      },
      nCr: (n, r) => {
        if (n < r) return 0;
        const f = (x) => { let v = 1; for (let i = 1; i <= x; i++)v *= i; return v; };
        return f(n) / (f(r) * f(n - r));
      },
      sqrt: Math.sqrt,
      cbrt: Math.cbrt,
      nroot: (y, x) => Math.pow(x, 1 / y),
      abs: Math.abs,
      Math: Math
    };

    const keys = Object.keys(scope);
    const values = Object.values(scope);
    const func = new Function(...keys, `return ${expr};`);
    const result = func(...values);

    // Fix Floating Point Precision (e.g. 0.1 + 0.2 = 0.3)
    const precision = 10000000000; // 10 decimal places
    return Math.round(result * precision) / precision;
  } catch (e) {
    return "Error";
  }
};

const computeTVM = (target, values) => {
  let { n, i, pv, pmt, fv } = values;
  const r = i / 100;
  try {
    if (target === 'FV') {
      if (r === 0) return -(pv + pmt * n);
      const factor = Math.pow(1 + r, n);
      const res = -(pv * factor + pmt * (factor - 1) / r);
      return res || 0;
    }
    if (target === 'PV') {
      if (r === 0) return -(fv + pmt * n);
      const factor = Math.pow(1 + r, n);
      const numerator = fv + pmt * (factor - 1) / r;
      return -(numerator / factor) || 0;
    }
    if (target === 'PMT') {
      if (r === 0) return -(pv + fv) / n;
      const factor = Math.pow(1 + r, n);
      const denominator = (factor - 1) / r;
      return - (pv * factor + fv) / denominator || 0;
    }
  } catch (e) { return 0; }
  return 0;
};

const calculate = (prev, current, op) => {
  let result = current;
  switch (op) {
    case "+": result = prev + current; break;
    case "-": result = prev - current; break;
    case "*": result = prev * current; break;
    case "/":
      if (current === 0) return "Error";
      result = prev / current;
      break;
    case "^": result = Math.pow(prev, current); break;
    case "LCM": result = lcm(prev, current); break;
    case "HCF": result = gcd(prev, current); break;
  }
  const precision = 1000000000;
  return Math.round(result * precision) / precision;
};

// Helper: Thousands Separator
const formatNumber = (numStr) => {
  if (!numStr || isNaN(parseFloat(numStr))) return numStr;
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
};

// Helper: Animated Ghost Line for Unit Preview
const AnimatedGhostLine = ({ display, THEME }) => {
  const [context, setContext] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Context Helper: Provide Hex/Binary/Currency etc.
    const getGhostContext = (val) => {
      if (!val || val === '0' || val === 'Error' || val === 'Infinity' || val === 'NaN') return null;
      const cleanVal = val.replace(/,/g, '');
      const num = parseFloat(cleanVal);
      if (isNaN(num)) return null;

      // If it's a whole number, show Hex/Binary
      if (Number.isInteger(num) && num > 0 && num < 1000000000) {
        return `HEX: 0x${num.toString(16).toUpperCase()}  |  BIN: ${num.toString(2)}`;
      }

      // If it looks like a larger number, currency estimate
      if (num >= 1000) {
        return `EST: $${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      return null;
    };

    const newContext = getGhostContext(display);

    if (newContext !== context) {
      if (newContext) {
        setContext(newContext);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: !isWeb }).start();
      } else {
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: !isWeb }).start(() => {
          setContext(null);
        });
      }
    }
  }, [display, context]);

  if (!context) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Text style={{
        color: THEME.textAlt,
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
        letterSpacing: 0.8,
        opacity: 0.5
      }}>
        {context}
      </Text>
    </Animated.View>
  );
};

// Helper: Syntax Highlighting & Natural Math Rendering
const renderHighlightedExpression = (expression, THEME, isDark, fontSize, cursorPos, isTablet) => {
  if (!expression || expression === "0") {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: THEME.textMain, fontSize, fontWeight: '400' }}>0</Text>
        {(cursorPos === 0 || cursorPos === null) && <Cursor THEME={THEME} fontSize={fontSize} />}
      </View>
    );
  }
  if (expression === "Error" || expression === "Infinity" || expression === "NaN") return <Text style={{ color: '#ef4444', fontSize }}>{expression}</Text>;

  const effectiveCursor = cursorPos === null ? expression.length : cursorPos;

  // Symbol Mapping for a professional look
  const symbolMap = {
    '*': '×',
    '/': '÷',
    '-': '−', // Proper minus sign
    'sqrt': '√',
    'pi': 'π'
  };

  const renderToken = (token, color, fontWeight, key, isSuperscript = false) => {
    const displayText = symbolMap[token] || token;
    return (
      <View key={key} style={{ marginTop: isSuperscript ? -fontSize * 0.45 : 0 }}>
        <Text style={{
          color,
          fontSize: isSuperscript ? fontSize * 0.65 : fontSize,
          fontWeight
        }}>
          {displayText}
        </Text>
      </View>
    );
  };

  // Improved Tokenization to catch functions and operators separately
  const tokens = expression.split(/([+\-*/%^()])|(\d+\.?\d*)|(sqrt|pi|[a-z]+)/gi).filter(Boolean);
  const opColor = isDark ? '#A855F7' : '#9333EA';
  const funcColor = isDark ? '#22d3ee' : '#0891b2';

  let currentIdx = 0;
  const elements = [];
  let cursorRendered = false;
  let isNextSuperscript = false;

  tokens.forEach((token, index) => {
    let color = THEME.textMain;
    let fontWeight = '400';
    let isSymbol = false;

    if (/[+\-*/%^()]/.test(token)) {
      color = opColor;
      fontWeight = '700';
      isSymbol = true;
    } else if (/sqrt|pi|[a-z]+/i.test(token)) {
      color = funcColor;
    }

    // Determine if this token should be superscripted
    const activeSuperscript = isNextSuperscript;

    // If current token is '^', next one will be superscripted (and we hide '^')
    if (token === '^') {
      isNextSuperscript = true;
      currentIdx += 1; // Count '^' in index for cursor logic
      return;
    } else if (activeSuperscript && !/[0-9.]/.test(token)) {
      // End superscript if we hit a non-number/operator
      isNextSuperscript = false;
    }

    const tokenStart = currentIdx;
    const tokenEnd = currentIdx + token.length;

    if (!cursorRendered && effectiveCursor >= tokenStart && effectiveCursor <= tokenEnd) {
      const relativePos = effectiveCursor - tokenStart;
      const before = token.slice(0, relativePos);
      const after = token.slice(relativePos);

      if (before) elements.push(renderToken(before, color, fontWeight, `t-${index}-b`, activeSuperscript));
      elements.push(<Cursor key="ghost-cursor" THEME={THEME} fontSize={activeSuperscript ? fontSize * 0.65 : fontSize} isSuperscript={activeSuperscript} />);
      cursorRendered = true;
      if (after) elements.push(renderToken(after, color, fontWeight, `t-${index}-a`, activeSuperscript));
    } else {
      elements.push(renderToken(token, color, fontWeight, `t-${index}`, activeSuperscript));
    }

    currentIdx = tokenEnd;

    // Auto-disable superscript after numbers if next is non-number
    // (Simple logic: power usually applies to the next number sequence)
  });

  if (!cursorRendered) {
    elements.push(<Cursor key="ghost-cursor-end" THEME={THEME} fontSize={fontSize} />);
  }

  return elements;
};

const Cursor = ({ THEME, fontSize, isSuperscript }) => {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0, duration: 500, useNativeDriver: !isWeb }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: !isWeb }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View style={{
      width: 2,
      height: fontSize * (isSuperscript ? 0.7 : 0.85),
      backgroundColor: '#fb7185', // Shared Rose Pink for Cursor
      opacity: blinkAnim,
      marginHorizontal: 1,
      marginTop: isSuperscript ? -fontSize * 0.35 : 0,
      borderRadius: 1,
    }} />
  );
};

// Helper: Glowing Border Effect for Stealth Entry
const StealthGlow = ({ active, THEME }) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: !isWeb }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: !isWeb }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [active]);

  if (!active) return null;

  return (
    <Animated.View 
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderColor: THEME.primary,
          borderWidth: 2,
          borderRadius: 24,
          opacity: glowAnim,
          shadowColor: THEME.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 15,
          zIndex: 10
        }
      ]}
    />
  );
};

// ===== UI COMPONENTS =====

const CalcButton = React.memo(({ label, type = "number", onPress, onLongPress, style, textStyle, THEME, isTablet, isDark }) => {
  let colors = THEME.btnNumber;
  let baseText = THEME.textMain;
  let fontSize = isTablet ? 34 : 24;

  if (type === "equal") {
    colors = THEME.btnEqual;
    baseText = "#FFF";
  } else if (type === "op") {
    colors = THEME.btnOp;
    baseText = "#FFF";
  } else if (type === "top") {
    colors = THEME.btnTop;
    baseText = isDark ? "#0F172A" : "#FFFFFF";
  } else if (type === "sci" || type === "func" || type === "constant") {
    colors = THEME.btnSci;
    baseText = THEME.textMain;
    fontSize = isTablet ? 22 : 16;
  }

  // Unique AC Color (Orange Gradient)
  if (label === "AC") {
    colors = isDark ? ['#ea580c', '#c2410c'] : ['#fb923c', '#ea580c'];
    baseText = "#FFF";
  }

  if (type === "number") fontSize = isTablet ? 34 : 24;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300} // Snappier long press
      style={({ pressed }) => [
        styles.calcBtn,
        style,
        pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 4 }]}
      />
      <Text style={[styles.calcBtnText, { color: baseText, fontSize }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
});

const Keypad = React.memo(({ calcMode, btnSize, handlePress, handleEmergencyReset, THEME, isTablet, isDark, memory, setDisplay, degMode, isSecond, setIsSecond }) => {
  const isBasic = calcMode === 'basic';

  // Calculate Heights based on btnSize
  let basicHeight = 68; // Default Medium
  let denseHeight = 48; // Default Medium
  let sciRowHeight = 32;

  if (btnSize === 'small') {
    basicHeight = 60;
    denseHeight = 40;
    sciRowHeight = 30;
  }
  if (btnSize === 'large') {
    basicHeight = 80;
    denseHeight = 56;
    sciRowHeight = 36;
  }

  const dynamicRowStyle = { ...styles.calcRow, height: basicHeight };
  const dynamicDenseStyle = { ...styles.calcRowDense, height: denseHeight };
  const dynamicSciStyle = { ...styles.calcRowDense, height: sciRowHeight };

  // Standard rows use 'rowStyle' variable
  const rowStyle = isBasic ? dynamicRowStyle : dynamicDenseStyle;

  // Use smaller font for standard buttons in non-basic modes
  const textStyle = isBasic ? undefined : styles.calcBtnTextDense;

  // Helper to reduce prop drilling boilerplate (Now Stable)
  const renderBtn = (l, t, opVal, typeVal, s, ts, lp) => (
    <CalcButton
      key={l}
      label={l}
      type={t}
      onPress={() => handlePress(opVal || l, typeVal || t)}
      onLongPress={lp}
      style={s}
      textStyle={ts}
      THEME={THEME}
      isTablet={isTablet}
      isDark={isDark}
    />
  );

  return (
    <>
      {/* SCIENTIFIC ROWS */}
      {calcMode === 'sci' && (
        <>
          <View style={dynamicSciStyle}>
            {renderBtn("2nd", "sci", null, "toggle_2nd", { backgroundColor: isSecond ? '#f59e0b' : '#334155' }, styles.calcBtnTextSmall, () => setIsSecond(!isSecond))}
            {renderBtn(degMode.toUpperCase(), "sci", "DEG", "deg", { backgroundColor: '#0ea5e9' }, styles.calcBtnTextSmall)}
            {renderBtn("[", "sci", "[", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("]", "sci", "]", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("|x|", "sci", "|", "sci", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn(isSecond ? "asin" : "sin", "sci", isSecond ? "asin" : "sin", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "acos" : "cos", "sci", isSecond ? "acos" : "cos", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "atan" : "tan", "sci", isSecond ? "atan" : "tan", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "10^x" : "log", "sci", isSecond ? "10^" : "log", isSecond ? "op" : "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "e^x" : "ln", "sci", isSecond ? "e^" : "ln", isSecond ? "op" : "sci_func", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn(isSecond ? "asinh" : "sinh", "sci", isSecond ? "asinh" : "sinh", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "acosh" : "cosh", "sci", isSecond ? "acosh" : "cosh", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "atanh" : "tanh", "sci", isSecond ? "atanh" : "tanh", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "{" : "nPr", "sci", isSecond ? "{" : "nPr", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "}" : "nCr", "sci", isSecond ? "}" : "nCr", "sci_func", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn(isSecond ? "√" : "x²", "func", isSecond ? "sqrt" : "^2", isSecond ? "sci_func" : "op", null, styles.calcBtnTextSmall)}
            {renderBtn(isSecond ? "3√" : "x³", "func", isSecond ? "cbrt" : "^3", isSecond ? "sci_func" : "op", null, styles.calcBtnTextSmall)}
            {renderBtn("y√x", "sci", "√", "op", null, styles.calcBtnTextSmall)}
            {renderBtn("xⁿ", "sci", "^", "op", null, styles.calcBtnTextSmall)}
            {renderBtn("(", "sci", "(", "sci", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn(")", "sci", ")", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("e", "constant", "e", "constant", null, styles.calcBtnTextSmall)}
            {renderBtn("π", "constant", "π", "constant", null, styles.calcBtnTextSmall)}
            {renderBtn("x!", "func", "fact", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn("1/x", "sci", "1/x", "func", null, styles.calcBtnTextSmall)}
          </View>
        </>
      )}

      {/* MBA (FINANCE) ROWS */}
      {calcMode === 'mba' && (
        <>
          {/* TVM Keys */}
          <View style={dynamicDenseStyle}>
            {renderBtn("N", "sci", "N", "tvm", null, styles.calcBtnTextDense)}
            {renderBtn("I/Y", "sci", "I/Y", "tvm", null, styles.calcBtnTextDense)}
            {renderBtn("PV", "sci", "PV", "tvm", null, styles.calcBtnTextDense)}
            {renderBtn("PMT", "sci", "PMT", "tvm", null, styles.calcBtnTextDense)}
            {renderBtn("FV", "sci", "FV", "tvm", null, styles.calcBtnTextDense)}
          </View>
          {/* Finance Keys */}
          <View style={dynamicDenseStyle}>
            {renderBtn("CPT", "sci", "CPT", "tvm", { backgroundColor: '#e11d48' }, styles.calcBtnTextDense)}
            {renderBtn("√", "func", "√", "func", null, styles.calcBtnTextDense)}
            {renderBtn("1/x", "func", "1/x", "func", null, styles.calcBtnTextDense)}
          </View>
        </>
      )}

      {/* CAT (EXAM) ROWS */}
      {calcMode === 'cat' && (
        <>
          <View style={dynamicSciStyle}>
            {renderBtn("(", "sci", "(", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn(")", "sci", ")", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("[", "sci", "[", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("]", "sci", "]", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("|x|", "sci", "|", "sci", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn("{", "sci", "{", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("}", "sci", "}", "sci", null, styles.calcBtnTextSmall)}
            {renderBtn("x²", "func", "x²", "func", null, styles.calcBtnTextSmall)}
            {renderBtn("x³", "func", "^3", "op", null, styles.calcBtnTextSmall)}
            {renderBtn("xⁿ", "sci", "^", "op", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn("√", "func", "√", "func", null, styles.calcBtnTextSmall)}
            {renderBtn("3√", "sci", "cbrt", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn("y√x", "sci", "√", "op", null, styles.calcBtnTextSmall)}
            {renderBtn("1/x", "sci", "1/x", "func", null, styles.calcBtnTextSmall)}
            {renderBtn("x!", "func", "fact", "sci_func", null, styles.calcBtnTextSmall)}
          </View>
          <View style={dynamicSciStyle}>
            {renderBtn("log", "func", "log", "func", null, styles.calcBtnTextSmall)}
            {renderBtn("nPr", "sci", "nPr", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn("nCr", "sci", "nCr", "sci_func", null, styles.calcBtnTextSmall)}
            {renderBtn("LCM", "sci", "LCM", "op", null, styles.calcBtnTextSmall)}
            {renderBtn("HCF", "sci", "HCF", "op", null, styles.calcBtnTextSmall)}
          </View>
        </>
      )}

      {/* Standard Rows (Adjusted for Modes) */}
      <View style={rowStyle}>
        {renderBtn("AC", "top", null, "clear", null, textStyle, handleEmergencyReset)}
        {renderBtn("⌫", "top", null, "delete", null, textStyle)}
        {renderBtn("%", "top", null, "percent", null, textStyle)}
        {renderBtn("/", "op", "/", "op", null, textStyle)}
      </View>
      <View style={rowStyle}>
        {renderBtn("7", "number", "7", "number", null, textStyle)}
        {renderBtn("8", "number", "8", "number", null, textStyle)}
        {renderBtn("9", "number", "9", "number", null, textStyle)}
        {renderBtn("×", "op", "*", "op", null, textStyle)}
      </View>
      <View style={rowStyle}>
        {renderBtn("4", "number", "4", "number", null, textStyle)}
        {renderBtn("5", "number", "5", "number", null, textStyle)}
        {renderBtn("6", "number", "6", "number", null, textStyle)}
        {renderBtn("-", "op", "-", "op", null, textStyle)}
      </View>
      <View style={rowStyle}>
        {renderBtn("1", "number", "1", "number", null, textStyle)}
        {renderBtn("2", "number", "2", "number", null, textStyle)}
        {renderBtn("3", "number", "3", "number", null, textStyle)}
        {renderBtn("+", "op", "+", "op", null, textStyle)}
      </View>
      <View style={rowStyle}>
        {renderBtn("0", "number", "0", "number", { flex: 2, aspectRatio: 'auto' }, textStyle)}
        {renderBtn(".", "number", ".", "number", null, textStyle)}
        {renderBtn("=", "equal", "=", "equal", null, textStyle)}
      </View>
    </>
  );
});

// ===== MAIN COMPONENT =====
export default React.memo(function CalculatorComponent({ onSwitchMode, setIsHistoryOpen, themeProps }) {
  const { THEME, isDark, themePreference, toggleTheme, platformType, savePreference, updateSavePreference } = themeProps;
  const { triggerStealthUnlock } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = isWeb ? width > height : false;
  const isTablet = width > 768;

  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState("");
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [newNumber, setNewNumber] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  // Calculator State
  const [calcMode, setCalcMode] = useState('basic'); // 'basic', 'sci', 'mba', 'cat'
  const [tvm, setTvm] = useState({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });
  const [memory, setMemory] = useState(0);
  const [isComputing, setIsComputing] = useState(false); // For CPT key
  const [calcHistory, setCalcHistory] = useState([]); // Persistent history
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showMCAModal, setShowMCAModal] = useState(false); // New state for MCA popup
  const [showUpdate, setShowUpdate] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); // Track touchable state
  const [btnSize, setBtnSize] = useState('medium'); // Default 'medium' as requested
  const [degMode, setDegMode] = useState('deg');
  const [liveResult, setLiveResult] = useState("");
  const [cursorPos, setCursorPos] = useState(null);
  const [isSecond, setIsSecond] = useState(false); // 2nd Function Toggle
  const isBasic = calcMode === 'basic';

  // Load Button Size specific to current mode
  useEffect(() => {
    const loadBtnSize = async () => {
      try {
        const savedSize = await AsyncStorage.getItem(`btnSize_${calcMode}`);
        if (savedSize) setBtnSize(savedSize);
        else setBtnSize('medium'); // Default fallback
      } catch (e) {
        Logger.log("Failed to load button size");
      }
    };
    loadBtnSize();
  }, [calcMode]);

  const updateBtnSize = async (size) => {
    setBtnSize(size);
    try {
      await AsyncStorage.setItem(`btnSize_${calcMode}`, size);
    } catch (e) {
      Logger.log("Failed to save button size");
    }
  };

  // Card Flip Animation State
  const flipAnim = useRef(new Animated.Value(0)).current;
  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  // Display ScrollView Ref for auto-scroll
  const displayScrollRef = useRef(null);

  // Auto-scroll to end when display changes
  useEffect(() => {
    if (displayScrollRef.current) {
      displayScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [display]);

  const flipToHistory = () => {
    setIsFlipped(true); // Enable Back Face touches
    if (setIsHistoryOpen) setIsHistoryOpen(true);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 1, friction: 8, tension: 10 }).start();
  };
  const flipToCalculator = () => {
    setIsFlipped(false); // Enable Front Face touches
    if (setIsHistoryOpen) setIsHistoryOpen(false);
    Animated.spring(flipAnim, { useNativeDriver: !isWeb, toValue: 0, friction: 8, tension: 10 }).start();
  };

  // Stealth Settings
  const longPressTimerRef = useRef(null); // Silent Timer Ref
  const [stealthConfig, setStealthConfig] = useState({
    mode: 'header_lock', // default: 'header_lock', 'code', 'display_long', 'display_triple'
    code: '7331' // default magic code if mode is 'code'
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedMode = await AsyncStorage.getItem("stealthMode");
        const savedCode = await AsyncStorage.getItem("stealthCode");
        const savedBtn = await AsyncStorage.getItem("stealthButton");

        setStealthConfig({
          mode: savedMode || 'header_lock',
          code: savedCode || '7331',
          button: savedBtn || 'display'
        });

        // Load Calculator State if savePreference is on
        if (savePreference) {
          const m = await AsyncStorage.getItem("lastCalcMode");
          const d = await AsyncStorage.getItem("lastDisplay");
          const h = await AsyncStorage.getItem("lastHistory");
          if (m) setCalcMode(m);
          if (d) { setDisplay(d); setNewNumber(false); }
          if (h) setHistory(h);
        }

      } catch (e) {
        Logger.log("Failed to load settings");
      }
    };
    loadSettings();
  }, [savePreference]);

  // Save Calculator State
  useEffect(() => {
    if (savePreference) {
      const timeoutId = setTimeout(() => {
        const safeSave = async (key, val) => {
          try {
            await AsyncStorage.setItem(key, val);
          } catch (e) {
            Logger.warn(`[Calculator] Failed to save ${key}:`, e.message);
          }
        };
        safeSave("lastCalcMode", calcMode);
        safeSave("lastDisplay", display);
        safeSave("lastHistory", history);
      }, 500); // Debounce saves to prevent lag on typing
      return () => clearTimeout(timeoutId);
    }
  }, [calcMode, display, history, savePreference]);

  // Live Preview Logic
  useEffect(() => {
    const operators = ['+', '-', '*', '/', '%', '^', 'LCM', 'HCF'];
    const sciFunctions = ['sin', 'cos', 'tan', 'log', 'ln', 'abs', 'fact', 'sqrt', 'cbrt', '√'];
    const hasOperation = operators.some(op => display.includes(op)) ||
      sciFunctions.some(func => display.includes(func)) ||
      /[()\[\]{}]/.test(display);
    const lastChar = display.slice(-1);
    const isReady = hasOperation && !operators.includes(lastChar) && display !== "Error";

    if (isReady) {
      try {
        const res = safeEvaluate(display, degMode);
        if (res !== "Error" && String(res) !== display) {
          setLiveResult("= " + res);
        } else {
          setLiveResult("");
        }
      } catch (e) {
        setLiveResult("");
      }
    } else {
      setLiveResult("");
    }
  }, [display, degMode]);

  // Stealth Refs
  const lastTapRef = useRef(0);
  const tapCountRef = useRef(0);
  const versionTapRef = useRef({ count: 0, lastTime: 0 });

  // Performance Optimization: Refs for stable callbacks
  const displayRef = useRef(display);
  const newNumberRef = useRef(newNumber);
  const degModeRef = useRef(degMode);
  const stealthConfigRef = useRef(stealthConfig);
  const cursorPosRef = useRef(cursorPos);

  useEffect(() => {
    displayRef.current = display;
    newNumberRef.current = newNumber;
    degModeRef.current = degMode;
    stealthConfigRef.current = stealthConfig;
    cursorPosRef.current = cursorPos;
  }, [display, newNumber, degMode, stealthConfig, cursorPos]);

  // Repeated Equals Ref
  const repeatOpRef = useRef(null);

  // Removed handleSciPress (merged into handlePress)

  // Display Tap Handler
  const handleDisplayTap = (event) => {
    if (stealthConfig.mode === 'display_triple' && stealthConfig.button === 'display') {
      const now = Date.now();
      if (now - lastTapRef.current < 400) {
        tapCountRef.current += 1;
      } else {
        tapCountRef.current = 1;
      }
      lastTapRef.current = now;

      Logger.log("[Stealth] Display Triple Tap Count:", tapCountRef.current);

      if (tapCountRef.current === 3) {
        Logger.log("[Stealth] Display Triple Tap Triggered -> Unlocking");
        triggerStealthUnlock(); // Use unified unlock function
        tapCountRef.current = 0;
        return;
      }
    }

    // GHOST CURSOR PLACEMENT
    if (event?.nativeEvent) {
      const { locationX, layout } = event.nativeEvent;
      // locationX is the tap position relative to the Pressable
      const textWidth = layout?.width || 300; // Fallback width
      const totalChars = display.length || 1;

      // Calculate average character width based on actual layout
      const avgCharWidth = textWidth / totalChars;

      // Estimate index by rounding the tap position divided by char width
      // We clip it between 0 and display length
      let estimatedIdx = Math.round(locationX / avgCharWidth);

      // Safely set cursor position
      setCursorPos(Math.min(display.length, Math.max(0, estimatedIdx)));
      // Once tapped, we are definitely no longer in a "just finished result" state
      setNewNumber(false);
    }
  };

  const keyTapRef = useRef({ count: 0, lastTime: 0 }).current;

  // Optimized Handle Press with Stable Callback Ref
  // Using refs allows us to depend on NOTHING but the input arguments
  const handlePress = useCallback(async (val, type) => {
    const currentDisplay = displayRef.current;
    const isNew = newNumberRef.current;
    const currentMode = stealthConfigRef.current;
    const currentDegMode = degModeRef.current;
    const currentCursor = cursorPosRef.current === null ? currentDisplay.length : cursorPosRef.current;

    const setNewDisplay = (newStr, newCursor) => {
      setDisplay(newStr);
      setCursorPos(newCursor);
    };

    // 0. TRIPLE TAP BUTTON CHECK
    if (currentMode.mode === 'display_triple' && currentMode.button !== 'display') {
      let pressedKey = val;
      if (type === 'clear') pressedKey = 'AC';
      if (type === 'delete') pressedKey = 'DEL';
      if (type === 'percent') pressedKey = '%';

      if (pressedKey === currentMode.button) {
        const now = Date.now();
        if (now - keyTapRef.lastTime < 500) {
          keyTapRef.count += 1;
        } else {
          keyTapRef.count = 1;
        }
        keyTapRef.lastTime = now;

        if (keyTapRef.count === 3) {
          triggerStealthUnlock(); // Unlock
          keyTapRef.count = 0;
          return;
        }
      }
    }

    // Light Haptic Feedback
    triggerHaptic('light');

    // Max Length Check (Prevent Overflow)
    if (!isNew && type === 'number' && currentDisplay.length > 30) {
      return;
    }

    // 1. GLOBAL STEALTH CHECKS
    if (type === 'equal' && currentMode.mode === 'code') {
      if (currentDisplay === currentMode.code) {
        // Success
        await StealthCodeProtector.recordSuccess();
        triggerStealthUnlock();
        return;
      } else {
        // Check if this looks like a failed stealth code attempt
        // We only count it if it's the right length or starts with something suspicious
        // For simplicity, let's just count any '=' press in 'code' mode that doesn't match
        const waitTime = await StealthCodeProtector.getRemainingWaitTime();
        if (waitTime > 0) {
          const seconds = Math.ceil(waitTime / 1000);
          Logger.warn(`[Stealth] Stealth code entry locked. Wait ${seconds}s`);
          return;
        }
        
        // If the code is exactly 4 digits but wrong, record failure
        if (currentDisplay.length === currentMode.code.length && /^\d+$/.test(currentDisplay)) {
          await StealthCodeProtector.recordFailure();
        }
      }
    }

    // 2. UNIFIED EXPRESSION LOGIC

    // Clear All
    if (type === "clear") {
      setDisplay("0");
      setHistory("");
      setOperation(null);
      setPreviousValue(null);
      setNewNumber(true);
      setCursorPos(null);
      return;
    }

    // Delete (Backspace)
    if (type === "delete") {
      if (currentDisplay === "Error" || currentDisplay === "Infinity" || currentDisplay === "NaN") {
        setNewDisplay("0", null);
        setNewNumber(true);
        return;
      }

      if (currentDisplay.length > 0) {
        if (currentCursor > 0) {
          const before = currentDisplay.slice(0, currentCursor - 1);
          const after = currentDisplay.slice(currentCursor);
          setNewDisplay((before + after) || "0", Math.max(0, currentCursor - 1));
        }
      } else {
        setNewDisplay("0", null);
        setNewNumber(true);
      }
      return;
    }

    // Input Handling
    const operators = ['+', '-', '*', '/', '%'];
    const segments = currentDisplay.split(/[\+\-\*\/\%]/);
    const currentNum = segments[segments.length - 1];
    const lastChar = currentDisplay.slice(-1);

    // DECIMAL POINT CHECK
    if (val === '.') {
      const charBefore = currentDisplay[currentCursor - 1] || "";
      // Check if the current number segment already has a decimal
      const segmentsBefore = currentDisplay.slice(0, currentCursor).split(/[+\-*/%^()]/);
      const currentSegment = segmentsBefore[segmentsBefore.length - 1];

      if (currentSegment.includes('.')) return;

      const toInsert = (operators.includes(charBefore) || currentDisplay === "" || currentCursor === 0) ? "0." : ".";
      setNewDisplay(currentDisplay.slice(0, currentCursor) + toInsert + currentDisplay.slice(currentCursor), currentCursor + toInsert.length);
      setNewNumber(false);
      return;
    }

    // PERCENT CHECK
    if (type === "percent") {
      const charBefore = currentDisplay[currentCursor - 1] || "";
      if (operators.includes(charBefore)) return;
      setNewDisplay(currentDisplay.slice(0, currentCursor) + "%" + currentDisplay.slice(currentCursor), currentCursor + 1);
      setNewNumber(false);
      return;
    }

    // OPERATOR CHECK
    if (type === "op" || type === "equal") {
      const charBefore = currentDisplay[currentCursor - 1] || "";
      const isOperatorBefore = operators.includes(charBefore);

      if (isOperatorBefore) {
        // Special case: % should NOT be replaced by other operators
        if (charBefore === '%') {
          // Allow the new operator to be added after %
        } else {
          if (val === '-' && charBefore !== '-') {
            setNewDisplay(currentDisplay.slice(0, currentCursor) + val + currentDisplay.slice(currentCursor), currentCursor + 1);
            setNewNumber(false);
            return;
          }
          if (type === "op") {
            // Replace operator
            setNewDisplay(currentDisplay.slice(0, currentCursor - 1) + val + currentDisplay.slice(currentCursor), currentCursor);
            return;
          }
        }
      }

      if (type === "op") {
        setNewDisplay(currentDisplay.slice(0, currentCursor) + val + currentDisplay.slice(currentCursor), currentCursor + 1);
        setNewNumber(false);
      }

      // Calculate (Equal)
      if (type === "equal") {
        if (currentDisplay === "8888.8888") {
          setIsHistoryOpen?.(false);
          themeProps?.onTriggerUpdate?.();
          return;
        }
        try {
          let expr = currentDisplay;

          if (isNew && repeatOpRef.current) {
            expr = currentDisplay + repeatOpRef.current;
          } else {
            const match = currentDisplay.match(/([+\-*/%])((?:[^-+\-*/%]|\(-)*)$/);
            if (match) {
              repeatOpRef.current = match[0];
            } else {
              repeatOpRef.current = null;
            }
          }

          const res = safeEvaluate(expr, currentDegMode);
          const resultStr = String(res);
          setNewDisplay(resultStr, null);

          setCalcHistory(prev => [
            { id: Date.now(), expression: expr, result: resultStr },
            ...prev
          ]);
          setNewNumber(true);
        } catch (e) {
          setNewDisplay("Error", null);
          setNewNumber(true);
        }
      }
      return;
    }

    // FUNCTION / SCIENTIFIC INPUT
    if (type === 'func' || type === 'sci_func' || type === 'constant' || type === 'sci') {
      let baseDisplay = currentDisplay;
      let workingCursor = currentCursor;

      if (isNew) {
        baseDisplay = "";
        workingCursor = 0;
        setNewNumber(false);
      }

      let toInsert = val;
      if (type === 'func' || type === 'sci_func') {
        toInsert = val + "(";
      }

      const finalDisplay = (baseDisplay === "0" && val !== ".") ?
        toInsert + baseDisplay.slice(1) :
        baseDisplay.slice(0, workingCursor) + toInsert + baseDisplay.slice(workingCursor);

      const nextCursor = (baseDisplay === "0" && val !== ".") ? toInsert.length : workingCursor + toInsert.length;

      setNewDisplay(finalDisplay, nextCursor);
      return;
    }

    // NUMBER INPUT
    if (type === "number") {
      if (currentDisplay === "0" && val !== ".") {
        setNewDisplay(val, val.length);
      } else {
        if (isNew) {
          setNewDisplay(val, val.length);
        } else {
          setNewDisplay(currentDisplay.slice(0, currentCursor) + val + currentDisplay.slice(currentCursor), currentCursor + 1);
        }
      }
      setNewNumber(false);
    }
  }, []); // NO DEPENDENCIES - Guaranteed Stable Reference




  // Secret Hook: Long press
  const handleSecretPressIn = () => {
    if (stealthConfig.mode !== 'display_long') return;
    const timer = setTimeout(() => {
      triggerStealthUnlock();
    }, 2000);
    setLongPressTimer(timer);
  };
  const handleSecretPressOut = () => {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null); }
  };

  // Header Mode Text - Title Only (No Interaction)
  const handleHeaderTap = () => {
    // Optional: Add mode switching or Easter egg here if needed
  };

  // Footer Triple Tap & Hold Handler (Stealth Access)
  const footerTimerRef = useRef(null);
  const footerTapRef = useRef({ count: 0, lastTime: 0 });
  const [isHoldingUnlock, setIsHoldingUnlock] = useState(false);

  // Safe Haptics Helper with Vibration Fallback
  const triggerHaptic = async (type) => {
    if (isWeb) return;
    try {
      if (type === 'light') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'heavy') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      // Fallback for missing native module
      if (type === 'light') Vibration.vibrate(10);
      if (type === 'heavy') Vibration.vibrate(40);
      if (type === 'success') Vibration.vibrate([0, 20, 50, 20]);
      if (type === 'error') Vibration.vibrate([0, 20, 50, 20, 50, 20]);
    }
  };

  const handleFooterPressIn = () => {
    if (footerTimerRef.current) return; // Already in hold state

    const now = Date.now();
    const gap = now - footerTapRef.current.lastTime;

    // Jitter Protection: Ignore taps closer than 50ms
    if (gap < 50 && footerTapRef.current.count > 0) {
      Logger.log(`[Stealth Footer] Jitter ignored (Gap: ${gap}ms)`);
      return;
    }

    if (gap < 1000) { // Tolerance between taps
      footerTapRef.current.count += 1;
    } else {
      footerTapRef.current.count = 1;
    }

    // Light feedback for each tap
    // triggerHaptic('light');

    Logger.log(`[Stealth Footer] Press @ ${footerTapRef.current.count} (Gap: ${gap}ms)`);

    if (footerTapRef.current.count === 3) {
      Logger.log("[Stealth Footer] Triple tap reached! HOLD for 2s to Unlock...");

      // Feedback that hold has started
      // triggerHaptic('heavy');
      setIsHoldingUnlock(true);

      const timer = setTimeout(() => {
        Logger.log("[Stealth Footer] SUCCESS! 2s Hold confirmed. Unlocking App...");
        // triggerHaptic('success');
        triggerStealthUnlock();
        setIsHoldingUnlock(false);
        footerTapRef.current.count = 0;
        footerTimerRef.current = null;
      }, 2000);
      footerTimerRef.current = timer;
    } else if (footerTapRef.current.count > 3) {
      // Safety reset if somehow exceeded
      footerTapRef.current.count = 1;
    }
  };

  const handleFooterPressOut = () => {
    const now = Date.now();

    if (footerTimerRef.current) {
      Logger.log("[Stealth Footer] RELEASE TOO EARLY - Hold aborted.");
      // triggerHaptic('error');
      setIsHoldingUnlock(false);
      clearTimeout(footerTimerRef.current);
      footerTimerRef.current = null;
      footerTapRef.current.count = 0; // Reset progress on failure
    } else {
      Logger.log(`[Stealth Footer] Release @ ${footerTapRef.current.count}`);
    }

    footerTapRef.current.lastTime = now;
  };

  const handleSettingsPress = () => {
    setShowSettings(true);
  };

  const switchMode = (mode) => {
    if (mode === 'mca') {
      setShowMCAModal(true);
      return;
    }
    setCalcMode(mode);
    setShowSettings(false);
  };

  const handleEmergencyReset = async () => {
    Alert.alert(
      "System Reset",
      "Reset Stealth Access to Default (Triple Tap AC)?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.setItem("stealthMode", "ac_triple");
            setStealthConfig({ mode: "ac_triple", code: "7331" });
            Alert.alert("Reset Complete", "Access via Triple Tap on AC restored.");
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.mobileGameContainer, { backgroundColor: THEME.bg }, isLandscape && { flexDirection: 'row' }]}>
      <Animated.View
        style={[
          { flex: 1, width: '100%', backfaceVisibility: 'hidden', justifyContent: 'flex-end', pointerEvents: isFlipped ? 'none' : 'auto' },
          { transform: [{ rotateY: frontInterpolate }] }
        ]}
      >
        <Pressable
          style={[styles.settingsButton, { left: 5, right: undefined, zIndex: 50, top: -5 }, isLandscape && { top: 10, left: 5 }]}
          onPress={flipToHistory}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="history" size={isTablet ? 32 : 24} color={isDark ? "rgba(255,255,255,0.7)" : "rgba(15, 23, 42, 0.7)"} />
        </Pressable>

        {/* Header Mode Text - Title Only (No Interaction) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 45, // Consistent header height
            justifyContent: 'center', // Center vertically
            alignItems: 'center',
            zIndex: 40,
            backgroundColor: 'transparent',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
        >
          <Pressable
            style={{ alignItems: 'center', paddingBottom: 15, paddingTop: 5, paddingHorizontal: 40 }} // Shifted up (more padding below)
            onPress={handleHeaderTap}
          >
            <Text style={{
              textAlign: 'center',
              color: THEME.textAlt,
              fontSize: 14,
              fontFamily: 'Outfit_700Bold',
              letterSpacing: 1.5,
              opacity: 0.9
            }}>
              {calcMode === 'basic' ? 'BASIC MODE' :
                calcMode === 'sci' ? 'SCIENTIFIC MODE' :
                  calcMode === 'mba' ? 'MBA FINANCE MODE' : 'CAT EXAM MODE'}
            </Text>
          </Pressable>
        </View>

        {/* Settings Button */}
        <Pressable
          style={[styles.settingsButton, isLandscape && { top: 10, left: undefined, right: 10 }]}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleSettingsPress();
          }}
          hitSlop={10}
        >
          <Feather name="more-vertical" size={isTablet ? 32 : 24} color={isDark ? "rgba(255,255,255,0.7)" : "rgba(15, 23, 42, 0.7)"} />
        </Pressable>


        {/* Settings Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showSettings}
          onRequestClose={() => setShowSettings(false)}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowSettings(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.modalContent,
                isTablet && { width: 500 },
                {
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                  overflow: 'hidden',
                  ...(isWeb ? { backdropFilter: 'blur(15px)' } : {})
                }
              ]}
            >
              {!isWeb && (
                <BlurView
                  intensity={50}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                colors={isDark ? ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.2)'] : ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)']}
                style={StyleSheet.absoluteFill}
              />

              <Text style={[styles.modalTitle, { color: THEME.textMain, marginBottom: 8, fontSize: 16 }]}>Settings</Text>

              <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }]}>Appearance</Text>

              {/* Theme Selector */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, width: '100%' }}>
                <Pressable
                  style={[styles.themeOption, { paddingVertical: 4 }, themePreference === 'system' && { backgroundColor: isDark ? '#475569' : THEME.btnEqual[0], borderColor: isDark ? '#475569' : THEME.btnEqual[0] }]}
                  onPress={() => toggleTheme('system')}
                >
                  <Feather name="monitor" size={14} color={themePreference === 'system' ? '#FFF' : THEME.textMain} />
                  <Text style={[styles.themeOptionText, { fontSize: 11, color: themePreference === 'system' ? '#FFF' : THEME.textMain }]}>System</Text>
                </Pressable>

                <Pressable
                  style={[styles.themeOption, { paddingVertical: 4 }, themePreference === 'light' && { backgroundColor: THEME.btnOp[0], borderColor: THEME.btnOp[0] }]}
                  onPress={() => toggleTheme('light')}
                >
                  <Feather name="sun" size={14} color={themePreference === 'light' ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A')} />
                  <Text style={[styles.themeOptionText, { fontSize: 11, color: themePreference === 'light' ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A') }]}>Light</Text>
                </Pressable>

                <Pressable
                  style={[styles.themeOption, { paddingVertical: 4 }, themePreference === 'dark' && { backgroundColor: THEME.btnOp[0], borderColor: THEME.btnOp[0] }]}
                  onPress={() => toggleTheme('dark')}
                >
                  <Feather name="moon" size={14} color={themePreference === 'dark' ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A')} />
                  <Text style={[styles.themeOptionText, { fontSize: 11, color: themePreference === 'dark' ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A') }]}>Dark</Text>
                </Pressable>
              </View>

              <Text style={[styles.modalButtonText, { color: THEME.textAlt, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }]}>Button Size</Text>

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, width: '100%' }}>
                {['small', 'medium', 'large'].map(size => (
                  <Pressable
                    key={size}
                    style={[styles.themeOption, { paddingVertical: 4 }, btnSize === size && { backgroundColor: THEME.btnOp[0], borderColor: THEME.btnOp[0] }]}
                    onPress={() => updateBtnSize(size)}
                  >
                    <Feather name={size === 'small' ? 'minimize-2' : size === 'medium' ? 'maximize-2' : 'move'} size={12} color={btnSize === size ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A')} />
                    <Text style={[styles.themeOptionText, { fontSize: 11, color: btnSize === size ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A'), textTransform: 'capitalize' }]}>{size}</Text>
                  </Pressable>
                ))}
              </View>


              <Pressable
                style={[styles.modalButton, {
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: THEME.border,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  height: 36
                }]}
                onPress={() => updateSavePreference(!savePreference)}
              >
                <Text style={[styles.modalButtonText, { color: THEME.textMain, fontSize: 12 }]}>Save Session Data</Text>
                <Feather
                  name={savePreference ? "check-circle" : "circle"}
                  size={16}
                  color={savePreference ? '#FF4B4B' : THEME.textAlt}
                />
              </Pressable>


              <Text style={[styles.modalButtonText, { color: THEME.textMain, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }]}>Mode</Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {['basic', 'sci', 'mba', 'cat'].map(mode => (
                  <Pressable
                    key={mode}
                    style={[styles.modalButton, {
                      width: '48%',
                      height: 32,
                      marginBottom: 0,
                      backgroundColor: calcMode === mode ? THEME.primary : (isDark ? '#121212' : '#F1F5F9'),
                      borderWidth: calcMode === mode ? 0 : 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }]}
                    onPress={() => switchMode(mode)}
                  >
                    <Text style={[styles.modalButtonText, { fontSize: 12, color: calcMode === mode ? '#FFF' : (isDark ? '#F1F5F9' : '#0F172A') }]}>
                      {mode.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.modalButton, {
                    width: '100%',
                    height: 32,
                    marginTop: 4,
                    backgroundColor: calcMode === 'mca' ? THEME.primary : (isDark ? '#1a1a1a' : '#FFF1F2'),
                    borderWidth: calcMode === 'mca' ? 0 : 1,
                    borderColor: calcMode === 'mca' ? THEME.primary : '#FECDD3'
                  }]}
                  onPress={() => switchMode('mca')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.modalButtonText, { fontSize: 12, color: calcMode === 'mca' ? '#FFF' : '#B91C1C' }]}>MCA EXAM</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                      <Text style={{ fontSize: 7, color: calcMode === 'mca' ? '#FFF' : '#B91C1C', fontWeight: '900' }}>SOON</Text>
                    </View>
                  </View>
                </Pressable>
              </View>


              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
                  onPress={() => setShowAbout(true)}
                >
                  <Feather name="info" size={12} color={THEME.textAlt} style={{ marginRight: 4 }} />
                  <Text style={{ color: THEME.textAlt, fontSize: 11, fontWeight: '600' }}>About</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel, { width: 80, height: 32, marginTop: 0, marginBottom: 0 }]}
                  onPress={() => setShowSettings(false)}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonCancelText, { fontSize: 12 }]}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* MCA Mode Popup */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showMCAModal}
          onRequestClose={() => setShowMCAModal(false)}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowMCAModal(false)}
          >
            <TouchableWithoutFeedback>
              <View style={{
                width: '85%',
                maxWidth: 360,
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderRadius: 24,
                padding: 24,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                ...select({
                  ios: {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 20 },
                    shadowOpacity: 0.25,
                    shadowRadius: 25,
                  },
                  android: {
                    elevation: 10,
                  },
                  web: {
                    boxShadow: '0px 20px 25px rgba(0, 0, 0, 0.25)',
                  },
                })
              }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                  justifyContent: 'center', alignItems: 'center', marginBottom: 16
                }}>
                  <MaterialCommunityIcons name="school-outline" size={32} color="#EF4444" />
                </View>
                <Text style={{
                  fontSize: 22, fontWeight: '800',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                  fontFamily: 'Outfit_700Bold', marginBottom: 8, textAlign: 'center'
                }}>
                  MCA Exam Mode
                </Text>
                <View style={{
                  backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 12, marginBottom: 16
                }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>COMING SOON</Text>
                </View>
                <Text style={{
                  fontSize: 15, color: isDark ? '#94A3B8' : '#64748B',
                  textAlign: 'center', lineHeight: 22, marginBottom: 24
                }}>
                  Specialized tools for MCA entrance exams including Matrix Operations, Vector Calculus, and Statistics are currently in development.
                </Text>
                <Pressable
                  onPress={() => setShowMCAModal(false)}
                  style={({ pressed }) => ({
                    width: '100%',
                    paddingVertical: 14,
                    backgroundColor: '#EF4444',
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  })}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Got it</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </Modal>

        {/* About Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showAbout}
          onRequestClose={() => setShowAbout(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowAbout(false)}
          >
            <TouchableWithoutFeedback>
              <View style={{
                width: 300,
                backgroundColor: THEME.bg,
                borderRadius: 20,
                padding: 24,
                borderWidth: 1,
                borderColor: THEME.border,
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
                })
              }}>
                <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(168, 85, 247, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Feather name="shield" size={32} color="#A855F7" />
                </View>
                <Text style={{ color: THEME.textMain, fontSize: 22, fontFamily: 'Outfit_700Bold', marginBottom: 4 }}>CalcX</Text>
                <Pressable
                  onPress={() => {
                    const now = Date.now();
                    if (now - versionTapRef.current.lastTime < 500) {
                      versionTapRef.current.count += 1;
                    } else {
                      versionTapRef.current.count = 1;
                    }
                    versionTapRef.current.lastTime = now;
                    if (versionTapRef.current.count >= 5) {
                      setShowAbout(false);
                      setShowSettings(false);
                      setShowUpdate(true);
                      versionTapRef.current.count = 0;
                    }
                  }}
                >
                  <Text style={{ color: THEME.textMain, textAlign: 'center', fontSize: 14, fontWeight: 'bold', marginBottom: 20, marginTop: 8 }}>
                    Version {UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : "1.0.3"} (Active)
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 20,
                    gap: 8
                  }}
                  onPress={() => {
                    setShowAbout(false);
                    setShowSettings(false);
                    setShowUpdate(true);
                  }}
                >
                  <Feather name="refresh-cw" size={14} color="#A855F7" />
                  <Text style={{ color: "#A855F7", fontWeight: '700', fontSize: 13 }}>Check for Updates</Text>
                </Pressable>
                <Text style={{ color: THEME.textAlt, fontSize: 10, opacity: 0.6, marginBottom: 24 }}>
                  © 2026 Utility Tools
                </Text>
                <Pressable
                  style={{ backgroundColor: THEME.btnEqual[0], paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24 }}
                  onPress={() => setShowAbout(false)}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Close</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </Modal>

        {/* Display Area */}
        <View style={[
          isLandscape ? { flex: 1.2 } : { flex: 0.8 },
          {
            backgroundColor: THEME.bg,
            justifyContent: 'flex-end',
            paddingBottom: 60,
            paddingTop: 60, // Restored stable padding (60)
          }
        ]}>


          <View style={{ height: 40, justifyContent: 'center', paddingHorizontal: 24, marginBottom: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-end', flexGrow: 1 }}
            >
              <Text style={{
                color: THEME.textAlt,
                fontSize: 20,
                fontFamily: 'Inter_500Medium',
                opacity: 0.6
              }}>
                {history || liveResult || (display.length > 1 || display !== '0' ? display : '')}
              </Text>
            </ScrollView>
          </View>

          <View style={{ 
            height: 120, 
            justifyContent: 'center', 
            paddingHorizontal: 24, 
            marginBottom: 5,
            overflow: 'hidden',
            borderRadius: 24
          }}>
            {/* Glassmorphism Background */}
            <BlurView
              intensity={isDark ? 40 : 60}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <StealthGlow active={display !== "0" && display.length > 0} THEME={THEME} />

            <ScrollView
              ref={displayScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-end', flexGrow: 1 }}
              style={{ width: '100%' }}
            >
              <Pressable
                onPress={handleDisplayTap}
                onPressIn={handleSecretPressIn}
                onPressOut={handleSecretPressOut}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: '100%', justifyContent: 'flex-end' }}
              >
                {renderHighlightedExpression(
                  display,
                  THEME,
                  isDark,
                  display.length > 15 ? 40 : display.length > 9 ? 55 : (isTablet ? 90 : 72),
                  cursorPos,
                  isTablet
                )}
              </Pressable>
            </ScrollView>
          </View>

          {/* Unit Preview / Ghost Line */}
          <View style={{
            height: 30,
            paddingHorizontal: 28,
            marginTop: -5,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <AnimatedGhostLine display={display} THEME={THEME} />
          </View>
        </View>

        {/* Explicit Separator (Removed per user request) */}
        {/* <View style={{
          width: '85%',
          height: 4,
          backgroundColor: THEME.textAlt, // Fixed color (Stealth: no visual change)
          borderRadius: 50,
          alignSelf: 'center',
          marginTop: -300,
          marginBottom: 10,
          zIndex: 100,
          elevation: 10,
          opacity: 0.5, // Fixed opacity
          transform: [{ scaleX: 1 }], // Fixed scale
        }}
          pointerEvents="none"
        /> */}

        <LinearGradient
          colors={THEME.keypadGradient}
          style={[
            styles.calcKeypad,
            {
              paddingHorizontal: 12,
              paddingTop: 16,
              marginTop: 0,
              gap: isBasic ? 8 : 4,
              zIndex: 0,
              // Remove the default border to use the Corner Cap overlay instead
              borderTopWidth: 0,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              overflow: 'hidden', // Ensure overlay doesn't bleed if it somehow could
            },
            isLandscape && { borderLeftWidth: 1, borderLeftColor: THEME.border, paddingBottom: 20 }
          ]}
        >
          {/* Rose Pink "Corner Cap" - Ensures the line bends into corners then stops */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 34, // Matches radius 32 + border 2 (approx for new 20 padding)
              borderTopWidth: 0, // Removed separator line
              borderLeftWidth: 0,
              borderRightWidth: 0,
              zIndex: 10,
            }}
          />

          <Keypad
            calcMode={calcMode}
            btnSize={btnSize}
            handlePress={handlePress}
            handleEmergencyReset={handleEmergencyReset}
            THEME={THEME}
            isTablet={isTablet}
            isDark={isDark}
            memory={memory}
            setDisplay={setDisplay}
            degMode={degMode}
            isSecond={isSecond}
            setIsSecond={setIsSecond}
          />

          {/* Branded Footer - Secure Stealth Trigger */}
          <View
            style={{
              padding: 10,
              paddingBottom: Math.max(insets.bottom, 20) + 10,
              marginTop: 5,
              opacity: 1,
              alignItems: 'center',
              width: '100%'
            }}
          >
            <Pressable
              onPressIn={handleFooterPressIn}
              onPressOut={handleFooterPressOut}
              // Disable default system feedback
              android_disableSound={true}
              hitSlop={10}
            >
              <Text style={styles.calcFooter}>
                CALCX
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* BACK FACE (HISTORY) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backfaceVisibility: 'hidden', backgroundColor: isDark ? '#000000' : THEME.bg, pointerEvents: isFlipped ? 'auto' : 'none' },
          { transform: [{ rotateY: backInterpolate }] }
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 45,
            justifyContent: 'center',
            paddingLeft: 16,
            zIndex: 40,
            backgroundColor: 'transparent', // Transparent header
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: THEME.textMain, fontFamily: 'Outfit_700Bold', paddingBottom: 6 }}>History</Text>
          </View>
          <Pressable style={[styles.settingsButton, { top: -5, right: 10 }]} onPress={flipToCalculator} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={28} color={THEME.textMain} />
          </Pressable>

          <View style={{ flex: 1, paddingTop: 41 }}>
            {/* Tinted Background for History Area */}
            <View style={{
              position: 'absolute',
              top: 38 - 41, // Starts at the separator (offset from container paddingTop)
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? '#000000' : 'rgba(255, 255, 255, 0.6)',
              zIndex: -1,
            }} />

            {calcHistory.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5, paddingHorizontal: 16 }}>
                <MaterialCommunityIcons name="history" size={64} color={THEME.textAlt} />
                <Text style={{ marginTop: 16, color: THEME.textAlt, fontFamily: 'Inter_500Medium' }}>No calculations yet</Text>
              </View>
            ) : (
              <FlatList
                data={calcHistory}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setDisplay(String(item.result));
                      setNewNumber(true);
                      flipToCalculator();
                    }}
                    style={({ pressed }) => [{
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      alignItems: 'flex-start',
                      opacity: pressed ? 0.7 : 1
                    }]}
                  >
                    <Text style={{ fontSize: 12, color: THEME.textAlt, marginBottom: 2 }}>
                      {new Date(item.id).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ fontSize: 16, color: THEME.textAlt, fontFamily: 'Inter_500Medium', marginBottom: 2 }}>{item.expression}</Text>
                    <Text style={{ fontSize: 24, color: THEME.btnEqual[1], fontFamily: 'Outfit_700Bold' }}>= {item.result}</Text>
                  </Pressable>
                )}
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
              />
            )}

            {calcHistory.length > 0 && (
              <Pressable
                style={({ pressed }) => ({
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 12) + 4,
                  alignSelf: 'center',
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.20)',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  ...select({
                    ios: { shadowColor: '#ef4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12 },
                    android: { elevation: 10 },
                    web: { boxShadow: '0 6px 20px rgba(239,68,68,0.25)' },
                  })
                })}
                onPress={() => {
                  setCalcHistory([]);
                  flipToCalculator();
                }}
              >
                <LinearGradient
                  colors={isDark
                    ? ['rgba(239,68,68,0.08)', 'rgba(185,28,28,0.04)']
                    : ['rgba(239,68,68,0.08)', 'rgba(185,28,28,0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 28,
                    gap: 10,
                    backgroundColor: 'transparent',
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
                  <Text style={{
                    color: '#ef4444',
                    fontWeight: '700',
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    letterSpacing: 1.8,
                  }}>CLEAR HISTORY</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>

      {/* In-App Update Center Modal */}
      {!isWeb && isAndroid && (
        <UpdateScreen
          visible={showUpdate}
          onClose={() => setShowUpdate(false)}
        />
      )}
    </View>
  );
});


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
  },
  mobileGameContainer: {
    flex: 1,
    padding: 0,
    justifyContent: 'flex-end',
    width: '100%',
  },
  settingsButton: {
    position: 'absolute',
    top: -5, // Moved up from 10
    right: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 50,
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
      }
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
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
  calcKeypad: {
    width: '100%',
    backgroundColor: '#000000',
    borderTopWidth: 0,
    borderTopColor: '#334155',
    paddingTop: 20,
    paddingHorizontal: 12,
    gap: 8,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    borderRadius: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px -10px 20px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  calcRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    height: 68,
    alignItems: 'center',
  },
  calcRowDense: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    height: 46,
    alignItems: 'center',
  },
  calcBtnTextDense: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  calcBtn: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
    zIndex: 1, // Ensure buttons are above keypad background gradients
  },
  calcBtnText: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  calcBtnTextSmall: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  calcFooter: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: isIOS ? 'Avenir-Heavy' : 'sans-serif-condensed',
    textAlign: 'center',
    marginTop: 10,
    paddingBottom: 0,
    letterSpacing: 6,
    textTransform: 'uppercase',
    ...select({
      ios: {
        textShadowColor: 'rgba(168, 85, 247, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      },
      android: {
        elevation: 5,
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
