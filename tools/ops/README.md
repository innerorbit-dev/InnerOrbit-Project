# Ops-Scripts Documentation

This folder contains operational scripts for CipherPlay development and deployment.

---

## 📁 Scripts Overview

### Desktop Build

- **`build-desktop.ps1`** - Build Windows .exe from React Native app

### Flutter Setup

- **`install-flutter.ps1`** - Standard Flutter SDK installation
- **`install-flutter-v2.ps1`** - Alternative Flutter installation method
- **`install-flutter-clean.ps1`** - Clean Flutter installation (removes existing)
- **`download-flutter.ps1`** - Download Flutter SDK only (no install)
- **`check-download-status.ps1`** - Monitor Flutter download progress

### Android Toolchain

- **`fix-android-sdk.ps1`** - Fix missing Android command-line tools

### Development Tools

- **`install-vs-desktop.ps1`** - Install Visual Studio Desktop Development workload

---

## 🚀 Quick Start

### Building Windows Desktop App

```powershell
# From ops-scripts folder:
.\build-desktop.ps1
```

**What it does:**

1. Navigates to `legacy-react-native-app`
2. Builds web version (`npm run build:web`)
3. Patches for Electron (`patch-web-build.js`)
4. Creates Windows .exe (`electron-builder`)

**Output:**

- `dist/CipherPlay Setup.exe` - Installer
- `dist/win-unpacked/CipherPlay.exe` - Portable version

**Requirements:**

- Node.js installed
- npm dependencies installed in `legacy-react-native-app`

---

### Installing Flutter

#### Option 1: Standard Install

```powershell
.\install-flutter.ps1
```

#### Option 2: Alternative Method

```powershell
.\install-flutter-v2.ps1
```

#### Option 3: Clean Install (removes existing)

```powershell
.\install-flutter-clean.ps1
```

**What they do:**

- Download Flutter SDK
- Extract to `C:\src\flutter`
- Add to PATH
- Run `flutter doctor`

**Requirements:**

- Windows 10/11
- Administrator privileges (for PATH modification)
- Internet connection

---

### Monitoring Flutter Download

If download is slow or interrupted:

```powershell
.\check-download-status.ps1
```

**Shows:**

- Download progress (%)
- Downloaded MB / Total MB
- Remaining MB
- Download status

---

### Fixing Android Toolchain

If `flutter doctor` shows Android toolchain issues:

```powershell
.\fix-android-sdk.ps1
```

**What it does:**

- Downloads Android command-line tools
- Installs to `%LOCALAPPDATA%\Android\sdk\cmdline-tools\latest`
- Accepts Android licenses
- Runs `flutter doctor -v`

**Requirements:**

- Android Studio installed
- Internet connection

---

### Installing Visual Studio Desktop Tools

For Windows desktop development:

```powershell
.\install-vs-desktop.ps1
```

**What it does:**

- Downloads VS Build Tools installer
- Installs Desktop Development workload
- Configures for C++ development

**Requirements:**

- ~6GB disk space
- Administrator privileges

---

## 📋 Detailed Script Documentation

### build-desktop.ps1

**Purpose:** Build CipherPlay Windows desktop application

**Usage:**

```powershell
.\build-desktop.ps1
```

**Process:**

1. Checks for `legacy-react-native-app` directory
2. Installs npm dependencies (if needed)
3. Runs `npm run build:web` (Expo web export)
4. Runs `node scripts/patch-web-build.js` (Electron compatibility)
5. Runs `npx electron-builder --win` (Windows .exe)

**Output Location:**

```text
legacy-react-native-app/
  dist/
    CipherPlay Setup.exe        ← Installer
    win-unpacked/
      CipherPlay.exe            ← Portable
```

**Troubleshooting:**

- **"directory not found"** → Run from `ops-scripts` folder
- **"build:web failed"** → Check `package.json` has `build:web` script
- **"patch failed"** → Ensure `scripts/patch-web-build.js` exists
- **"electron-builder failed"** → Check `electron-builder` config in `package.json`

---

### install-flutter.ps1

**Purpose:** Install Flutter SDK to `C:\src\flutter`

**Usage:**

```powershell
.\install-flutter.ps1
```

**Process:**

1. Creates `C:\src` directory
2. Downloads Flutter SDK (BITS transfer)
3. Extracts to `C:\src\flutter`
4. Adds to PATH (User environment variable)
5. Runs `flutter doctor`

**Post-Install:**

- Restart terminal to use `flutter` command
- Run `flutter doctor` to check setup
- Accept Android licenses: `flutter doctor --android-licenses`

**Troubleshooting:**

- **"Download failed"** → Check internet connection, run `.\check-download-status.ps1`
- **"Extraction failed"** → Delete `C:\src\flutter` and retry
- **"PATH not updated"** → Manually add `C:\src\flutter\bin` to PATH

---

### install-flutter-v2.ps1

**Purpose:** Alternative Flutter installation method

**Differences from v1:**

- Different download approach
- Additional error handling
- Verbose logging

**Use when:**

- Standard install fails
- Need more detailed logs
- Troubleshooting installation issues

---

### install-flutter-clean.ps1

**Purpose:** Clean Flutter installation (removes existing)

**Usage:**

```powershell
.\install-flutter-clean.ps1
```

**⚠️ Warning:** Deletes existing `C:\src\flutter` directory

**Use when:**

- Flutter installation is corrupted
- Need to start fresh
- Upgrading to new Flutter version

