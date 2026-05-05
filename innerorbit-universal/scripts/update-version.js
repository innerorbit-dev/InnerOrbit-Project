/**
 * Last Updated: 2026-03-17
 * Purpose: Logical version incrementer for app.json. Supports 'patch', 'minor', and 'major' flags.
 * Also synchronizes the Android versionCode to maintain build compatibility.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = require(appJsonPath);

const type = process.argv[2] || 'patch'; // patch, minor, major

const currentVersion = appJson.expo.version;
const parts = currentVersion.split('.').map(Number);

if (type === 'major') {
    parts[0]++;
    parts[1] = 0;
    parts[2] = 0;
} else if (type === 'minor') {
    parts[1]++;
    parts[2] = 0; // Reset patch
} else {
    parts[2]++; // Default to patch
}

const newVersion = parts.join('.');
appJson.expo.version = newVersion;

// Also update Android versionCode (must be integer)
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = (appJson.expo.android.versionCode || 1) + 1;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 4));

console.log(`✅ Version updated: ${currentVersion} -> ${newVersion}`);
console.log(`📱 Android Version Code: ${appJson.expo.android.versionCode}`);
