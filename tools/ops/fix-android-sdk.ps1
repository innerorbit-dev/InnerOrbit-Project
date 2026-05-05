# Last Updated: 2026-03-17
# Description: Automated script for fix-android-sdk.ps1
# Project Role: DevOps / Infrastructure automation.
# Fix Android SDK Command-line Tools
# This script manually installs the missing cmdline-tools component

# Use dynamic paths instead of hardcoded ones
$ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\sdk"
$CMDLINE_TOOLS_DIR = "$ANDROID_SDK_ROOT\cmdline-tools"
$DOWNLOAD_URL = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
$DOWNLOAD_PATH = "$env:USERPROFILE\Downloads\commandlinetools-win-latest.zip"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FIXING ANDROID TOOLCHAIN ISSUES" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Android SDK exists
if (-not (Test-Path $ANDROID_SDK_ROOT)) {
    Write-Host "❌ Android SDK not found at: $ANDROID_SDK_ROOT" -ForegroundColor Red
    Write-Host "Please install Android Studio first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Android SDK found at: $ANDROID_SDK_ROOT" -ForegroundColor Green
Write-Host ""

# 1. Create directory
if (-not (Test-Path $CMDLINE_TOOLS_DIR)) {
    Write-Host "Creating directory: $CMDLINE_TOOLS_DIR" -ForegroundColor White
    New-Item -ItemType Directory -Path $CMDLINE_TOOLS_DIR -Force | Out-Null
}

# 2. Download tools
if (-not (Test-Path $DOWNLOAD_PATH)) {
    Write-Host "Downloading Command-line Tools..." -ForegroundColor White
    Write-Host "URL: $DOWNLOAD_URL" -ForegroundColor Gray
    
    try {
        Import-Module BitsTransfer
        Start-BitsTransfer -Source $DOWNLOAD_URL -Destination $DOWNLOAD_PATH -DisplayName "Android Cmdline Tools"
        Write-Host "Download complete." -ForegroundColor Green
    }
    catch {
        Write-Host "Download failed: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "Using existing download: $DOWNLOAD_PATH" -ForegroundColor Green
}

# 3. Extract
Write-Host "Extracting tools..." -ForegroundColor White
$TEMP_DIR = "$CMDLINE_TOOLS_DIR\temp_extract"
if (Test-Path $TEMP_DIR) { Remove-Item $TEMP_DIR -Recurse -Force }
New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null

Expand-Archive -Path $DOWNLOAD_PATH -Destination $TEMP_DIR -Force

# 4. Re-structure folders
# The zip contains "cmdline-tools\bin", but SDK expects "cmdline-tools\latest\bin"

$SOURCE_INNER = "$TEMP_DIR\cmdline-tools"
$DEST_LATEST = "$CMDLINE_TOOLS_DIR\latest"

if (Test-Path $DEST_LATEST) {
    Write-Host "Removing existing 'latest' version..." -ForegroundColor Yellow
    Remove-Item $DEST_LATEST -Recurse -Force
}

Write-Host "Setting up 'latest' directory..." -ForegroundColor White
Move-Item -Path $SOURCE_INNER -Destination $DEST_LATEST

# Cleanup
Remove-Item $TEMP_DIR -Recurse -Force
Remove-Item $DOWNLOAD_PATH -Force

Write-Host ""
Write-Host "SUCCESS: Command-line tools installed!" -ForegroundColor Green
Write-Host "Location: $DEST_LATEST" -ForegroundColor White
Write-Host ""

# 5. Find Flutter executable
Write-Host "Locating Flutter..." -ForegroundColor Cyan

$FLUTTER_BIN = $null

# Check common locations
$FLUTTER_PATHS = @(
    "C:\src\flutter\bin\flutter.bat",
    "$env:USERPROFILE\flutter\bin\flutter.bat",
    "$env:LOCALAPPDATA\flutter\bin\flutter.bat"
)

foreach ($path in $FLUTTER_PATHS) {
    if (Test-Path $path) {
        $FLUTTER_BIN = $path
        Write-Host "✅ Found Flutter at: $path" -ForegroundColor Green
        break
    }
}

# Try PATH
if (-not $FLUTTER_BIN) {
    if (Get-Command flutter -ErrorAction SilentlyContinue) {
        $FLUTTER_BIN = "flutter"
        Write-Host "✅ Found Flutter in PATH" -ForegroundColor Green
    }
}

if (-not $FLUTTER_BIN) {
    Write-Host "⚠️  Flutter not found in common locations or PATH" -ForegroundColor Yellow
    Write-Host "Skipping license acceptance. Run manually:" -ForegroundColor Yellow
    Write-Host "  flutter doctor --android-licenses" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 0
}

# 6. Accept Licenses
Write-Host ""
Write-Host "Attempting to accept Android licenses..." -ForegroundColor Cyan
Write-Host "You may need to type 'y' multiple times if prompted." -ForegroundColor Yellow
Write-Host ""

& $FLUTTER_BIN doctor --android-licenses

Write-Host ""
Write-Host "Running final diagnostics..." -ForegroundColor Cyan
& $FLUTTER_BIN doctor -v

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
