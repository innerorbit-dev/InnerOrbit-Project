# Last Updated: 2026-03-17
# Description: Automated script for install-vs-desktop.ps1
# Project Role: DevOps / Infrastructure automation.
# Visual Studio 2022 Installer for Flutter Windows Development
# This script downloads and launches the VS Installer with C++ workload pre-selected

$DOWNLOAD_URL = "https://aka.ms/vs/17/release/vs_community.exe"
$INSTALLER_PATH = "$env:USERPROFILE\Downloads\vs_community.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  VISUAL STUDIO 2022 INSTALLER HELPER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Arguments: Preparing for Flutter Windows Desktop (.exe) development" -ForegroundColor White
Write-Host "Required Workload: Desktop development with C++" -ForegroundColor Yellow
Write-Host ""

# 1. Download Installer
if (-not (Test-Path $INSTALLER_PATH)) {
    Write-Host "Downloading Visual Studio Installer..." -ForegroundColor White
    try {
        Import-Module BitsTransfer
        Start-BitsTransfer -Source $DOWNLOAD_URL -Destination $INSTALLER_PATH -DisplayName "VS Community Installer"
        Write-Host "Download complete." -ForegroundColor Green
    } catch {
        Write-Host "Download failed. Please download manually from: https://visualstudio.microsoft.com/downloads/" -ForegroundColor Red
        exit 1
    }
}

# 2. Launch Installer
Write-Host "Launching Installer..." -ForegroundColor Green
Write-Host "Please wait for the Visual Studio Installer window to appear." -ForegroundColor Yellow
Write-Host "It will automatically select 'Desktop development with C++'." -ForegroundColor White
Write-Host ""
Write-Host "ACTION REQUIRED: Click 'Confirm' or 'Install' when the window opens." -ForegroundColor Cyan
Write-Host ""

# Launch with required arguments for Flutter
$process = Start-Process -FilePath $INSTALLER_PATH -ArgumentList "--add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended --passive --norestart" -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host "Installation started successfully!" -ForegroundColor Green
} else {
    Write-Host "Installer finished directly. Please check if Visual Studio is installed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "After installation completes:" -ForegroundColor Cyan
Write-Host "1. Restart your computer" -ForegroundColor White
Write-Host "2. Run: flutter doctor" -ForegroundColor White
Write-Host "3. Run: flutter run -d windows" -ForegroundColor White

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
