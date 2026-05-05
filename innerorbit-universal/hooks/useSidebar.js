/**
 * Purpose: Manages the interactive sidebar state for desktop layouts. Handles complex 
 * animations for opening/closing and resizing via PanResponders.
 */
import { useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, Easing } from 'react-native';

export function useSidebar(isDesktop) {
  const sidebarAnim = useRef(new Animated.Value(1)).current; // 1 = Open, 0 = Closed
  const sidebarWidthAnim = useRef(new Animated.Value(400)).current; // Physical Width
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  // Ref for 'initial start width' during drag
  const widthSnapshotRef = useRef(400);

  // PanResponder for direct Animated manipulation (Zero Re-renders)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, // Capture immediately on web
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsResizing(true);
        // Ensure starting point is the current actual width
        const currentW = widthSnapshotRef.current || 400;
        sidebarWidthAnim.setValue(currentW);
      },
      onPanResponderMove: (evt, gestureState) => {
        const startW = widthSnapshotRef.current || 400;
        let newW = startW + gestureState.dx;

        // Strict Constraints: Min 400, Max 800
        if (newW < 400) newW = 400;
        if (newW > 800) newW = 800;

        sidebarWidthAnim.setValue(newW);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsResizing(false);
        let finalW = widthSnapshotRef.current + gestureState.dx;

        // Final Snap with Constraints
        if (finalW < 400) finalW = 400;
        if (finalW > 800) finalW = 800;

        widthSnapshotRef.current = finalW;
        sidebarWidthAnim.setValue(finalW);
      },
      onPanResponderTerminate: () => {
        setIsResizing(false);
      }
    })
  ).current;

  // Initialize Snapshot (One-off)
  useEffect(() => {
    // no-op, ref starts at 400
  }, []);

  const toggleSidebar = () => {
    const toValue = isSidebarOpen ? 0 : 1;
    // We animate the scalar 0-1
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.ease),
    }).start();
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Combine Openness * Width
  const animatedWidth = Animated.multiply(sidebarAnim, sidebarWidthAnim);

  const sidebarOpacity = sidebarAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return {
    isSidebarOpen,
    toggleSidebar,
    animatedWidth,
    sidebarOpacity,
    panResponder,
    isResizing
  };
}
