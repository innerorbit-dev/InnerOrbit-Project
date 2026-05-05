/**
 * Purpose: Electron main process entry point. Handles window creation, local static server, 
 * IPC communication, native notifications, and auto-updates for the desktop application.
 */
const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Logger } = require(path.join(__dirname, '../lib/logger'));

let mainWindow;

// --- Local Static Server Setup ---
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

function startLocalServer() {
    return new Promise((resolve) => {
        const serveDir = path.join(__dirname, '../dist');
        const server = http.createServer((req, res) => {
            // Basic security: normalize path and ensure it stays in serveDir
            const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
            let filePath = path.join(serveDir, safePath === '/' ? 'index.html' : safePath);

            // Access control for Windows paths
            if (!filePath.startsWith(serveDir)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        // If file not found, check if it's a route (no extension) and serve index.html
                        if (!path.extname(safePath) || safePath.indexOf('.') === -1) {
                            fs.readFile(path.join(serveDir, 'index.html'), (err, indexContent) => {
                                if (err) { res.writeHead(500); res.end('Error loading index'); }
                                else {
                                    res.writeHead(200, { 'Content-Type': 'text/html' });
                                    res.end(indexContent, 'utf-8');
                                }
                            });
                        } else {
                            res.writeHead(404);
                            res.end('Not Found');
                        }
                    } else {
                        res.writeHead(500);
                        res.end('Server Error: ' + error.code);
                    }
                } else {
                    const extname = String(path.extname(filePath)).toLowerCase();
                    const contentType = mimeTypes[extname] || 'application/octet-stream';
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        });

        // Listen on random free port
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            Logger.log(`Local server running at http://127.0.0.1:${port}`);
            resolve(`http://127.0.0.1:${port}`);
        });
    });
}

async function createWindow() {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    let isFirstRun = !fs.existsSync(configPath);

    const serverUrl = await startLocalServer();
    let startUrl = process.env.ELECTRON_START_URL || serverUrl;

    if (isFirstRun) {
        Logger.log('First run detected - entering Setup Mode...');
        startUrl += (startUrl.includes('?') ? '&' : '?') + 'mode=setup';
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#00000000', // Set to transparent for Mica
        frame: false, // Frameless
        titleBarStyle: 'hidden',
        backgroundMaterial: 'mica', // Windows 11 Mica effect
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'InnerOrbit Desktop',
        autoHideMenuBar: true,
    });

    // Window control handlers
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow.close());
    ipcMain.on('window-is-maximized', (event) => {
        event.returnValue = mainWindow.isMaximized();
    });

    // Load from local server instead of file://
    Logger.log(`Loading URL: ${startUrl}`);
    mainWindow.loadURL(startUrl);

    // If first run, use specialized window size/style for installer feel
    if (isFirstRun) {
        mainWindow.setSize(550, 650);
        mainWindow.center();
        mainWindow.setResizable(false);
    }

    // Open DevTools to debug the blank screen if it persists
    // mainWindow.webContents.openDevTools(); 

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle window focus for badge clearing
    mainWindow.on('focus', () => {
        if (process.platform === 'win32') {
            mainWindow.flashFrame(false);
        }
    });
}

// Screenshot protection for Windows desktop
ipcMain.handle('set-screenshot-protection', async (event, enabled) => {
    if (mainWindow) {
        // setContentProtection prevents screenshots and screen recording on Windows
        mainWindow.setContentProtection(enabled);
        return { success: true, enabled };
    }
    return { success: false };
});

// IPC handler to mark setup as complete
ipcMain.handle('complete-setup', async () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify({ setupComplete: true, timestamp: Date.now() }));
        Logger.success('Setup flagged as complete in config.json');

        // Transition window back to normal app mode
        if (mainWindow) {
            mainWindow.setResizable(true);
            mainWindow.setMaximizable(true);
            mainWindow.setMinimizable(true);
            mainWindow.setMinimumSize(800, 600);
            mainWindow.setSize(1200, 800);
            mainWindow.center();
        }
        return { success: true };
    } catch (e) {
        Logger.error('Failed to save setup config:', e);
        return { success: false };
    }
});

// Notification handling for Windows/macOS
ipcMain.handle('show-notification', async (event, { title, body, data }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title,
            body,
            icon: path.join(__dirname, '../assets/icon.png'),
            silent: false,
            urgency: 'normal',
            // On macOS, we can use actions for quick reply. 
            // On Windows, it's limited to clicking the notification.
            actions: process.platform === 'darwin' ? [{ type: 'button', text: 'Reply' }] : []
        });

        notification.on('click', () => {
            // Focus the window when notification is clicked
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                
                // Signal to renderer that this conversation should be opened
                mainWindow.webContents.send('on-notification-click', data);
            }
        });

        // Handle macOS reply button
        notification.on('action', (event, index) => {
            if (process.platform === 'darwin' && index === 0) {
                // Focus and signal reply
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                    mainWindow.webContents.send('on-notification-reply-click', data);
                }
            }
        });

        notification.show();
        return { success: true };
    }
    return { success: false, error: 'Notifications not supported' };
});

// Badge count for Windows taskbar
ipcMain.handle('set-badge-count', async (event, count) => {
    if (mainWindow) {
        if (count > 0) {
            // Flash taskbar icon on Windows
            if (process.platform === 'win32') {
                mainWindow.flashFrame(true);
            }
            // Set badge count (macOS/Linux)
            app.setBadgeCount(count);
        } else {
            if (process.platform === 'win32') {
                mainWindow.flashFrame(false);
            }
            app.setBadgeCount(0);
        }
        return { success: true };
    }
    return { success: false };
});

// Play notification sound

// --- Update Manager Logic ---
const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const https = require('https');
const pkg = require('../package.json');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function fetchReleaseNotes() {
    return new Promise((resolve) => {
        try {
            const base = pkg.build && pkg.build.extraMetadata && pkg.build.extraMetadata.firebaseUpdateUrl;
            if (!base) return resolve('');
            const url = `${base}release-notes.json?alt=media`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(typeof json === 'string' ? json : json.notes || '');
                    } catch { resolve(''); }
                });
            }).on('error', () => resolve(''));
        } catch { resolve(''); }
    });
}

async function checkForUpdates() {
    try {
        const result = await autoUpdater.checkForUpdates();
        const info = result && result.updateInfo;
        if (!info || !info.version) return;

        let notes = '';
        if (info.releaseNotes) {
            if (Array.isArray(info.releaseNotes)) {
                notes = info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note || '')).join('\n\n');
            } else {
                notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
            }
        }
        if (!notes) notes = await fetchReleaseNotes();

        const { response } = await dialog.showMessageBox({
            type: 'info',
            title: `Update Available (${info.version})`,
            message: 'A new version is available.',
            detail: notes || 'Bug fixes and improvements.',
            buttons: ['Download & Install', 'Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (response === 0) {
            await autoUpdater.downloadUpdate();
        }
    } catch (error) {
        Logger.error('Update check failed:', error);
    }
}

autoUpdater.on('update-available', () => Logger.log('Update available.'));
autoUpdater.on('update-downloaded', () => {
    Logger.log('Update downloaded.');
    autoUpdater.quitAndInstall();
});
// ----------------------------

app.whenReady().then(() => {
    createWindow();

    // Check for updates after a short delay
    setTimeout(() => {
        checkForUpdates();
    }, 3000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
