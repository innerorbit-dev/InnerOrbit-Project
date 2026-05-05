# Last Updated: 2026-03-17
# Description: Automated script for install-flutter-v2.ps1
# Project Role: DevOps / Infrastructure automation.
# Flutter SDK Automated Installation Script for Windows
# Version: 1.2 (With Download Retry)
# Date: January 8, 2026
# Flutter Version: 3.29.3 (Stable)

# ============================================
# CONFIGURATION
# ============================================
$FLUTTER_VERSION = "3.29.3"
$FLUTTER_CHANNEL = "stable"
$DOWNLOAD_URL = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_${FLUTTER_VERSION}-stable.zip"
$INSTALL_DIR = "C:\src"
$FLUTTER_PATH = "$INSTALL_DIR\flutter"
$DOWNLOAD_PATH = "$env:USERPROFILE\Downloads\flutter_windows_${FLUTTER_VERSION}-stable.zip"

# ============================================
# HELPER FUNCTIONS
# ============================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput $Message "Cyan"
    Write-ColorOutput "========================================`n" "Cyan"
}

function Download-FileWithProgress {
    param(
        [string]$Url,
        [string]$OutputPath
    )
    
    try {
        Write-ColorOutput "Starting download with progress tracking..." "White"
        
        # Use BITS transfer for better reliability with large files
        Import-Module BitsTransfer
        Start-BitsTransfer -Source $Url -Destination $OutputPath -DisplayName "Flutter SDK Download" -Description "Downloading Flutter $FLUTTER_VERSION"
        
        return $true
    } catch {
        Write-ColorOutput "BITS transfer failed, trying alternative method..." "Yellow"
        
        try {
            # Fallback to WebClient with longer timeout
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($Url, $OutputPath)
            return $true
        } catch {
            Write-ColorOutput "Download failed: $_" "Red"
            return $false
        }
    }
}

# ============================================
# MAIN INSTALLATION PROCESS
# ============================================

Write-ColorOutput "" "Green"
Write-ColorOutput "============================================================" "Green"
Write-ColorOutput "     FLUTTER SDK INSTALLATION SCRIPT" "Green"
Write-ColorOutput "     Version: $FLUTTER_VERSION (Stable)" "Green"
Write-ColorOutput "     Platform: Windows" "Green"
Write-ColorOutput "============================================================" "Green"
Write-ColorOutput "" "Green"

# ============================================
# STEP 1: Pre-Installation Checks
# ============================================
Write-Step "STEP 1: Pre-Installation Checks"

# Check if Flutter is already installed
if (Test-Path "$FLUTTER_PATH\bin\flutter.bat") {
    Write-ColorOutput "WARNING: Flutter is already installed at: $FLUTTER_PATH" "Yellow"
    $response = Read-Host "Do you want to reinstall? (y/n)"
    if ($response -ne 'y') {
        Write-ColorOutput "Installation cancelled." "Red"
        exit
    }
}

# Check disk space (need at least 3 GB)
$drive = (Get-Item $INSTALL_DIR -ErrorAction SilentlyContinue).PSDrive.Name
if (-not $drive) {
    $drive = "C"
}
$freeSpace = (Get-PSDrive $drive).Free / 1GB
Write-ColorOutput "Available disk space on ${drive}: $([math]::Round($freeSpace, 2)) GB" "White"

if ($freeSpace -lt 3) {
    Write-ColorOutput "ERROR: Insufficient disk space! Need at least 3 GB free." "Red"
    exit 1
}

Write-ColorOutput "SUCCESS: Disk space check passed" "Green"

# ============================================
# STEP 2: Create Installation Directory
# ============================================
Write-Step "STEP 2: Creating Installation Directory"

if (-not (Test-Path $INSTALL_DIR)) {
    Write-ColorOutput "Creating directory: $INSTALL_DIR" "White"
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    Write-ColorOutput "SUCCESS: Directory created successfully" "Green"
} else {
    Write-ColorOutput "SUCCESS: Directory already exists: $INSTALL_DIR" "Green"
}

# ============================================
# STEP 3: Download Flutter SDK
# ============================================
Write-Step "STEP 3: Downloading Flutter SDK"

