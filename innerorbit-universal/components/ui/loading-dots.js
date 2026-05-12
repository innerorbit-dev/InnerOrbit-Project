/** Purpose: Unified bouncing dots animation for 'Loading...' states. */
import React from "react";
import { View, Animated, Text, Easing } from "react-native";
import { isWeb } from "../../utils/platform";

export const LoadingDots = ({ color = "#60a5fa", size = 4, gap = 2, showText = false, label = "Loading...", style = {} }) => {
  const animations = React.useRef([...Array(3)].map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(150, animations.map(anim =>
        Animated.sequence([
          Animated.timing(anim, { 
            toValue: -6, 
            duration: 300, 
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: !isWeb 
          }),
          Animated.timing(anim, { 
            toValue: 0, 
            duration: 300, 
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: !isWeb 
          })
        ])
      ))
    );
    loop.start();
    return () => loop.stop();
  }, [animations]);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, style]}>
      {showText && (
        <Text style={{ color, fontSize: 13, marginRight: 8, fontWeight: '600', letterSpacing: 0.5 }}>
          {label}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 20 }}>
        {animations.map((anim, index) => (
          <Animated.View
            key={index}
            style={{
              width: size, 
              height: size, 
              borderRadius: size / 2, 
              backgroundColor: color, 
              marginHorizontal: gap,
              transform: [{ translateY: anim }]
            }}
          />
        ))}
      </View>
    </View>
  );
};
