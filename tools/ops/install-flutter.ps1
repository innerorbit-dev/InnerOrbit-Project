# Last Updated: 2026-03-17
# Description: Automated script for install-flutter.ps1
# Project Role: DevOps / Infrastructure automation.
# Flutter SDK Automated Installation Script for Windows
# Version: 1.0
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

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================
# MAIN INSTALLATION PROCESS
# ============================================

Write-ColorOutput @"

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     FLUTTER SDK INSTALLATION SCRIPT                      ║
║     Version: $FLUTTER_VERSION (Stable)                            ║
║     Platform: Windows                                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

"@ "Green"

# ============================================
# STEP 1: Pre-Installation Checks
# ============================================
Write-Step "STEP 1: Pre-Installation Checks"

# Check if Flutter is already installed
if (Test-Path "$FLUTTER_PATH\bin\flutter.bat") {
    Write-ColorOutput "⚠️  Flutter is already installed at: $FLUTTER_PATH" "Yellow"
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
    Write-ColorOutput "❌ Insufficient disk space! Need at least 3 GB free." "Red"
    exit 1
}

Write-ColorOutput "✅ Disk space check passed" "Green"

# ============================================
# STEP 2: Create Installation Directory
# ============================================
Write-Step "STEP 2: Creating Installation Directory"

if (-not (Test-Path $INSTALL_DIR)) {
    Write-ColorOutput "Creating directory: $INSTALL_DIR" "White"
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    Write-ColorOutput "✅ Directory created successfully" "Green"
} else {
    Write-ColorOutput "✅ Directory already exists: $INSTALL_DIR" "Green"
}

# ============================================
# STEP 3: Download Flutter SDK
# ============================================
Write-Step "STEP 3: Downloading Flutter SDK"

if (Test-Path $DOWNLOAD_PATH) {
    Write-ColorOutput "⚠️  Flutter SDK already downloaded at: $DOWNLOAD_PATH" "Yellow"
    $response = Read-Host "Do you want to re-download? (y/n)"
    if ($response -eq 'y') {
        Remove-Item $DOWNLOAD_PATH -Force
    } else {
        Write-ColorOutput "Using existing download..." "Yellow"
    }
}

if (-not (Test-Path $DOWNLOAD_PATH)) {
    Write-ColorOutput "Downloading Flutter $FLUTTER_VERSION..." "White"
    Write-ColorOutput "URL: $DOWNLOAD_URL" "Gray"
    Write-ColorOutput "This may take several minutes (file size: ~1.5 GB)..." "Yellow"
    
    try {
        # Download with progress
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $DOWNLOAD_PATH -UseBasicParsing
        $ProgressPreference = 'Continue'
        Write-ColorOutput "✅ Download completed successfully" "Green"
    } catch {
        Write-ColorOutput "❌ Download failed: $_" "Red"
        exit 1
    }
} else {
    Write-ColorOutput "✅ Using existing download" "Green"
}

# Verify download
$fileSize = (Get-Item $DOWNLOAD_PATH).Length / 1MB
Write-ColorOutput "Downloaded file size: $([math]::Round($fileSize, 2)) MB" "White"

# ============================================
# STEP 4: Extract Flutter SDK
# ============================================
Write-Step "STEP 4: Extracting Flutter SDK"

if (Test-Path $FLUTTER_PATH) {
    Write-ColorOutput "⚠️  Removing existing Flutter installation..." "Yellow"
    Remove-Item $FLUTTER_PATH -Recurse -Force
}

Write-ColorOutput "Extracting Flutter SDK to: $INSTALL_DIR" "White"
Write-ColorOutput "This may take a few minutes..." "Yellow"

try {
    Expand-Archive -Path $DOWNLOAD_PATH -Destination $INSTALL_DIR -Force
    Write-ColorOutput "✅ Extraction completed successfully" "Green"
} catch {
    Write-ColorOutput "❌ Extraction failed: $_" "Red"
    exit 1
}

# Verify extraction
if (Test-Path "$FLUTTER_PATH\bin\flutter.bat") {
    Write-ColorOutput "✅ Flutter SDK extracted successfully" "Green"
} else {
    Write-ColorOutput "❌ Flutter SDK extraction verification failed" "Red"
    exit 1
}

# ============================================
# STEP 5: Add Flutter to PATH
# ============================================
Write-Step "STEP 5: Adding Flutter to System PATH"

$flutterBin = "$FLUTTER_PATH\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -like "*$flutterBin*") {
    Write-ColorOutput "✅ Flutter is already in PATH" "Green"
} else {
    Write-ColorOutput "Adding Flutter to User PATH..." "White"
    $newPath = "$currentPath;$flutterBin"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    
    # Update current session PATH
    $env:Path = "$env:Path;$flutterBin"
    
    Write-ColorOutput "✅ Flutter added to PATH successfully" "Green"
}

# ============================================
# STEP 6: Verify Installation
# ============================================
Write-Step "STEP 6: Verifying Installation"

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-ColorOutput "Running: flutter --version" "White"
try {
    & "$flutterBin\flutter.bat" --version
    Write-ColorOutput "`n✅ Flutter installation verified" "Green"
} catch {
    Write-ColorOutput "❌ Flutter verification failed: $_" "Red"
    Write-ColorOutput "⚠️  You may need to restart your terminal" "Yellow"
}

# ============================================
# STEP 7: Run Flutter Doctor
# ============================================
Write-Step "STEP 7: Running Flutter Doctor"

Write-ColorOutput "Checking Flutter environment..." "White"
Write-ColorOutput "This will identify any missing dependencies`n" "Yellow"

try {
    & "$flutterBin\flutter.bat" doctor
} catch {
    Write-ColorOutput "❌ Flutter doctor failed: $_" "Red"
}

# ============================================
# STEP 8: Clean Up (Optional)
# ============================================
Write-Step "STEP 8: Clean Up"

$cleanup = Read-Host "Do you want to delete the downloaded ZIP file to save space? (y/n)"
if ($cleanup -eq 'y') {
    Remove-Item $DOWNLOAD_PATH -Force
    Write-ColorOutput "✅ Downloaded ZIP file deleted" "Green"
} else {
    Write-ColorOutput "Downloaded ZIP kept at: $DOWNLOAD_PATH" "Yellow"
}

# ============================================
# INSTALLATION COMPLETE
# ============================================
Write-ColorOutput @"

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ✅ FLUTTER INSTALLATION COMPLETED!                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

"@ "Green"

Write-ColorOutput "Installation Summary:" "Cyan"
Write-ColorOutput "  • Flutter Version: $FLUTTER_VERSION" "White"
Write-ColorOutput "  • Installation Path: $FLUTTER_PATH" "White"
Write-ColorOutput "  • Added to PATH: Yes" "White"

Write-ColorOutput "`n⚠️  IMPORTANT NEXT STEPS:" "Yellow"
Write-ColorOutput "  1. Close and reopen your terminal/PowerShell" "White"
Write-ColorOutput "  2. Run: flutter doctor" "White"
Write-ColorOutput "  3. Install any missing dependencies shown by flutter doctor" "White"
Write-ColorOutput "  4. Accept Android licenses: flutter doctor --android-licenses" "White"
Write-ColorOutput "  5. Navigate to your project and run: flutter pub get" "White"

Write-ColorOutput "`n📚 Documentation:" "Cyan"
Write-ColorOutput "  • Installation Guide: FLUTTER_INSTALLATION_GUIDE.md" "White"
Write-ColorOutput "  • Official Docs: https://docs.flutter.dev" "White"

Write-ColorOutput "`n🎉 Happy Flutter Development!" "Green"

# Pause to see results
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