if (Test-Path $DOWNLOAD_PATH) {
    $fileSize = (Get-Item $DOWNLOAD_PATH).Length / 1MB
    Write-ColorOutput "WARNING: Flutter SDK already exists at: $DOWNLOAD_PATH" "Yellow"
    Write-ColorOutput "File size: $([math]::Round($fileSize, 2)) MB" "White"
    
    # Check if file is complete (should be around 1000+ MB)
    if ($fileSize -gt 500) {
        $response = Read-Host "File appears complete. Use existing download? (y/n)"
        if ($response -eq 'y') {
            Write-ColorOutput "Using existing download..." "Green"
        } else {
            Remove-Item $DOWNLOAD_PATH -Force
            Write-ColorOutput "Deleted existing file. Will re-download..." "Yellow"
        }
    } else {
        Write-ColorOutput "File appears incomplete. Deleting and re-downloading..." "Yellow"
        Remove-Item $DOWNLOAD_PATH -Force
    }
}

if (-not (Test-Path $DOWNLOAD_PATH)) {
    Write-ColorOutput "Downloading Flutter $FLUTTER_VERSION..." "White"
    Write-ColorOutput "URL: $DOWNLOAD_URL" "Gray"
    Write-ColorOutput "Destination: $DOWNLOAD_PATH" "Gray"
    Write-ColorOutput "" "White"
    Write-ColorOutput "This will take 5-15 minutes depending on your internet speed..." "Yellow"
    Write-ColorOutput "File size: ~1.5 GB (1500+ MB)" "Yellow"
    Write-ColorOutput "" "White"
    
    $downloadSuccess = Download-FileWithProgress -Url $DOWNLOAD_URL -OutputPath $DOWNLOAD_PATH
    
    if (-not $downloadSuccess) {
        Write-ColorOutput "" "Red"
        Write-ColorOutput "ERROR: Download failed!" "Red"
        Write-ColorOutput "" "Yellow"
        Write-ColorOutput "ALTERNATIVE OPTIONS:" "Yellow"
        Write-ColorOutput "1. Download manually from:" "White"
        Write-ColorOutput "   $DOWNLOAD_URL" "Cyan"
        Write-ColorOutput "2. Save to: $DOWNLOAD_PATH" "White"
        Write-ColorOutput "3. Run this script again" "White"
        exit 1
    }
    
    Write-ColorOutput "SUCCESS: Download completed successfully" "Green"
}

# Verify download
if (Test-Path $DOWNLOAD_PATH) {
    $fileSize = (Get-Item $DOWNLOAD_PATH).Length / 1MB
    Write-ColorOutput "Downloaded file size: $([math]::Round($fileSize, 2)) MB" "White"
    
    if ($fileSize -lt 500) {
        Write-ColorOutput "WARNING: File size seems too small. Download may be incomplete." "Yellow"
        $response = Read-Host "Continue anyway? (y/n)"
        if ($response -ne 'y') {
            exit 1
        }
    }
} else {
    Write-ColorOutput "ERROR: Download file not found!" "Red"
    exit 1
}

# ============================================
# STEP 4: Extract Flutter SDK
# ============================================
Write-Step "STEP 4: Extracting Flutter SDK"

if (Test-Path $FLUTTER_PATH) {
    Write-ColorOutput "WARNING: Removing existing Flutter installation..." "Yellow"
    Remove-Item $FLUTTER_PATH -Recurse -Force
}

Write-ColorOutput "Extracting Flutter SDK to: $INSTALL_DIR" "White"
Write-ColorOutput "This may take 2-5 minutes..." "Yellow"

try {
    Expand-Archive -Path $DOWNLOAD_PATH -Destination $INSTALL_DIR -Force
    Write-ColorOutput "SUCCESS: Extraction completed successfully" "Green"
} catch {
    Write-ColorOutput "ERROR: Extraction failed: $_" "Red"
    Write-ColorOutput "You may need to extract manually using Windows Explorer" "Yellow"
    exit 1
}

# Verify extraction
if (Test-Path "$FLUTTER_PATH\bin\flutter.bat") {
    Write-ColorOutput "SUCCESS: Flutter SDK extracted successfully" "Green"
} else {
    Write-ColorOutput "ERROR: Flutter SDK extraction verification failed" "Red"
    Write-ColorOutput "Expected file not found: $FLUTTER_PATH\bin\flutter.bat" "Red"
    exit 1
}