---

### download-flutter.ps1

**Purpose:** Download Flutter SDK without installing

**Usage:**

```powershell
.\download-flutter.ps1
```

**Downloads to:** `%USERPROFILE%\Downloads\flutter_windows_3.29.3-stable.zip`

**Use when:**

- Want to download first, install later
- Slow internet (resume capability)
- Manual installation preferred

---

### check-download-status.ps1

**Purpose:** Monitor active Flutter download

**Usage:**

```powershell
.\check-download-status.ps1
```

**Shows:**

```text
Status: Transferring
Progress: 45.67%
[======================>                           ]
Downloaded: 456.78 MB / 1000.00 MB
Remaining: 543.22 MB
```

**Use when:**

- Download seems stuck
- Want to monitor progress
- Checking if download completed

---

### fix-android-sdk.ps1

**Purpose:** Fix Android toolchain issues

**Usage:**

```powershell
.\fix-android-sdk.ps1
```

**Fixes:**

- Missing `cmdline-tools`
- Android license errors
- SDK path issues

**Process:**

1. Detects Android SDK location (`%LOCALAPPDATA%\Android\sdk`)
2. Downloads command-line tools
3. Installs to `cmdline-tools\latest`
4. Finds Flutter executable
5. Accepts Android licenses
6. Runs `flutter doctor -v`

**Requirements:**

- Android Studio installed
- Android SDK installed

**Troubleshooting:**

- **"Android SDK not found"** → Install Android Studio first
- **"Flutter not found"** → Install Flutter or add to PATH
- **"License errors"** → Manually run `flutter doctor --android-licenses`

---

### install-vs-desktop.ps1

**Purpose:** Install Visual Studio Desktop Development tools

**Usage:**

```powershell
.\install-vs-desktop.ps1
```

**Installs:**

- Visual Studio Build Tools
- Desktop Development with C++ workload
- Windows 10 SDK
- MSVC compiler

**Size:** ~6GB

**Use for:**

- Building Windows desktop apps
- Native C++ development
- Electron native modules

---

## 🔧 Common Workflows

### First-Time Setup (Flutter Development)

```powershell
# 1. Install Flutter
.\install-flutter.ps1

# 2. Fix Android toolchain (if needed)
.\fix-android-sdk.ps1

# 3. Install VS Desktop tools (for Windows apps)
.\install-vs-desktop.ps1

# 4. Verify setup
flutter doctor -v
```

---

### Building Desktop App for Release

```powershell
# 1. Navigate to ops-scripts
cd ops-scripts

# 2. Run build script
.\build-desktop.ps1

# 3. Find output in:
# legacy-react-native-app/dist/CipherPlay Setup.exe
```

---

### Troubleshooting Flutter Installation

```powershell
# 1. Check download status
.\check-download-status.ps1

# 2. If corrupted, clean install
.\install-flutter-clean.ps1

# 3. Fix Android toolchain
.\fix-android-sdk.ps1

# 4. Verify
flutter doctor -v
```

---

## 📝 Notes

### Path Conventions

- All scripts use **dynamic paths** (environment variables)
- No hardcoded user-specific paths
- Works on any Windows machine

### Environment Variables Used

- `$PSScriptRoot` - Script's own directory
- `$env:USERPROFILE` - User's home directory
- `$env:LOCALAPPDATA` - Local AppData folder
- `$env:TEMP` - Temporary files

### Error Handling

- All scripts check for errors (`$LASTEXITCODE`)
- Exit with code 1 on failure
- Display colored error messages

### Prerequisites

- **Windows 10/11** (PowerShell 5.1+)
- **Administrator privileges** (for PATH modification)
- **Internet connection** (for downloads)

---

## 🐛 Troubleshooting

### "Script cannot be loaded" Error

**Problem:** PowerShell execution policy

**Solution:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### "Access Denied" Error

**Problem:** Need administrator privileges

**Solution:**

1. Right-click PowerShell
2. Select "Run as Administrator"
3. Run script again

---

### "Module not found" Error

**Problem:** Missing PowerShell module

**Solution:**

```powershell
# For BitsTransfer module:
Import-Module BitsTransfer
```

---

### Build Fails with "dist not found"

**Problem:** Web build didn't complete

**Solution:**

```powershell
cd ..\legacy-react-native-app
npm run build:web
node scripts/patch-web-build.js
```

---

## 📞 Support

For issues or questions:

1. Check `AUDIT_REPORT.md` for known issues
2. Review error messages carefully
3. Check prerequisites are met
4. Try clean install if corrupted

---

## 📊 Script Status

| Script | Status | Last Updated |
| --- | --- | --- |
| build-desktop.ps1 | ✅ Fixed | 2026-01-19 |
| fix-android-sdk.ps1 | ✅ Fixed | 2026-01-19 |
| install-flutter.ps1 | ✅ Working | 2026-01-08 |
| install-flutter-v2.ps1 | ✅ Working | 2026-01-08 |
| install-flutter-clean.ps1 | ✅ Working | 2026-01-08 |
| download-flutter.ps1 | ✅ Working | 2026-01-08 |
| check-download-status.ps1 | ✅ Working | 2026-01-08 |
| install-vs-desktop.ps1 | ✅ Working | 2026-01-08 |

**Overall:** 100% Working ✅

---

**Last Updated:** 2026-01-19
**Maintained by:** CipherPlay Team
