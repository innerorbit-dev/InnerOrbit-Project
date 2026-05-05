const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. Build new preload.js
const logoPath = path.join(rootDir, 'assets/InnerOrbit-Logo.png');
const base64Logo = fs.readFileSync(logoPath).toString('base64');

const preloadJs = `/**
 * Purpose: Secure IPC bridge between the Electron main process and React Native Web renderer.
 * Injects instantaneous preloader HTML/CSS to hide React Native initialization delays.
 */
const { contextBridge, ipcRenderer } = require('electron');

// --- Instantaneous Desktop Preloader ---
// This injects a high-performance CSS/HTML preloader before React Native even parses.
window.addEventListener('DOMContentLoaded', () => {
    // Only inject if not in setup mode (installer)
    if (window.location.search.includes('mode=setup')) return;

    const style = document.createElement('style');
    style.textContent = \\\`
        #electron-instant-preloader {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: #000000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 999999; /* Absolute top */
            transition: opacity 0.5s ease;
        }
        #electron-instant-preloader .logo-container {
            margin-bottom: 32px;
            padding: 24px;
            background-color: rgba(255, 255, 255, 0.03);
            border-radius: 32px;
            animation: pulse-loader 2s ease-in-out infinite;
        }
        #electron-instant-preloader img {
            width: 100px;
            height: 100px;
            object-fit: contain;
        }
        #electron-instant-preloader .spinner {
            width: 36px;
            height: 36px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top: 4px solid #F43F5E; /* Theme primary */
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes pulse-loader {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        /* Hide Expo Error overlay entirely beneath the preloader */
        body { background-color: #000; } 
    \\\`;
    document.head.appendChild(style);

    const preloader = document.createElement('div');
    preloader.id = 'electron-instant-preloader';
    
    const logoContainer = document.createElement('div');
    logoContainer.className = 'logo-container';
    
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,' + base64Logo + '';
    
    logoContainer.appendChild(img);
    preloader.appendChild(logoContainer);
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    preloader.appendChild(spinner);
    
    document.body.appendChild(preloader);
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    // Hide preloader
    hidePreloader: () => {
        const preloader = document.getElementById('electron-instant-preloader');
        if (preloader) {
            preloader.style.opacity = '0';
            setTimeout(() => preloader.remove(), 500);
        }
    },

    // Show notification
    showNotification: (title, body, data) =>
        ipcRenderer.invoke('show-notification', { title, body, data }),

    // Set badge count
    setBadgeCount: (count) =>
        ipcRenderer.invoke('set-badge-count', count),

    // Play notification sound
    playNotificationSound: () =>
        ipcRenderer.invoke('play-notification-sound'),

    // Screenshot protection (Windows desktop)
    setScreenshotProtection: (enabled) =>
        ipcRenderer.invoke('set-screenshot-protection', enabled),

    // Mark setup as complete
    completeSetup: () =>
        ipcRenderer.invoke('complete-setup'),

    // Listen for notification replies
    onNotificationReply: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('on-notification-reply', subscription);
        return () => ipcRenderer.removeListener('on-notification-reply', subscription);
    },

    // Platform info
    platform: process.platform,
    isElectron: true,

    // Window controls for frameless mode
    windowControls: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
        isMaximized: () => ipcRenderer.sendSync('window-is-maximized')
    }
});
`;

fs.writeFileSync(path.join(rootDir, 'desktop/preload.js'), preloadJs);
console.log('✅ Injected base64 logo and preloader HTML into preload.js');
