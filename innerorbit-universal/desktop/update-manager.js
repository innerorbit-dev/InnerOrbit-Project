/**
 * Purpose: Manages background update checks and interaction with the Electron auto-updater.
 * Connects to Firebase Storage to fetch release notes and handles update dialogues.
 */
const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const https = require('https');
const pkg = require('../package.json');
const { Logger } = require('../lib/logger'); // Assuming commonjs export or compat

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
                    } catch {
                        resolve('');
                    }
                });
            }).on('error', () => resolve(''));
        } catch {
            resolve('');
        }
    });
}

async function checkForUpdates() {
    try {
        const result = await autoUpdater.checkForUpdates();
        const info = result && result.updateInfo;
        if (!info || !info.version) {
            await dialog.showMessageBox({
                type: 'info',
                title: 'Updates',
                message: 'App is up to date.'
            });
            return;
        }
        let notes = '';
        if (info.releaseNotes) {
            if (Array.isArray(info.releaseNotes)) {
                notes = info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note || '')).join('\n\n');
            } else {
                notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
            }
        }
        if (!notes) {
            notes = await fetchReleaseNotes();
        }
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

autoUpdater.on('update-available', () => {
    Logger.log('Update available for download.');
});

autoUpdater.on('update-downloaded', () => {
    Logger.log('Update downloaded; will install now.');
    autoUpdater.quitAndInstall();
});

module.exports = { checkForUpdates };
