# Last Updated: 2026-03-17
# Description: Automated script for download-flutter.ps1
# Project Role: DevOps / Infrastructure automation.
# Simple Flutter Download Script
# This uses BITS (Background Intelligent Transfer Service) for reliable downloads

$DOWNLOAD_URL = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.29.3-stable.zip"
$DOWNLOAD_PATH = "$env:USERPROFILE\Downloads\flutter_windows_3.29.3-stable.zip"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Flutter SDK Download (Using BITS Transfer)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Download URL: $DOWNLOAD_URL" -ForegroundColor White
Write-Host "Save Location: $DOWNLOAD_PATH" -ForegroundColor White
Write-Host "File Size: ~1.5 GB" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting download... This may take 5-15 minutes." -ForegroundColor Green
Write-Host ""

try {
    Import-Module BitsTransfer
    Start-BitsTransfer -Source $DOWNLOAD_URL -Destination $DOWNLOAD_PATH -DisplayName "Flutter SDK" -Description "Downloading Flutter 3.29.3"
    
    Write-Host ""
    Write-Host "SUCCESS: Download completed!" -ForegroundColor Green
    
    $fileSize = (Get-Item $DOWNLOAD_PATH).Length / 1MB
    Write-Host "File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
    Write-Host "Location: $DOWNLOAD_PATH" -ForegroundColor White
    Write-Host ""
    Write-Host "Next step: Run .\install-flutter-v2.ps1 to complete installation" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Download manually from your browser:" -ForegroundColor Yellow
    Write-Host $DOWNLOAD_URL -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Save to: $DOWNLOAD_PATH" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
