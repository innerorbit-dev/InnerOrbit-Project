# Last Updated: 2026-03-17
# Description: Automated script for check-download-status.ps1
# Project Role: DevOps / Infrastructure automation.
# Flutter Download Status Checker

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FLUTTER SDK DOWNLOAD STATUS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$transfer = Get-BitsTransfer | Where-Object { $_.DisplayName -eq "Flutter SDK Download" }

if ($transfer) {
    $totalMB = [math]::Round($transfer.BytesTotal / 1MB, 2)
    $downloadedMB = [math]::Round($transfer.BytesTransferred / 1MB, 2)
    $progress = if($transfer.BytesTotal -gt 0){[math]::Round(($transfer.BytesTransferred/$transfer.BytesTotal)*100,2)}else{0}
    $remainingMB = $totalMB - $downloadedMB
    
    Write-Host "Status: " -NoNewline -ForegroundColor White
    Write-Host $transfer.JobState -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Progress: $progress%" -ForegroundColor Cyan
    
    # Progress bar
    $barLength = 50
    $filledLength = [math]::Floor($barLength * $progress / 100)
    $emptyLength = $barLength - $filledLength
    $progressBar = "[" + ("=" * $filledLength) + (">" * 1) + (" " * ($emptyLength - 1)) + "]"
    Write-Host $progressBar -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Downloaded: $downloadedMB MB / $totalMB MB" -ForegroundColor White
    Write-Host "Remaining: $remainingMB MB" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "Download Location:" -ForegroundColor Cyan
    $localFile = $transfer.FileList | Select-Object -First 1 -ExpandProperty LocalName
    Write-Host "  $localFile" -ForegroundColor White
    
    Write-Host ""
    if ($transfer.JobState -eq "Transferring") {
        Write-Host "Download is in progress... Please wait." -ForegroundColor Green
    } elseif ($transfer.JobState -eq "Transferred") {
        Write-Host "Download completed! The installation script will continue automatically." -ForegroundColor Green
    } elseif ($transfer.JobState -eq "Error") {
        Write-Host "Download encountered an error!" -ForegroundColor Red
    }
    
} else {
    Write-Host "No active Flutter download found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Checking for completed download..." -ForegroundColor White
    
    $downloadPath = "$env:USERPROFILE\Downloads\flutter_windows_3.29.3-stable.zip"
    if (Test-Path $downloadPath) {
        $fileSize = (Get-Item $downloadPath).Length / 1MB
        Write-Host ""
        Write-Host "Found downloaded file:" -ForegroundColor Green
        Write-Host "  Location: $downloadPath" -ForegroundColor White
        Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "No download file found." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
