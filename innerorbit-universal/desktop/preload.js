/**
 * Purpose: Secure IPC bridge between the Electron main process and React Native Web renderer. 
 * Allows the web app to access native desktop features like notifications, badges, and 
 * screenshot protection in a secure, isolated manner.
 */
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
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

    // Hardware Level Security (TPM/DPAPI)
    safeStorage: {
        encrypt: (plaintext) => ipcRenderer.invoke('safe-storage-encrypt', plaintext),
        decrypt: (ciphertext) => ipcRenderer.invoke('safe-storage-decrypt', ciphertext)
    },

    // Window controls for frameless mode
    windowControls: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
        isMaximized: () => ipcRenderer.sendSync('window-is-maximized')
    }
});
