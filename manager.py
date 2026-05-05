# Last Updated: 2026-03-17
# Description: Main CLI management script for InnerOrbit. Handles builds, deployments, and utility tasks.
# Project Role: Core entry point for developers to manage the entire ecosystem.

import os
import shutil
import subprocess
import sys
import argparse
import time

# ── ANSI colours (work on Windows 10+ / PowerShell / any modern terminal) ──
class C:
    RST  = "\033[0m"
    BOLD = "\033[1m"
    DIM  = "\033[2m"
    BLUE = "\033[38;5;69m"
    PURP = "\033[38;5;135m"
    CYAN = "\033[38;5;51m"
    GRN  = "\033[38;5;82m"
    YEL  = "\033[38;5;220m"
    RED  = "\033[38;5;196m"
    GRAY = "\033[38;5;240m"
    WHT  = "\033[38;5;255m"

# --- VENV BOOTSTRAP ---
def bootstrap_venv():
    """Ensures the script runs within a virtual environment."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(project_root, ".venv")
    
    # Check if we are already running in the venv
    if sys.prefix == venv_dir:
        return

    # Create venv if it doesn't exist
    if not os.path.exists(venv_dir):
        print(f"[*] Creating virtual environment in {venv_dir}...")
        subprocess.check_call([sys.executable, "-m", "venv", venv_dir])
        print("[+] Virtual environment created.")

    # Determine the venv python executable
    if os.name == "nt":  # Windows
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:  # Linux/macOS
        venv_python = os.path.join(venv_dir, "bin", "python")

    if not os.path.exists(venv_python):
        print(f"[!] Error: Could not find venv python at {venv_python}")
        sys.exit(1)

    # Re-execute the script using the venv python
    print(f"[*] Switching to virtual environment...")
    try:
        # Pass all original arguments to the new process
        os.execv(venv_python, [venv_python] + sys.argv)
    except Exception as e:
        # Fallback if execv fails (e.g. on some Windows versions/setups)
        result = subprocess.run([venv_python] + sys.argv)
        sys.exit(result.returncode)

# Run bootstrap before anything else
if __name__ == "__main__" and "SKIP_VENV_BOOTSTRAP" not in os.environ:
    bootstrap_venv()

# ── Enable ANSI on Windows ──
if os.name == "nt":
    import ctypes
    ctypes.windll.kernel32.SetConsoleMode(
        ctypes.windll.kernel32.GetStdHandle(-11), 7
    )

def _type(text, delay=0.018):
    """Typewriter effect for a single line."""
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    print()

def show_splash():
    os.system('cls' if os.name == 'nt' else 'clear')
    logo = [
        f"{C.BLUE}{C.BOLD}  ██╗███╗  ██╗███╗  ██╗███████╗██████╗  {C.PURP} ██████╗ ██████╗ ██████╗ ██╗████████╗{C.RST}",
        f"{C.BLUE}{C.BOLD}  ██║████╗ ██║████╗ ██║██╔════╝██╔══██╗ {C.PURP}██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝{C.RST}",
        f"{C.CYAN}{C.BOLD}  ██║██╔██╗██║██╔██╗██║█████╗  ██████╔╝ {C.PURP}██║   ██║██████╔╝██████╔╝██║   ██║{C.RST}",
        f"{C.CYAN}{C.BOLD}  ██║██║╚████║██║╚████║██╔══╝  ██╔══██╗ {C.PURP}██║   ██║██╔══██╗██╔══██╗██║   ██║{C.RST}",
        f"{C.PURP}{C.BOLD}  ██║██║ ╚███║██║ ╚███║███████╗██║  ██║ {C.PURP}╚██████╔╝██║  ██║██████╔╝██║   ██║{C.RST}",
        f"{C.PURP}{C.BOLD}  ╚═╝╚═╝  ╚══╝╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝  {C.PURP}╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝{C.RST}",
    ]
    for line in logo:
        print(line)
        time.sleep(0.06)

    print()
    _type(f"  {C.GRAY}Project Console  ·  v1.0  ·  InnerOrbit Dev Tools{C.RST}", delay=0.012)
    print(f"  {C.GRAY}{'─' * 62}{C.RST}")
    time.sleep(0.3)
    _type(f"  {C.GRN}●{C.RST}  Environment ready", delay=0.015)
    _type(f"  {C.BLUE}●{C.RST}  All modules loaded", delay=0.015)
    print()

def ask_terminal():
    """Ask user whether to run in current terminal or open a new window."""
    print(f"  {C.YEL}{C.BOLD}Where would you like to run?{C.RST}")
    print(f"  {C.WHT} 1{C.RST}  {C.CYAN}Current terminal{C.RST}   {C.GRAY}(interactive menu here){C.RST}")
    print(f"  {C.WHT} 2{C.RST}  {C.PURP}New terminal window{C.RST} {C.GRAY}(opens a fresh cmd/pwsh tab){C.RST}")
    print(f"  {C.WHT} G{C.RST}  {C.BLUE}Launch GUI Console{C.RST}  {C.GRAY}(visual project manager){C.RST}")
    print()
    choice = input(f"  {C.BOLD}>{C.RST} ").strip().lower()

    if choice == '2':
        script = os.path.abspath(__file__)
        if os.name == 'nt':
            # Try Windows Terminal first, fall back to cmd
            wt = shutil.which('wt')
            if wt:
                subprocess.Popen([wt, 'new-tab', '--title', 'InnerOrbit Manager',
                                  sys.executable, script])
            else:
                os.system(f'start cmd /k "{sys.executable} {script}"')
        else:
            os.system(f'gnome-terminal -- {sys.executable} {script} &')
        print(f"\n  {C.GRN}Launched in new window.{C.RST}")
        sys.exit(0)
    elif choice == 'g':
        launch_gui()
        sys.exit(0)

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_PORTAL_DIR = os.path.join(PROJECT_ROOT, "download-portal")  # legacy static portal
REACT_PORTAL_DIR = os.path.join(PROJECT_ROOT, "download-portal-react")  # new Vite/React portal
UNIVERSAL_DIR = os.path.join(PROJECT_ROOT, "innerorbit-universal")
ANDROID_DIR = os.path.join(UNIVERSAL_DIR, "android")
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
GUI_DIR = os.path.join(TOOLS_DIR, "gui")

def clear_terminal():
    os.system('cls' if os.name == 'nt' else 'clear')

def check_dual_messenger_compatibility():
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return False, "AndroidManifest.xml not found."
    
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'com.samsung.android.dualmessenger.ENABLED' in content and 'value="true"' in content:
                return True, "Dual Messenger compatibility is ENABLED in AndroidManifest.xml."
            else:
                return False, "Dual Messenger compatibility meta-data NOT found in AndroidManifest.xml."
    except Exception as e:
        return False, f"Error checking manifest: {e}"

def run_command(command, cwd, label=None):
    if label:
        print(f"\n>>> {label}")
    print(f"Running: {' '.join(command)}")
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True,
            encoding='utf-8',
            errors='replace'
        )
        
        for line in process.stdout:
            try:
                print(line, end='')
            except UnicodeEncodeError:
                # Handle cases where the terminal cannot encode some characters
                print(line.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8'), end='')
            
        process.wait()
        return process.returncode
    except Exception as e:
        print(f"Error executing command: {e}")
        return 1

def build_android_debug():
    print("\n--- [BUILD ANDROID DEBUG] ---")
    rc = run_command(["gradlew", "assembleDebug"], ANDROID_DIR, "Building Debug APK")
    if rc == 0:
        apk_path = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
        print(f"\n[SUCCESS] Debug APK Generated: {apk_path}")
        return True
    return False

def build_android_release():
    print("\n--- [BUILD ANDROID RELEASE] ---")
    rc = run_command(["gradlew", "assembleRelease"], ANDROID_DIR, "Building Release APK")
    if rc == 0:
        apk_path = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "release", "app-release.apk")
        print(f"\n[SUCCESS] Release APK Generated: {apk_path}")
        
        is_compat, msg = check_dual_messenger_compatibility()
        if is_compat:
            print(f" - Note: {msg}")
        else:
            print(f" - WARNING: {msg}")
        return True
    return False

def build_android_both():
    print("\n--- [BUILD BOTH ANDROID APKS] ---")
    if build_android_debug() and build_android_release():
        print("\n[SUCCESS] Both Android APKs Generated.")
        return True
    return False

def clean_android():
    print("\n--- [CLEAN ANDROID PROJECT] ---")
    rc = run_command(["gradlew", "clean"], ANDROID_DIR, "Cleaning Gradle Build Files")
    if rc == 0:
        print("\n[SUCCESS] Android project cleaned.")
        return True
    return False

def fresh_build_android():
    print("\n--- [FRESH ANDROID BUILD] ---")
    if clean_android():
        return build_android_both()
    return False

def build_desktop():
    print("\n--- [BUILD DESKTOP] ---")
    # Electron build
    rc = run_command(["npm", "run", "electron:build"], UNIVERSAL_DIR, "Generating Windows EXE")
    if rc != 0:
        return False
    
    print(f"\n[SUCCESS] Desktop EXE Generated in {os.path.join(UNIVERSAL_DIR, 'release')}")
    return True

def build_web():
    print("\n--- [BUILD WEB] ---")
    rc = run_command(["npm", "run", "build:web"], UNIVERSAL_DIR, "Generating Web Build")
    if rc != 0:
        return False
    
    print(f"\n[SUCCESS] Web Build Generated in {os.path.join(UNIVERSAL_DIR, 'dist')}")
    return True

def deploy_firebase():
    print("\n--- [FIREBASE DEPLOY] ---")
    rc = run_command(["firebase", "deploy"], UNIVERSAL_DIR, "Deploying to Firebase")
    if rc != 0:
        return False
    print("\n[SUCCESS] Firebase Deployment Complete.")
    return True

def cleanup_release():
    print("\n--- [CLEANUP RELEASE FILES] ---")
    release_dir = os.path.join(UNIVERSAL_DIR, "release")
    if os.path.exists(release_dir):
        try:
            shutil.rmtree(release_dir)
            print(f"\n[SUCCESS] Cleaned up: {release_dir}")
            return True
        except Exception as e:
            print(f"\n[ERROR] Failed to cleanup release: {e}")
            return False
    else:
        print(f"\n[INFO] Release directory does not exist: {release_dir}")
        return True

def launch_gui():
    print("\n--- [LAUNCHING GUI PROJECT CONSOLE] ---")
    gui_path = os.path.join(GUI_DIR, "gui_manager.py")
    if os.path.exists(gui_path):
        try:
            # Use DETACHED_PROCESS on Windows so no blank console window appears
            creation_flags = subprocess.DETACHED_PROCESS if os.name == 'nt' else 0
            subprocess.Popen(
                [sys.executable, gui_path],
                creationflags=creation_flags,
                close_fds=True
            )
            print("\n[SUCCESS] GUI Project Console launched.")
            return True
        except Exception as e:
            print(f"\n[ERROR] Failed to launch GUI: {e}")
            return False
    else:
        print(f"\n[ERROR] GUI script not found: {gui_path}")
        return False

def launch_installer():
    print("\n--- [LAUNCHING PREMIUM SETUP WIZARD] ---")
    setup_path = os.path.join(GUI_DIR, "setup_wizard.py")
    if os.path.exists(setup_path):
        try:
            creation_flags = subprocess.DETACHED_PROCESS if os.name == 'nt' else 0
            subprocess.Popen(
                [sys.executable, setup_path],
                creationflags=creation_flags,
                close_fds=True
            )
            print("\n[SUCCESS] Premium Setup Wizard launched.")
            return True
        except Exception as e:
            print(f"\n[ERROR] Failed to launch Installer: {e}")
            return False
    else:
        print(f"\n[ERROR] Setup script not found: {setup_path}")
        return False

def git_sync(interactive=True):
    print("\n--- [GIT SYNC (ADD, COMMIT, PUSH)] ---")
    
    # 1. Check Status
    output = subprocess.run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if not output.stdout.strip():
        print("Working tree clean, nothing to commit.")
        return True
        
    # 2. Add all
    rc = run_command(["git", "add", "."], PROJECT_ROOT, "Staging all changes")
    if rc != 0: return False
    
    # 3. Commit
    if interactive:
        msg = input("Enter commit message: ").strip()
    else:
        msg = ""

    if not msg:
        msg = "Auto-sync from manager.py"
        
    rc = run_command(["git", "commit", "-m", msg], PROJECT_ROOT, f"Committing: '{msg}'")
    if rc != 0: return False
    
    # 4. Push
    rc = run_command(["git", "push"], PROJECT_ROOT, "Pushing to remote")
    if rc != 0: return False
    
    print("\n[SUCCESS] Git Sync Complete.")
    return True

def install_on_device():
    print("\n--- [INSTALL ON PHYSICAL DEVICE] ---")
    apk_path = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    
    if not os.path.exists(apk_path):
        print(f"Error: Debug APK not found at {apk_path}. Please build it first (Option 1).")
        return False
    
    print("Checking for connected devices...")
    devices_output = subprocess.check_output(["adb", "devices"], text=True)
    if "unauthorized" in devices_output:
        print("Error: Device detected but UNAUTHORIZED. Please check your phone and tap 'Allow' on the USB debugging prompt.")
        return False
    if "device\n" not in devices_output and "device\r\n" not in devices_output:
        print("Error: No physical device detected via ADB. Please connect your device and enable USB debugging.")
        return False

    rc = run_command(["adb", "install", "-r", apk_path], PROJECT_ROOT, "Installing Debug APK to device")
    if rc == 0:
        print("\n[SUCCESS] App installed on device.")
        return True
    return False

def start_dev_server():
    print("\n--- [START EXPO DEV SERVER] ---")
    print("Launching development server in a new window...")
    # Using start command for Windows to open a new terminal
    cmd = f'start cmd /k "cd /d {UNIVERSAL_DIR} && npm start"'
    os.system(cmd)
    print("\n[SUCCESS] Development server command sent.")
    return True

def start_download_portal_server():
    print("\n--- [START LEGACY DOWNLOAD PORTAL SERVER] ---")
    print("Launching Browsersync server on port 5679...")
    cmd = f'start cmd /k "cd /d {DOWNLOAD_PORTAL_DIR} && npm run dev"'
    os.system(cmd)
    print("\n[SUCCESS] Download Portal server command sent.")
    return True

def start_react_portal_server():
    print("\n--- [START REACT DOWNLOAD PORTAL (Vite)] ---")
    print("Launching Vite dev server on port 5173...")
    cmd = f'start cmd /k "cd /d {REACT_PORTAL_DIR} && npm run dev"'
    os.system(cmd)
    print("\n[SUCCESS] React Portal server command sent.")
    return True

def start_both_portals():
    print("\n--- [STARTING BOTH PORTALS] ---")
    start_react_portal_server()
    start_download_portal_server()
    print("\n[SUCCESS] Both portals launched in separate windows.")
    return True

def physical_dev_flow():
    print("\n===============================")
    print("   PHYSICAL DEVICE DEV FLOW")
    print("===============================\n")
    
    if not build_android_debug():
        print("Build failed.")
        return
    
    if not install_on_device():
        print("Installation failed.")
        return
        
    start_dev_server()
    print("\n[DONE] Build, Install & Server Start complete.")

def full_release():
    print("\n===============================")
    print("      FULL PROJECT RELEASE")
    print("===============================\n")
    
    if not build_android_both():
        print("Build failed at Android stage.")
        return
    
    if not build_desktop():
        print("Build failed at Desktop stage.")
        return
        
    if not build_web():
        print("Build failed at Web stage.")
        return
        
    if not deploy_firebase():
        print("Failed at Firebase Deployment stage.")
        return

    print("\n===============================")
    print("  ALL SYSTEMS UPDATED & READY!")
    print("===============================")

def main():
    parser = argparse.ArgumentParser(description="InnerOrbit Project Manager")
    parser.add_argument("task", nargs="?", help="Task to run: debug, release, android (both), desktop, firebase, all")
    args = parser.parse_args()

    if args.task:
        task = args.task.lower()
        if task == "debug": build_android_debug()
        elif task == "release": build_android_release()
        elif task == "android": build_android_both()
        elif task == "clean": clean_android()
        elif task == "fresh": fresh_build_android()
        elif task == "install": install_on_device()
        elif task == "start": start_dev_server()
        elif task == "react": start_dev_server()   # expo dev server
        elif task == "portal": start_react_portal_server()  # vite react portal
        elif task == "download": start_download_portal_server()
        elif task == "both": start_both_portals()
        elif task == "dev": physical_dev_flow()
        elif task == "desktop": build_desktop()
        elif task == "web": build_web()
        elif task == "firebase": deploy_firebase()
        elif task == "git": git_sync(interactive=False)
        elif task == "cleanup": cleanup_release()
        elif task == "gui": launch_gui()
        elif task == "compat":
            compat, msg = check_dual_messenger_compatibility()
            print(f"\n>>> COMPATIBILITY CHECK: {'[ENABLED]' if compat else '[NOT FOUND]'}")
            print(msg)
        elif task == "setup": launch_installer()
        elif task == "all": full_release()
        else: 
            print(f"Unknown task: {task}")
            sys.exit(1)
        sys.exit(0)
    else:
        # Interactive Menu
        show_splash()
        ask_terminal()
        while True:
            # Clear screen once before each menu cycle to keep it clean
            # but only if we are in interactive mode
            print("\n" + "="*40)
            print("   InnerOrbit Project Manager")
            print("="*40)
            
            menu = [
                "=== ANDROID BUILDS ===",
                " 1. Build Debug APK           (For local testing and emulators)",
                " 2. Build Release APK         (Production-ready signed bundle)",
                " 3. Build Both APKs           (Debug & Release simultaneously)",
                " 4. Clean Android Project     (Fixes gradle caching issues)",
                " 5. Fresh Build From Scratch  (Clean project + Build Both)",
                " 6. Install to Device         (Pushes debug APK to connected phone/emulator)",
                "",
                "=== DEVELOPMENT & OTHER PLATFORMS ===",
                " 7. Start Expo Dev Server     (Metro bundler with live reload)",
                " 8. Physical Device Dev Flow  (Build Debug -> Install -> Start Server)",
                " 9. Build Windows Desktop App (Electron executable)",
                "10. Build Web Application     (Static site for Firebase)",
                "",
                "=== OPS, DEPLOYMENT & UTILS ===",
                "11. Deploy to Firebase        (Pushes web build to cloud hosting)",
                "12. Git Sync                  (Auto add, commit, and push modifications)",
                "13. FULL PROJECT RELEASE      (Build Android/Desktop/Web + Deploy to cloud)",
                "14. Check Compatibility       (Dual Messenger manifest integrity check)",
                "15. Cleanup Release Folder    (Removes old desktop binaries)",
                "",
                "=== ADVANCED ===",
                "16. Launch GUI Console        (Visual alternative to this command line)",
                "17. Launch Setup Wizard       (Guided premium installer)",
                "",
                "=== PORTAL SERVERS ===",
                "18. Start React Download Portal  (Port 5173 - Vite/React)",
                "19. Start Legacy Download Portal (Port 5679 - Browsersync/Static)",
                "20. Start Both Portals           (React + Legacy)",
                " Q. Quit Project Manager"
            ]
            for m in menu: print(m)
            
            choice = input("\n> ").strip().lower()
            
            if choice == '1': build_android_debug()
            elif choice == '2': build_android_release()
            elif choice == '3': build_android_both()
            elif choice == '4': clean_android()
            elif choice == '5': fresh_build_android()
            elif choice == '6': install_on_device()
            elif choice == '7': start_dev_server()
            elif choice == '8': physical_dev_flow()
            elif choice == '9': build_desktop()
            elif choice == '10': build_web()
            elif choice == '11': deploy_firebase()
            elif choice == '12': git_sync()
            elif choice == '13': full_release()
            elif choice == '14': 
                compat, msg = check_dual_messenger_compatibility()
                print(f"\n>>> COMPATIBILITY CHECK: {'[ENABLED]' if compat else '[NOT FOUND]'}")
                print(msg)
            elif choice == '15': cleanup_release()
            elif choice == '16': launch_gui()
            elif choice == '17': launch_installer()
            elif choice == '18': start_react_portal_server()
            elif choice == '19': start_download_portal_server()
            elif choice == '20': start_both_portals()
            elif choice == 'q': break
            else: print("Invalid choice.")
            
            # Pause after task to let user see output
            if choice not in ['q', '']:
                input("\nPress Enter to return to menu...")
                clear_terminal()

if __name__ == "__main__":
    main()
