# Last Updated: 2026-03-17
# Description: Automated script for build-desktop.ps1
# Project Role: DevOps / Infrastructure automation.
# InnerOrbit Desktop - Build Script
# Builds Windows .exe from React Native app

Write-Host "🚀 InnerOrbit Desktop Builder" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Navigate to app directory
$APP_DIR = "$PSScriptRoot\..\innerorbit-universal"

if (-not (Test-Path $APP_DIR)) {
    Write-Host "❌ Error: innerorbit-universal directory not found!" -ForegroundColor Red
    Write-Host "Expected location: $APP_DIR" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Working directory: $APP_DIR`n" -ForegroundColor Gray
Set-Location $APP_DIR

# Step 1: Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies first..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Build web version
Write-Host "🌐 Step 1: Building web version..." -ForegroundColor Yellow
npm run build:web

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build web version" -ForegroundColor Red
    exit 1
}

# Step 3: Patch for Electron
Write-Host "`n🔧 Step 2: Patching for Electron..." -ForegroundColor Yellow
node scripts/patch-web-build.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to patch build" -ForegroundColor Red
    exit 1
}

# Step 4: Build Windows executable
Write-Host "`n🖥️  Step 3: Building Windows .exe..." -ForegroundColor Yellow
npx electron-builder --win

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build .exe" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Build Complete!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan
Write-Host "📁 Your .exe files are ready:" -ForegroundColor Green
Write-Host "  - Installer: dist/CipherPlay Setup.exe" -ForegroundColor White
Write-Host "  - Portable:  dist/win-unpacked/CipherPlay.exe" -ForegroundColor White
Write-Host "`nYou can now distribute these files!`n" -ForegroundColor Cyan
