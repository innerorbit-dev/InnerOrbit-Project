/** Purpose: Modal providing a camera interface for scanning user QR codes. */
import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated, Easing, Linking } from 'react-native';
import { select, isWeb } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../context/auth-context";
import { Logger } from '../../lib/logger';

let CameraView;
let useCameraPermissions;

try {
  // Use require to avoid crashing on web or if native module is missing
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (error) {
  Logger.log('Camera module not available:', error);
}

export const ScannerModal = ({ visible, onClose, handleBarCodeScanned, THEME }) => {
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [scanned, setScanned] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { setPermissionRequesting } = useAuth();

  const handleRequestPermission = async () => {
    if (!requestPermission) return;

    // Prevent app from auto-locking (Decoy Mode) when system dialog appears
    setPermissionRequesting(true);
    try {
      // If the user has previously selected "Don't ask again", direct to app settings
      if (permission && permission.granted === false && permission.canAskAgain === false) {
        await Linking.openSettings();
        return;
      }
      await requestPermission();
    } finally {
      // Small delay to ensure AppState has settled back to 'active'
      setTimeout(() => {
        setPermissionRequesting(false);
      }, 1000);
    }
  };

  useEffect(() => {
    if (visible && CameraView) {
      if (!permission) {
        handleRequestPermission();
      } else if (!permission.granted && permission.canAskAgain) {
        handleRequestPermission();
      }
      setScanned(false);
      startAnimation();
    }
  }, [visible, permission]);

  const startAnimation = () => {
    slideAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: !isWeb,
        })
      ])
    ).start();
  };

  const handleBarCodeScannedInternal = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    handleBarCodeScanned({ type, data });
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250], // Adjust based on scanner frame height
  });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {visible && CameraView && permission?.granted && (
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              onBarcodeScanned={scanned ? undefined : handleBarCodeScannedInternal}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              style={StyleSheet.absoluteFillObject}
              facing="back"
            />
            {/* Scanner Overlay */}
            <View style={styles.overlay}>
              <View style={styles.unfocusedContainer}></View>
              <View style={styles.middleContainer}>
                <View style={styles.unfocusedContainer}></View>
                <View style={styles.focusedContainer}>
                  <View style={[styles.cornerTL, { borderColor: THEME.primary }]} />
                  <View style={[styles.cornerTR, { borderColor: THEME.primary }]} />
                  <View style={[styles.cornerBL, { borderColor: THEME.primary }]} />
                  <View style={[styles.cornerBR, { borderColor: THEME.primary }]} />
                  <Animated.View style={[styles.scanLine, { transform: [{ translateY }], backgroundColor: THEME.primary, ...select({ web: { boxShadow: `0px 0px 10px ${THEME.primary}` }, ios: { shadowColor: THEME.primary, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, android: { elevation: 5 } }) }]} />
                </View>
                <View style={styles.unfocusedContainer}></View>
              </View>
              <View style={styles.unfocusedContainer}></View>
            </View>
          </View>
        )}

        {visible && CameraView && permission && !permission.granted && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontSize: 16, marginBottom: 20 }}>No access to camera</Text>
            <Pressable onPress={handleRequestPermission} style={{ padding: 12, backgroundColor: '#333', borderRadius: 8, marginBottom: 10 }}>
              <Text style={{ color: 'white' }}>{permission.canAskAgain ? "Request Permission" : "Open Settings"}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ padding: 12, backgroundColor: '#333', borderRadius: 8 }}>
              <Text style={{ color: 'white' }}>Close</Text>
            </Pressable>
          </View>
        )}

        {visible && !CameraView && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Feather name="camera-off" size={48} color="white" style={{ marginBottom: 16 }} />
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, marginBottom: 8 }}>Scanner Not Available</Text>
            <Text style={{ color: '#9ca3af', textAlign: 'center', fontSize: 14 }}>
              The camera module could not be loaded.
              {!isWeb ? "\nPlease rebuild your app to include native dependencies." : "\nCamera access is limited on web."}
            </Text>
            <Pressable onPress={onClose} style={{ marginTop: 24, padding: 12, backgroundColor: '#333', borderRadius: 8 }}>
              <Text style={{ color: 'white' }}>Close</Text>
            </Pressable>
          </View>
        )}

        <View style={{ position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <View>
            <Text style={{ color: THEME.primary, fontSize: 24, fontWeight: '900', letterSpacing: 1 }}>Scan to Chat</Text>
            <Text style={{ color: '#FFF', fontSize: 13, opacity: 0.8, marginTop: 2 }}>Scan a User's QR code to connect</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 12, backgroundColor: THEME.actionBackground, borderRadius: 24, borderWidth: 1, borderColor: THEME.separator }}>
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>
        </View>

        {/* Scanning Frame Details */}
        <View style={{ position: 'absolute', top: '50%', marginTop: 140, width: '100%', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: THEME.primary + '40' }}>
            <Text style={{ color: THEME.primary, fontWeight: '800', fontSize: 13 }}>SCANNING ACTIVE...</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, padding: 16, backgroundColor: 'transparent', zIndex: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: THEME.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
              <Feather name="info" size={14} color={THEME.primary} />
            </View>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', ...select({ web: { textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }, default: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 } }) }}>Scanning Tips</Text>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, ...select({ web: { textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }, default: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 } }) }}>• Hold the device steady about 6 inches away</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, ...select({ web: { textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }, default: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 } }) }}>• Ensure the QR code is well-lit and not blurry</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, ...select({ web: { textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }, default: { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 } }) }}>• Center the code entirely within the rose frame</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  middleContainer: {
    flexDirection: 'row',
    height: 250,
  },
  focusedContainer: {
    width: 250,
    height: 250,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  scanLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#00FF00', // Green laser look
    ...select({
      ios: {
        shadowColor: '#00FF00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 0px 10px #00FF00',
      },
    }),
  },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#fb7185' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#fb7185' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#fb7185' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#fb7185' },
});
