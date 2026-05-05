/** Purpose: Custom title bar for Desktop/Electron version with window controls. */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { isWeb, select } from '../../utils/platform';

const DesktopTitleBar = ({ THEME }) => {
  // Only render on Web + Electron
  const isElectron = isWeb && typeof window !== 'undefined' && window.electron;
  
  if (!isElectron) return null;

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Initial check
    setIsMaximized(window.electron.windowControls.isMaximized());
  }, []);

  const handleMinimize = () => window.electron.windowControls.minimize();
  const handleMaximize = () => {
    window.electron.windowControls.maximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.electron.windowControls.close();

  return (
    <View style={[styles.container, { backgroundColor: THEME.background, borderBottomColor: 'rgba(255,255,255,0.05)' }]}>
      {/* Draggable Area */}
      <View style={styles.dragArea} {...(isWeb ? { draggable: false } : {})}>
        <View style={styles.leftSection}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={[styles.title, { color: THEME.textSecondary }]}>InnerOrbit</Text>
        </View>
      </View>

      {/* Window Controls (Not draggable) */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handleMinimize} style={styles.controlButton}>
          <Text style={styles.controlIcon}></Text> {/* Segoe Fluent Icons: Minimize */}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleMaximize} style={styles.controlButton}>
          <Text style={styles.controlIcon}>{isMaximized ? '' : ''}</Text> {/* Restore/Maximize */}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleClose} style={[styles.controlButton, styles.closeButton]}>
          <Text style={styles.controlIcon}></Text> {/* Close */}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 9999,
    // Web specific draggable region
    ...select({
      web: {
        WebkitAppRegion: 'no-drag',
      }
    })
  },
  dragArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    ...select({
      web: {
        WebkitAppRegion: 'drag',
      }
    })
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  logo: {
    width: 16,
    height: 16,
    marginRight: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: 'row',
    height: '100%',
    ...select({
      web: {
        WebkitAppRegion: 'no-drag',
      }
    })
  },
  controlButton: {
    width: 46,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    paddingTop: 1,
  },
  controlIcon: {
    fontFamily: 'Segoe Fluent Icons', // Standard Win11 font
    fontSize: 10,
    color: '#FFFFFF',
  }
});

export default DesktopTitleBar;