# ============================================
# STEP 5: Add Flutter to PATH
# ============================================
Write-Step "STEP 5: Adding Flutter to System PATH"

$flutterBin = "$FLUTTER_PATH\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -like "*$flutterBin*") {
    Write-ColorOutput "SUCCESS: Flutter is already in PATH" "Green"
} else {
    Write-ColorOutput "Adding Flutter to User PATH..." "White"
    $newPath = "$currentPath;$flutterBin"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    
    # Update current session PATH
    $env:Path = "$env:Path;$flutterBin"
    
    Write-ColorOutput "SUCCESS: Flutter added to PATH successfully" "Green"
}

# ============================================
# STEP 6: Verify Installation
# ============================================
Write-Step "STEP 6: Verifying Installation"

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-ColorOutput "Running: flutter --version" "White"
Write-ColorOutput "" "White"

try {
    & "$flutterBin\flutter.bat" --version
    Write-ColorOutput "" "Green"
    Write-ColorOutput "SUCCESS: Flutter installation verified" "Green"
} catch {
    Write-ColorOutput "ERROR: Flutter verification failed: $_" "Red"
    Write-ColorOutput "WARNING: You may need to restart your terminal" "Yellow"
}

# ============================================
# STEP 7: Run Flutter Doctor
# ============================================
Write-Step "STEP 7: Running Flutter Doctor"

Write-ColorOutput "Checking Flutter environment..." "White"
Write-ColorOutput "This will identify any missing dependencies" "Yellow"
Write-ColorOutput "" "White"

try {
    & "$flutterBin\flutter.bat" doctor
} catch {
    Write-ColorOutput "ERROR: Flutter doctor failed: $_" "Red"
}

# ============================================
# STEP 8: Clean Up (Optional)
# ============================================
Write-Step "STEP 8: Clean Up"

Write-ColorOutput "The downloaded ZIP file is at: $DOWNLOAD_PATH" "White"
$fileSize = (Get-Item $DOWNLOAD_PATH -ErrorAction SilentlyContinue).Length / 1MB
if ($fileSize) {
    Write-ColorOutput "File size: $([math]::Round($fileSize, 2)) MB" "White"
}

$cleanup = Read-Host "Do you want to delete it to save space? (y/n)"
if ($cleanup -eq 'y') {
    Remove-Item $DOWNLOAD_PATH -Force
    Write-ColorOutput "SUCCESS: Downloaded ZIP file deleted" "Green"
} else {
    Write-ColorOutput "ZIP file kept for future use" "Yellow"
}

# ============================================
# INSTALLATION COMPLETE
# ============================================
Write-ColorOutput "" "Green"
Write-ColorOutput "============================================================" "Green"
Write-ColorOutput "     FLUTTER INSTALLATION COMPLETED!" "Green"
Write-ColorOutput "============================================================" "Green"
Write-ColorOutput "" "Green"

Write-ColorOutput "Installation Summary:" "Cyan"
Write-ColorOutput "  - Flutter Version: $FLUTTER_VERSION" "White"
Write-ColorOutput "  - Installation Path: $FLUTTER_PATH" "White"
Write-ColorOutput "  - Added to PATH: Yes" "White"

Write-ColorOutput "" "Yellow"
Write-ColorOutput "IMPORTANT NEXT STEPS:" "Yellow"
Write-ColorOutput "  1. Close and reopen your terminal/PowerShell" "White"
Write-ColorOutput "  2. Run: flutter doctor" "White"
Write-ColorOutput "  3. Install any missing dependencies shown by flutter doctor" "White"
Write-ColorOutput "  4. Accept Android licenses: flutter doctor --android-licenses" "White"
Write-ColorOutput "  5. Navigate to your project: cd flutter-based-app" "White"
Write-ColorOutput "  6. Get dependencies: flutter pub get" "White"

Write-ColorOutput "" "Cyan"
Write-ColorOutput "Documentation:" "Cyan"
Write-ColorOutput "  - Installation Guide: FLUTTER_INSTALLATION_GUIDE.md" "White"
Write-ColorOutput "  - Quick Start: FLUTTER_QUICK_START.md" "White"
Write-ColorOutput "  - Official Docs: https://docs.flutter.dev" "White"

Write-ColorOutput "" "Green"
Write-ColorOutput "Happy Flutter Development!" "Green"
Write-ColorOutput "" "White"

# Pause to see results
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
