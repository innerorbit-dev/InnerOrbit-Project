"""
INNERORBIT AUTOMATION HUB (manager.py)
======================================
Centralized command center for the InnerOrbit ecosystem.
Provides automated workflows for Android, Web, Desktop, and Cloud Deployment.

USAGE:
  python manager.py <command>
  orbit <command> (if registered globally)

AVAILABLE COMMANDS:
-------------------
  debug     : Build Android Debug APK
  release   : Build Android Release APK (v5.5+ cascading encryption ready)
  android   : Build both Debug & Release APKs
  clean     : Wipe Gradle cache and build folders
  fresh     : Full Android refresh (Clean -> Build Both)
  install   : Deploy the latest Debug APK to a connected ADB device
  phys      : Physical Device Workflow (Build Debug -> Auto-Install)
  dev       : Physical Full Flow (Build -> Install -> Start Expo Server)
  
  start     : Launch Expo Development Server (Metro)
  portal    : Launch Vite-based React Download Portal (Port 5173)
  download  : Launch Legacy Download Portal (Port 5679)
  both      : Simultaneous launch of React & Legacy Portals
  electron  : Launch Desktop environment in Dev Mode (links to localhost:8081)
  
  desktop   : Package production Windows EXE
  web       : Package production Web distribution (dist/)
  mac       : Package production macOS DMG
  linux     : Package production Linux AppImage
  all       : ULTIMATE RELEASE (Android + Desktop + Web + Firebase)

  firebase  : Full Cloud Deployment (Hosting, Functions, Rules)
  rules     : Deploy Firestore Security Rules ONLY
  git       : Interactive Git Menu (Sync, Status, Branching)
  health    : Project integrity audit (Env, Deps, Manifests)
  cleanup   : Remove production 'release/' artifacts
  
  gui       : Launch Premium Flask Dashboard (http://localhost:2004)
  setup     : Launch visual Setup Wizard for new environments
  browser   : Configure preferred browser/incognito mode
  reset     : Clear terminal and browser preferences
  register  : Set up 'orbit' as a global command in User PATH
  exit      : Terminate the Hub session

COMMON WORKFLOWS:
-----------------
1. Physical Debugging: `orbit dev`
   - Builds APK, pushes to phone via ADB, and starts the Metro bundler.
2. Production Release: `orbit all`
   - Runs full multi-platform build chain and prompts for Firebase deployment.
3. Rapid UI/UX Test: `orbit both`
   - Spins up both portals to verify cross-platform portal consistency.

DEBUG SHORTCUTS:
----------------
- Press 'K' in the Hub menu for Kernel Access (Direct Admin Shell).
- Run `orbit health` if Firestore or Auth calls fail (checks .env).
- Use `orbit electron` to test desktop-specific features like "Calc Mode".

AUTOMATION SYSTEM:
------------------
- Self-Bootstrapping: Auto-creates and activates .venv.
- Admin Elevation: Triggers UAC/Sudo prompts when needed.
- Browser Sync: Automatically pushes .env vars to the portal config.
"""


VERSION = "5.0"

import os
import shutil
import subprocess
import sys
import argparse
import time
import socket
import json
import io
from datetime import datetime
import re

# --- ENCODING FIX (Windows) ---
# Ensures Unicode characters (like splash blocks) don't crash legacy terminals
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except:
    # Final fallback for unusual environments
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except:
        pass

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
    venv_dir = os.path.normpath(os.path.join(project_root, ".venv"))
    
    # Normalize paths for robust comparison (handles Windows casing/slashes)
    current_prefix = os.path.normpath(sys.prefix)
    
    # Check if we are already running in the venv
    if current_prefix.lower() == venv_dir.lower():
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
    
    # Use a flag to prevent recursion just in case
    os.environ["SKIP_VENV_BOOTSTRAP"] = "1"
    
    try:
        # On Windows, subprocess is more stable than os.execv for re-execution
        if os.name == 'nt':
            sys.exit(subprocess.call([venv_python] + sys.argv))
        else:
            os.execv(venv_python, [venv_python] + sys.argv)
    except Exception as e:
        # Final fallback
        print(f"[!] Bootstrap failed: {e}")
        sys.exit(1)

# Run bootstrap before anything else
if __name__ == "__main__":
    if "SKIP_VENV_BOOTSTRAP" not in os.environ:
        # Starting delay requested by user
        print("\n  [*] Warming up InnerOrbit Console...")
        time.sleep(2.5)
        bootstrap_venv()

def main():
    flush_input()
    show_splash()

# ── Enable ANSI and Disable Echo on Windows ──
def set_terminal_mode(echo=True):
    if os.name == "nt":
        import ctypes
        kernel32 = ctypes.windll.kernel32
        h_input = kernel32.GetStdHandle(-10) # STD_INPUT_HANDLE
        mode = ctypes.c_uint32()
        kernel32.GetConsoleMode(h_input, ctypes.byref(mode))
        
        ENABLE_ECHO_INPUT = 0x0004
        if echo:
            mode.value |= ENABLE_ECHO_INPUT
        else:
            mode.value &= ~ENABLE_ECHO_INPUT
            
        kernel32.SetConsoleMode(h_input, mode)

if os.name == "nt":
    import ctypes
    # Enable ANSI
    ctypes.windll.kernel32.SetConsoleMode(
        ctypes.windll.kernel32.GetStdHandle(-11), 7
    )
    # Start with echo OFF
    set_terminal_mode(False)

def _type(text, delay=0):
    """Typing effect for text output."""
    if delay > 0:
        for char in text:
            sys.stdout.write(char)
            sys.stdout.flush()
            time.sleep(delay)
        sys.stdout.write('\n')
    else:
        print(text)

def flush_input():
    """Aggressively clears the terminal input buffer."""
    try:
        if os.name == 'nt':
            import msvcrt
            # Drain the buffer completely
            while msvcrt.kbhit():
                msvcrt.getch()
        else:
            import sys, termios
            termios.tcflush(sys.stdin, termios.TCIFLUSH)
    except:
        pass

def get_key():
    """Gets a single keypress without echoing it to the screen."""
    if os.name == 'nt':
        import msvcrt
        # Wait for a key to be pressed
        while not msvcrt.kbhit():
            time.sleep(0.01)
        
        try:
            # Read the key
            char = msvcrt.getwch().lower()
            # Immediately flush any accidental trailing repeats
            while msvcrt.kbhit():
                msvcrt.getch()
            return char
        except:
            return None
    else:
        import tty, termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ch.lower()

def show_splash(restarted=False):
    os.system('cls' if os.name == 'nt' else 'clear')
    
    if restarted:
        print(f"{C.CYAN}{'=' * 62}{C.RST}")
        print(f"  {C.BOLD}INNERORBIT PROJECT HUB{C.RST} {C.GRAY}│ v{VERSION}{C.RST} {C.GRN}(QUICK RELOAD){C.RST}")
        print(f"{C.CYAN}{'=' * 62}{C.RST}\n")
        return

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
        time.sleep(0.08) # Slower scanning effect

    print()
    _type(f"  {C.GRAY}Project Console  ·  v{VERSION}  ·  InnerOrbit Dev Tools{C.RST}", delay=0.03)
    print(f"  {C.GRAY}{'─' * 62}{C.RST}")
    time.sleep(1.2) # Increased transition delay
    _type(f"  {C.GRN}●{C.RST}  Environment ready", delay=0.04)
    _type(f"  {C.BLUE}●{C.RST}  All modules loaded", delay=0.04)
    print()

def self_upgrade_version():
    """Allows the script to modify its own version and restart."""
    global VERSION
    print(f"\n  {C.CYAN}{C.BOLD}--- [SYSTEM UPGRADE] ---{C.RST}")
    print(f"  Current Version: {C.WHT}{VERSION}{C.RST}")
    
    try:
        next_v = f"{float(VERSION) + 1.0:.1f}"
    except:
        next_v = "1.0"
        
    print(f"  Suggested Next:  {C.GRN}{next_v}{C.RST}")
    print(f"  {C.GRAY}(Press Enter for suggested, or type a new version){C.RST}")
    
    new_v = input(f"  New Version > ").strip()
    if not new_v: new_v = next_v
    
    confirm = input(f"  Confirm upgrade to v{new_v}? (y/n): ").lower()
    if confirm != 'y': return False
    
    # Modify manager.py
    script_path = os.path.abspath(__file__)
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        with open(script_path, 'w', encoding='utf-8') as f:
            for line in lines:
                if line.startswith('VERSION ='):
                    f.write(f'VERSION = "{new_v}"\n')
                else:
                    f.write(line)
        
        print(f"\n  {C.GRN}✔ Version upgraded to v{new_v}! Restarting...{C.RST}")
        time.sleep(1)
        os.execv(sys.executable, [sys.executable] + sys.argv)
    except Exception as e:
        print(f"  {C.RED}✘ Failed to modify source: {e}{C.RST}")
        return False

def is_admin():
    """Checks if the script is running with administrative privileges."""
    try:
        if os.name == 'nt':
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        else:
            return os.getuid() == 0
    except:
        return False

def elevate_privileges():
    """Restarts the current script with administrative privileges."""
    if os.name == 'nt':
        print(f"\n  {C.YEL}[*] Attempting to elevate to Administrator...{C.RST}")
        script = os.path.abspath(__file__)
        params = ' '.join([f'"{arg}"' for arg in sys.argv[1:]])
        try:
            # ShellExecuteW with 'runas' verb triggers the UAC prompt
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
            sys.exit(0)
        except Exception as e:
            print(f"  {C.RED}✘ Elevation failed: {e}{C.RST}")
            return False
    else:
        print(f"\n  {C.YEL}[*] Please restart with 'sudo python manager.py'{C.RST}")
        return False

def launch_system_shell():
    """Allows manual command entry with a persistent terminal feel."""
    if not is_admin():
        print(f"\n  {C.RED}✘ Access Denied.{C.RST} System Shell requires Administrative privileges.")
        print(f"  {C.CYAN}Would you like to elevate this terminal? (y/n):{C.RST} ", end='', flush=True)
        if get_key() == 'y':
            elevate_privileges()
        return False
    
    print(f"\n  {C.RED}{C.BOLD}--- [KERNEL ACCESS: ADMINISTRATIVE SHELL] ---{C.RST}")
    print(f"  {C.GRAY}Interactive mode active. Type 'exit' to return to Hub.{C.RST}")
    
    while True:
        try:
            cwd = os.getcwd()
            # Modern prompt style
            prompt = f"\n  {C.BLUE}{C.BOLD}ADMIN{C.RST} {C.GRAY}in{C.RST} {C.CYAN}{cwd}{C.RST}\n  {C.RED}#{C.RST} "
            cmd = input(prompt).strip()
            
            if cmd.lower() in ['exit', 'quit', 'back']: break
            if not cmd: continue
            
            # Execute and keep terminal context
            subprocess.call(cmd, shell=True)
        except KeyboardInterrupt:
            print("\n  Use 'exit' to leave the shell.")
            continue
        except Exception as e:
            print(f"  {C.RED}Error: {e}{C.RST}")
    return True



def get_terminal_choice():
    """Retrieves the user's preferred terminal mode from JSON."""
    if os.path.exists(TERMINAL_CHOICE_FILE):
        try:
            with open(TERMINAL_CHOICE_FILE, 'r') as f:
                content = f.read().strip()
                if not content: return None
                # Check if it's JSON or legacy plain text
                if content.startswith('{'):
                    data = json.loads(content)
                    return data.get("choice")
                else:
                    return content # Legacy support
        except:
            return None
    return None

def reset_terminal_choice():
    """Clears the saved terminal preference."""
    if os.path.exists(TERMINAL_CHOICE_FILE):
        os.remove(TERMINAL_CHOICE_FILE)
        print(f"  {C.GRN}✔ Terminal preference reset. You will be asked on next launch.{C.RST}")
    else:
        print(f"  {C.YEL}! No saved preference found.{C.RST}")

def ask_terminal():
    """Ask user whether to run in current terminal or open a new window."""
    saved_choice = get_terminal_choice()
    
    if saved_choice:
        choice = saved_choice
    else:
        print(f"  {C.YEL}{C.BOLD}Where would you like to run?{C.RST}")
        print(f"  {C.WHT} 1{C.RST}  {C.CYAN}Current terminal{C.RST}   {C.GRAY}(interactive menu here){C.RST}")
        print(f"  {C.WHT} 2{C.RST}  {C.PURP}New terminal window{C.RST} {C.GRAY}(opens a fresh cmd/pwsh tab){C.RST}")
        print(f"  {C.WHT} G{C.RST}  {C.BLUE}Launch GUI Console{C.RST}  {C.GRAY}(visual project manager){C.RST}")
        print()
        choice = input(f"  {C.BOLD}>{C.RST} ").strip().lower()
        
        if choice in ['1', '2', 'g']:
            save = input(f"\n  {C.CYAN}Save this choice for future? (y/n):{C.RST} ").strip().lower()
            if save == 'y':
                labels = {"1": "Current Terminal", "2": "New Terminal Window", "g": "GUI Console"}
                data = {
                    "choice": choice,
                    "label": labels.get(choice, "Unknown"),
                    "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                with open(TERMINAL_CHOICE_FILE, 'w') as f:
                    json.dump(data, f, indent=4)
                print(f"  {C.GRN}✔ Preference saved to .terminal_choice{C.RST}")

    if choice == '2':
        script = os.path.abspath(__file__)
        if os.name == 'nt':
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
        print(f"\n  {C.YEL}{C.BOLD}Which GUI version would you like to launch?{C.RST}")
        print(f"  {C.WHT} 1{C.RST}  {C.BLUE}Premium Flask GUI{C.RST}  {C.GRAY}(Web-based, Glassy Design){C.RST}")
        print(f"  {C.WHT} 2{C.RST}  {C.PURP}Classic Desktop GUI{C.RST} {C.GRAY}(Native Tkinter Window){C.RST}")
        
        g_choice = input(f"\n  {C.BOLD}>{C.RST} ").strip()
        if g_choice == '1':
            launch_flask_gui()
        else:
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
BROWSER_CHOICE_FILE = os.path.join(TOOLS_DIR, ".browser_choice")
TERMINAL_CHOICE_FILE = os.path.join(TOOLS_DIR, ".terminal_choice")

def clear_terminal():
    os.system('cls' if os.name == 'nt' else 'clear')

    return False

def ask_server_terminal(label):
    """Asks user whether to run a long-running server in current or new window."""
    print(f"\n  {C.YEL}{C.BOLD}Launch Mode: {label}{C.RST}")
    print(f"  {C.WHT} 1.{C.RST} {C.CYAN}Current terminal{C.RST}   {C.GRAY}(Blocks this menu until server stops){C.RST}")
    print(f"  {C.WHT} 2.{C.RST} {C.PURP}New external window{C.RST} {C.GRAY}(Recommended for multi-tasking){C.RST}")
    
    print(f"\n  {C.BOLD}Select (1-2) [Default 2] >{C.RST} ", end='', flush=True)
    choice = get_key()
    return choice if choice in ['1', '2'] else '2'

def wait_for_port(port, host='localhost', timeout=15.0):
    """Wait until a port is open on a host."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            time.sleep(0.5)
    return False

def get_preferred_browser_config(trigger_setup=False):
    """Retrieves the browser config. Optionally triggers setup if missing."""
    if os.path.exists(BROWSER_CHOICE_FILE):
        try:
            with open(BROWSER_CHOICE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
            
    if trigger_setup:
        print(f"\n  {C.YEL}! No browser preference found.{C.RST}")
        set_preferred_browser()
        return get_preferred_browser_config(trigger_setup=False)
        
    return {"browser": "default", "incognito": False}

def get_preferred_browser():
    """Retrieves just the browser ID."""
    return get_preferred_browser_config().get("browser", "default")

def update_browser_config(new_data):
    """Updates the browser JSON config with new keys."""
    data = get_preferred_browser_config()
    data.update(new_data)
    with open(BROWSER_CHOICE_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def sync_env_to_portal():
    """Syncs .env variables to the Download Portal's JS config file."""
    env_path = os.path.join(PROJECT_ROOT, ".env")
    config_path = os.path.join(DOWNLOAD_PORTAL_DIR, "src", "js", "firebase-config.js")
    
    if not os.path.exists(env_path):
        print(f"  {C.RED}! .env file not found at {env_path}{C.RST}")
        return False

    # Read .env
    env_data = {}
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    env_data[key.strip()] = val.strip()
    except Exception as e:
        print(f"  {C.RED}! Failed to read .env for Virtual Sync: {e}{C.RST}")
        return False

    # Generate Virtual Config Middleware for BrowserSync
    # This allows us to serve the config "into the air" without a physical file in src/
    js_content = f"""
window.INNERORBIT_FIREBASE_CONFIG = {{
    apiKey: "{env_data.get('FIREBASE_API_KEY', '')}",
    authDomain: "{env_data.get('FIREBASE_AUTH_DOMAIN', '')}",
    projectId: "{env_data.get('FIREBASE_PROJECT_ID', '')}",
    storageBucket: "{env_data.get('FIREBASE_STORAGE_BUCKET', '')}",
    messagingSenderId: "{env_data.get('FIREBASE_MESSAGING_SENDER_ID', '')}",
    appId: "{env_data.get('FIREBASE_APP_ID', '')}",
    measurementId: "{env_data.get('FIREBASE_MEASUREMENT_ID', '')}"
}};

// Auto-Init
(function() {{
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {{
        firebase.initializeApp(window.INNERORBIT_FIREBASE_CONFIG);
        window.db = firebase.firestore();
    }}
}})();
"""
    
    # Escape for JS string
    js_content_escaped = js_content.replace('"', '\\"').replace('\n', '\\n')
    
    bs_config = f"""
module.exports = {{
    server: "src",
    port: 5679,
    files: ["src"],
    noNotify: true,
    ui: false,
    open: false,
    middleware: [
        {{
            route: "/js/firebase-config.js",
            handle: function (req, res, next) {{
                res.setHeader("Content-Type", "application/javascript");
                res.end("{js_content_escaped}");
            }}
        }}
    ]
}};
"""
    try:
        bs_config_path = os.path.join(DOWNLOAD_PORTAL_DIR, "bs-config.js")
        with open(bs_config_path, 'w') as f:
            f.write(bs_config)
        
        # Also ensure the physical file is GONE from src to avoid confusion
        physical_file = os.path.join(DOWNLOAD_PORTAL_DIR, "src", "js", "firebase-config.js")
        if os.path.exists(physical_file):
            os.remove(physical_file)
            
        return True
    except Exception as e:
        print(f"  {C.RED}! Failed to generate Virtual Sync Config: {e}{C.RST}")
        return False

def detect_browsers():
    """Detects which browsers are installed on the system."""
    browsers = []
    
    # Common Windows paths and commands
    known_browsers = [
        {"id": "chrome", "name": "Google Chrome", "exec": "chrome"},
        {"id": "msedge", "name": "Microsoft Edge", "exec": "msedge"},
        {"id": "firefox", "name": "Mozilla Firefox", "exec": "firefox"},
        {"id": "brave", "name": "Brave Browser", "exec": "brave"},
        {"id": "opera", "name": "Opera", "exec": "opera"},
    ]
    
    for b in known_browsers:
        # Check if it's in PATH or if the 'start' command can find it
        if shutil.which(b["exec"]):
            browsers.append(b)
        elif os.name == 'nt':
            # On Windows, 'start' can often find these even if not in PATH
            # We'll do a quick check in common Program Files paths as well
            paths = [
                os.path.expandvars(f"%ProgramFiles%\\Google\\Chrome\\Application\\{b['exec']}.exe"),
                os.path.expandvars(f"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\{b['exec']}.exe"),
                os.path.expandvars(f"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\{b['exec']}.exe"),
                os.path.expandvars(f"%ProgramFiles%\\Mozilla Firefox\\{b['exec']}.exe"),
                os.path.expandvars(f"%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\{b['exec']}.exe"),
            ]
            if any(os.path.exists(p) for p in paths) or b['id'] in ['chrome', 'msedge']:
                # Chrome and Edge are almost always available via 'start' on modern Windows
                browsers.append(b)
                
    return browsers

def set_preferred_browser():
    """Asks the user to select from detected browsers."""
    available = detect_browsers()
    
    print(f"\n  {C.YEL}{C.BOLD}Detected Browsers on your system:{C.RST}")
    for i, b in enumerate(available, 1):
        print(f"  {C.WHT} {i}{C.RST}  {C.CYAN}{b['name']}{C.RST}")
    
    print(f"  {C.WHT} D{C.RST}  {C.GRAY}System Default{C.RST}")
    
    choice = input(f"\n  {C.BOLD}Select choice (1-{len(available)} or D):{C.RST} ").strip().lower()
    
    browser_id = "default"
    label = "System Default"
    incognito = False
    
    if choice != 'd':
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(available):
                browser_id = available[idx]['id']
                label = available[idx]['name']
                
                # Ask about incognito
                inc_choice = input(f"  {C.CYAN}Use Private/Incognito mode? (y/n):{C.RST} ").strip().lower()
                incognito = (inc_choice == 'y')
        except ValueError:
            pass
            
    data = {
        "browser": browser_id,
        "label": label,
        "incognito": incognito,
        "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open(BROWSER_CHOICE_FILE, 'w') as f:
        json.dump(data, f, indent=4)
    
    mode_str = " (Incognito)" if incognito else ""
    print(f"  {C.GRN}✔ Preference saved: {label}{mode_str}{C.RST}")
    return browser_id

def open_url(url, force_incognito=None):
    """Opens a URL with optional incognito support. Triggers setup if no config exists."""
    config = get_preferred_browser_config(trigger_setup=True)
    browser = config.get("browser", "default")
    incognito = config.get("incognito", False)
    
    if force_incognito is not None:
        incognito = force_incognito
    
    if os.name == 'nt':
        if browser == "default":
            os.system(f'start "" "{url}"')
        else:
            # Browser-specific flags
            flags = ""
            if incognito:
                if browser == "chrome": flags = "--incognito"
                elif browser == "msedge": flags = "-inprivate"
                elif browser == "firefox": flags = "-private-window"
                elif browser == "brave": flags = "--incognito"
                elif browser == "opera": flags = "--private"
            
            os.system(f'start {browser} {flags} "{url}"')
    else:
        # Linux/macOS
        if browser == "default":
            os.system(f'open "{url}"' if sys.platform == "darwin" else f'xdg-open "{url}"')
        else:
            flags = ""
            if incognito:
                if browser == "chrome": flags = "--incognito"
                elif browser == "firefox": flags = "--private-window"
            os.system(f'{browser} {flags} "{url}" &')

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

def check_project_health():
    """Runs a series of checks to ensure the project is ready for development."""
    print(f"\n{C.BOLD}--- [PROJECT HEALTH CHECK] ---{C.RST}")
    
    issues = []
    
    # 1. Check for .env file (Required for Firebase security)
    env_path = os.path.join(UNIVERSAL_DIR, ".env")
    if not os.path.exists(env_path):
        issues.append(f"{C.RED}[FAIL]{C.RST} .env file missing in {UNIVERSAL_DIR}. Firebase will not work.")
    else:
        print(f"  {C.GRN}✔{C.RST} .env file found.")

    # 2. Check for google-services.json (Ignored by git but needed for build)
    gs_path = os.path.join(ANDROID_DIR, "app", "google-services.json")
    if not os.path.exists(gs_path):
        issues.append(f"{C.YEL}[WARN]{C.RST} google-services.json missing in {os.path.dirname(gs_path)}. Android builds may fail.")
    else:
        print(f"  {C.GRN}✔{C.RST} google-services.json found.")

    # 3. Check for node_modules
    for d in [UNIVERSAL_DIR, REACT_PORTAL_DIR, DOWNLOAD_PORTAL_DIR]:
        nm_path = os.path.join(d, "node_modules")
        if not os.path.exists(nm_path):
            issues.append(f"{C.RED}[FAIL]{C.RST} node_modules missing in {os.path.basename(d)}. Run 'npm install'.")
        else:
            print(f"  {C.GRN}✔{C.RST} node_modules found in {os.path.basename(d)}.")

    # 4. Check Dual Messenger
    compat, msg = check_dual_messenger_compatibility()
    if compat:
        print(f"  {C.GRN}✔{C.RST} {msg}")
    else:
        print(f"  {C.YEL}!{C.RST} {msg}")

    # 5. Check Browser Choice
    browser = get_preferred_browser()
    print(f"  {C.GRN}✔{C.RST} Preferred browser: {browser}")

    if issues:
        print(f"\n{C.RED}{C.BOLD}Found {len(issues)} issues:{C.RST}")
        for i in issues:
            print(f"  - {i}")
    else:
        print(f"\n{C.GRN}{C.BOLD}All systems green!{C.RST}")
    
    return len(issues) == 0

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

def build_mac():
    print("\n--- [BUILD MACOS STANDALONE] ---")
    rc = run_command(["npm", "run", "build:mac"], UNIVERSAL_DIR, "Generating macOS .dmg")
    if rc != 0: return False
    print(f"\n[SUCCESS] macOS Build generated in {os.path.join(UNIVERSAL_DIR, 'dist')}")
    return True

def build_linux():
    print("\n--- [BUILD LINUX STANDALONE] ---")
    rc = run_command(["npm", "run", "build:linux"], UNIVERSAL_DIR, "Generating Linux .AppImage")
    if rc != 0: return False
    print(f"\n[SUCCESS] Linux Build generated in {os.path.join(UNIVERSAL_DIR, 'dist')}")
    return True

def launch_electron_dev():
    print(f"\n--- [LAUNCH ELECTRON (DEV MODE)] ---")
    print(f"  {C.GRAY}Requires Expo web server on port 8081{C.RST}")

    # Check if Expo web dev server is already running
    expo_running = wait_for_port(8081, timeout=0.5)

    if not expo_running:
        print(f"\n  {C.YEL}! Expo web server is NOT running on port 8081.{C.RST}")
        print(f"  {C.WHT}Electron:dev needs the web server at http://localhost:8081{C.RST}")
        print(f"\n  {C.BOLD}Start Expo server now in a new window and then launch Electron? (y/n):{C.RST} ", end='', flush=True)
        ans = get_key()
        print()
        if ans != 'y':
            print(f"  {C.RED}Cancelled.{C.RST}")
            return False

        # Start Expo web server in background window
        cmd = f'start cmd /k "cd /d {UNIVERSAL_DIR} && npm start"'
        os.system(cmd)
        print(f"  {C.CYAN}Expo server launching... waiting for port 8081...{C.RST}")
        if not wait_for_port(8081, timeout=30):
            print(f"  {C.RED}Timed out waiting for Expo server. Try again after it starts.{C.RST}")
            return False
        print(f"  {C.GRN}✔ Expo server ready.{C.RST}")
    else:
        print(f"  {C.GRN}✔ Expo server already running on port 8081.{C.RST}")

    # Launch Electron dev (always in new window — it's a GUI app)
    print(f"\n  {C.BLUE}Launching Electron in dev mode...{C.RST}")
    cmd = f'start cmd /k "cd /d {UNIVERSAL_DIR} && npm run electron:dev"'
    os.system(cmd)
    print(f"\n  {C.GRN}✔ Electron window launched (dev mode → http://localhost:8081){C.RST}")
    return True

def deploy_firebase():
    print("\n--- [FIREBASE DEPLOY] ---")
    rc = run_command(["firebase", "deploy"], UNIVERSAL_DIR, "Deploying to Firebase")
    if rc != 0:
        return False
    print("\n[SUCCESS] Firebase Deployment Complete.")
    return True

def deploy_firestore_rules():
    print("\n--- [FIREBASE RULES-ONLY DEPLOY] ---")
    rc = run_command(["firebase", "deploy", "--only", "firestore:rules"], UNIVERSAL_DIR, "Deploying Firestore Rules")
    if rc != 0:
        return False
    print("\n[SUCCESS] Firestore Security Rules Updated.")
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

def launch_gui():
    print("\n--- [LAUNCHING PREMIUM FLASK MANAGER] ---")
    flask_app_path = os.path.join(TOOLS_DIR, "flask_manager", "app.py")
    if os.path.exists(flask_app_path):
        try:
            # Check for Flask
            try:
                import flask
            except ImportError:
                print(f"  {C.YEL}! Flask not found. Installing dependencies...{C.RST}")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])

            # Launch in background console
            if os.name == 'nt':
                # CREATE_NO_WINDOW = 0x08000000
                subprocess.Popen([sys.executable, flask_app_path], 
                                 creationflags=0x08000000, 
                                 close_fds=True)
            else:
                subprocess.Popen([sys.executable, flask_app_path], 
                                 stdout=subprocess.DEVNULL, 
                                 stderr=subprocess.DEVNULL, 
                                 start_new_session=True)
            
            print(f"\n  {C.GRN}✔ Flask Manager started at http://localhost:5000{C.RST}")
            
            # Smart Launch Question
            current_b = get_preferred_browser_config()
            print(f"\n  {C.YEL}{C.BOLD}How would you like to open the dashboard?{C.RST}")
            print(f"  {C.GRAY}Current Browser: {C.WHT}{current_b.get('label', 'Default')}{C.RST}")
            print(f"  {C.WHT} 1{C.RST}  {C.CYAN}Normal Window{C.RST}")
            print(f"  {C.WHT} 2{C.RST}  {C.PURP}Incognito / Private{C.RST}")
            print(f"  {C.WHT} B{C.RST}  {C.BLUE}Change Browser Selection{C.RST}")
            print(f"  {C.WHT} S{C.RST}  {C.GRAY}Skip (Manually open http://localhost:2004){C.RST}")
            
            choice = input(f"\n  {C.BOLD}Launch Mode >{C.RST} ").strip().lower()
            
            if choice == '1':
                open_url("http://localhost:2004", force_incognito=False)
            elif choice == '2':
                open_url("http://localhost:2004", force_incognito=True)
            elif choice == 'b':
                set_preferred_browser()
                # Re-run the question after setting
                return launch_gui()
            elif choice == 's':
                print(f"  {C.GRAY}Dashboard is running. Open it manually.{C.RST}")
            else:
                open_url("http://localhost:2004") # Use default from config
            
            return True
        except Exception as e:
            print(f"\n[ERROR] Failed to launch Flask GUI: {e}")
            return False
    else:
        print(f"\n[ERROR] Flask manager script not found at {flask_app_path}")
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

def git_ops_menu():
    print(f"\n  {C.PURP}{C.BOLD}GIT OPERATIONS{C.RST}")
    print(f"  1. Quick Sync (Add + Commit + Push)")
    print(f"  2. View Status")
    print(f"  3. List Branches")
    print(f"  4. Checkout Branch")
    print(f"  5. Pull Latest")
    print(f"  6. Hard Reset to Head {C.RED}(Careful!){C.RST}")
    print(f"\n  [B] Back to Hub")
    
    print(f"\n  {C.BOLD}Git >{C.RST} ", end='', flush=True)
    c = get_key()
    if c == 'b': return
    
    if c == '1': git_sync()
    elif c == '2': subprocess.call(["git", "status"], cwd=PROJECT_ROOT, shell=True)
    elif c == '3': subprocess.call(["git", "branch"], cwd=PROJECT_ROOT, shell=True)
    elif c == '4':
        branch = input("Enter branch name: ").strip()
        if branch: subprocess.call(["git", "checkout", branch], cwd=PROJECT_ROOT, shell=True)
    elif c == '5': subprocess.call(["git", "pull"], cwd=PROJECT_ROOT, shell=True)
    elif c == '6':
        confirm = input("Are you sure? This wipes uncommitted changes (y/n): ").lower()
        if confirm == 'y': subprocess.call(["git", "reset", "--hard", "HEAD"], cwd=PROJECT_ROOT, shell=True)
    
    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")

def install_on_device():
    print(f"\n  {C.BLUE}{C.BOLD}--- [ADB DEVICE DEPLOYMENT] ---{C.RST}")
    apk_path = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    package_name = "com.innerorbit.calcx"
    
    if not os.path.exists(apk_path):
        print(f"  {C.RED}✘ Error:{C.RST} Debug APK not found at {apk_path}")
        print(f"  {C.GRAY}Please run 'Build Debug APK' first.{C.RST}")
        return False
    
    print(f"  {C.CYAN}[*] Scanning for connected devices...{C.RST}")
    try:
        devices_output = subprocess.check_output(["adb", "devices"], text=True)
        
        if "unauthorized" in devices_output:
            print(f"\n  {C.RED}{C.BOLD}⚠ DEVICE UNAUTHORIZED{C.RST}")
            print(f"  {C.WHT}Please check your physical device and tap 'Allow USB Debugging'.{C.RST}")
            return False
            
        if "device\n" not in devices_output and "device\r\n" not in devices_output:
            print(f"\n  {C.RED}{C.BOLD}⚠ NO DEVICE DETECTED{C.RST}")
            print(f"  {C.GRAY}Ensure your device is connected via USB and 'USB Debugging' is enabled.{C.RST}")
            return False

        # Check if already installed
        print(f"  {C.CYAN}[*] Checking application state...{C.RST}")
        check_install = subprocess.run(["adb", "shell", "pm", "list", "packages", package_name], capture_output=True, text=True)
        
        if package_name in check_install.stdout:
            print(f"  {C.YEL}● Existing installation found. Performing upgrade...{C.RST}")
        else:
            print(f"  {C.GRN}● No existing installation found. Performing fresh install...{C.RST}")

        rc = run_command(["adb", "install", "-r", apk_path], PROJECT_ROOT, "Deploying APK")
        
        if rc == 0:
            print(f"\n  {C.GRN}{C.BOLD}✔ SUCCESS: App deployed to physical device.{C.RST}")
            return True
        else:
            print(f"\n  {C.RED}{C.BOLD}✘ FAILED: ADB installation failed.{C.RST}")
            return False
            
    except FileNotFoundError:
        print(f"  {C.RED}✘ Error:{C.RST} ADB command not found. Is Android SDK platform-tools in your PATH?")
        return False
    except Exception as e:
        print(f"  {C.RED}✘ Error during ADB operation: {e}{C.RST}")
        return False

def debug_physical_device_workflow():
    """Combined build and install flow for physical devices."""
    print(f"\n  {C.PURP}{C.BOLD}============================================={C.RST}")
    print(f"  {C.PURP}{C.BOLD}       PHYSICAL DEVICE DEBUG WORKFLOW        {C.RST}")
    print(f"  {C.PURP}{C.BOLD}============================================={C.RST}\n")
    
    if not build_android_debug():
        print(f"\n  {C.RED}✘ Build Failed. Deployment aborted.{C.RST}")
        return False
        
    time.sleep(1) # Pacing
    
    if not install_on_device():
        print(f"\n  {C.RED}✘ Installation Failed.{C.RST}")
        return False
        
    print(f"\n  {C.GRN}{C.BOLD}✔ Workflow Complete! You can now run the app on your device.{C.RST}")
    return True

def start_dev_server():
    print("\n--- [START EXPO DEV SERVER] ---")
    
    choice = ask_server_terminal("Expo Development Server")
    
    if choice == '1':
        print(f"{C.CYAN}Starting in current terminal. Press Ctrl+C to stop.{C.RST}")
        # Use subprocess.call directly to preserve TTY/Interactive terminal for Expo
        subprocess.call(["npm", "start"], cwd=UNIVERSAL_DIR, shell=True)
    else:
        print("Launching in a new window...")
        cmd = f'start cmd /k "cd /d {UNIVERSAL_DIR} && npm start"'
        os.system(cmd)
        print(f"\n[SUCCESS] Dev server launched in new window.")
    return True

def _smart_launch_portal(name, port, directory, dev_cmd, url):
    # 0. Sync Environment variables first
    sync_env_to_portal()
    
    # 1. Check if port is already active
    if wait_for_port(port, timeout=0.1):
        print(f"  {C.YEL}! {name} is already running on port {port}.{C.RST}")
        
        # Check saved preference
        config = get_preferred_browser_config()
        pref = config.get("tab_action")
        
        if pref == "skip": 
            print(f"  {C.GRAY}Skipping tab (per saved preference).{C.RST}")
            return True
        if pref == "open": 
            open_url(url)
            return True
        
        # Ask for preference
        choice = input(f"  Re-open {name} browser tab? (y/n/always_open/always_skip): ").strip().lower()
        if 'skip' in choice:
            if 'always' in choice: update_browser_config({"tab_action": "skip"})
            return True
        if 'always' in choice or 'y' in choice or 'open' in choice:
            if 'always' in choice: update_browser_config({"tab_action": "open"})
            open_url(url)
        return True

    # 2. Not running - Start the server
    print(f"Launching {name} dev server on port {port}...")
    
    choice = ask_server_terminal(f"{name} Server")
    
    if choice == '1':
        print(f"{C.CYAN}Starting in current terminal. Portals will block this menu.{C.RST}")
        # Run in current terminal
        run_command(dev_cmd.split(' '), directory, name)
    else:
        # Run in new window
        cmd = f'start cmd /k "cd /d {directory} && {dev_cmd}"'
        os.system(cmd)
    
    # 3. Wait for port and open browser
    print(f"Waiting for {name} to become active...")
    if wait_for_port(port):
        open_url(url)
        print(f"\n[SUCCESS] {name} started and browser opened.")
        return True
    else:
        print(f"\n[WARNING] {name} started but port {port} timed out.")
        return False

def start_download_portal_server():
    return _smart_launch_portal(
        "Legacy Portal", 5679, DOWNLOAD_PORTAL_DIR, 
        "npx browser-sync start --config bs-config.js",
        "http://localhost:5679"
    )

def start_react_portal_server():
    return _smart_launch_portal(
        "React Portal", 5173, REACT_PORTAL_DIR, 
        "npm run dev",
        "http://localhost:5173"
    )

def start_both_portals():
    print("\n--- [STARTING BOTH PORTALS] ---")
    
    # We use a trick: if both are running, we'll ask a unified question first
    # to avoid the _smart_launch_portal from asking twice individually.
    react_running = wait_for_port(5173, timeout=0.1)
    legacy_running = wait_for_port(5679, timeout=0.1)
    
    if react_running and legacy_running:
        config = get_preferred_browser_config()
        pref = config.get("tab_action")
        if pref == "skip": 
            print(f"  {C.GRAY}Both portals running. Skipping tabs (per preference).{C.RST}")
            return True
        if pref == "open":
            open_url("http://localhost:5173")
            open_url("http://localhost:5679")
            return True
            
        print(f"  {C.YEL}! Both portals (React & Legacy) are already running.{C.RST}")
        choice = input("  Re-open both browser tabs? (y/n/always_open/always_skip): ").strip().lower()
        if 'skip' in choice or choice == 'n':
            if 'always' in choice: update_browser_config({"tab_action": "skip"})
            return True
        if 'always' in choice or 'y' in choice or 'open' in choice:
            if 'always' in choice: update_browser_config({"tab_action": "open"})
            open_url("http://localhost:5173")
            open_url("http://localhost:5679")
            return True
        
        # If they just hit enter or invalid, treat as 'n' but don't save
        return True

    # If we get here, either they aren't both running or they aren't both skip/open
    start_react_portal_server()
    start_download_portal_server()
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
    print("      ULTIMATE PROJECT RELEASE")
    print("===============================\n")
    
    # 1. Android
    if not build_android_both():
        print("Build failed at Android stage.")
        return
    
    # 2. Desktop (EXE)
    if not build_desktop():
        print("Build failed at Desktop stage.")
        return
    
    # 3. macOS
    if not build_mac():
        print("Build failed at macOS stage.")
        # We continue here as mac build might need a mac to succeed 
        # but we'll report it
    
    # 4. Linux
    if not build_linux():
        print("Build failed at Linux stage.")
        
    # 5. Web
    if not build_web():
        print("Build failed at Web stage.")
        return
        
    # 6. Deployment
    print(f"\n{C.YEL}{C.BOLD}All builds complete.{C.RST}")
    print(f"Would you like to deploy to Firebase now? (y/n): ", end="", flush=True)
    ans = get_key()
    if ans == 'y':
        if not deploy_firebase():
            print("Failed at Firebase Deployment stage.")
            return

    print("\n===============================")
    print("  ULTIMATE RELEASE COMPLETE!")
    print("===============================")

def register_globally():
    print(f"\n--- [REGISTER MANAGER GLOBALLY] ---")
    project_root = os.path.dirname(os.path.abspath(__file__))
    # We'll use 'orbit' as the command name for efficiency and coolness
    bat_path = os.path.join(project_root, "orbit.bat")
    
    try:
        with open(bat_path, "w") as f:
            # We use %* to pass all arguments to the python script
            f.write(f'@echo off\npython "{os.path.join(project_root, "manager.py")}" %*\n')
        
        print(f"  {C.GRN}✔ Created '{C.BOLD}orbit.bat{C.RST}{C.GRN}' in {project_root}{C.RST}")
        
        # Automate PATH addition using PowerShell (safer than setx)
        print(f"  {C.CYAN}[*] Attempting to automate PATH registration...{C.RST}")
        
        ps_script = f'''
        $newPath = "{project_root}"
        $oldPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($oldPath -split ';' -notcontains $newPath) {{
            [Environment]::SetEnvironmentVariable("Path", $oldPath + ";" + $newPath, "User")
            Write-Host "ADDED"
        }} else {{
            Write-Host "EXISTS"
        }}
        '''
        
        res = subprocess.run(["powershell", "-Command", ps_script], capture_output=True, text=True)
        
        if "ADDED" in res.stdout:
            print(f"  {C.GRN}✔ Project root added to User PATH successfully.{C.RST}")
        elif "EXISTS" in res.stdout:
            print(f"  {C.GRAY}ℹ Project root is already in your PATH.{C.RST}")
        else:
            print(f"  {C.YEL}⚠ Could not automate PATH change. Please add it manually:{C.RST}")
            print(f"    Path: {project_root}")

        print(f"\n  {C.WHT}{C.BOLD}DONE!{C.RST} Just {C.BOLD}RESTART{C.RST} your terminal.")
        print(f"  Then you can type {C.CYAN}{C.BOLD}orbit{C.RST} from any folder!")
    except Exception as e:
        print(f"  {C.RED}✘ Error during registration: {e}{C.RST}")

def show_help_shortcuts():
    """Displays all available CLI shortcuts for the 'orbit' command."""
    clear_terminal()
    print(f"\n  {C.BLUE}{C.BOLD}INNERORBIT CLI SHORTCUTS{C.RST}")
    print(f"  {C.GRAY}{'─' * 45}{C.RST}")
    print(f"  {C.CYAN}Usage:{C.RST} orbit <shortcut>")
    print()
    
    shortcuts = [
        ("debug", "Build Android Debug APK"),
        ("release", "Build Android Release APK"),
        ("android", "Build Both Android APKs"),
        ("clean", "Clean Android Project"),
        ("fresh", "Fresh Android Build (Clean + Both)"),
        ("install", "Install Debug APK to Device"),
        ("phys", "Physical Device Debug (Build + Install)"),
        ("start", "Start Expo Dev Server"),
        ("portal", "Start React Portal (Vite)"),
        ("download", "Start Legacy Download Portal"),
        ("both", "Start Both Portals"),
        ("dev", "Physical Device Flow (Build + Install + Start)"),
        ("desktop", "Build Windows EXE"),
        ("web", "Build Web Application"),
        ("electron", "Launch Electron (Dev Mode)"),
        ("firebase", "Deploy to Firebase"),
        ("rules", "Deploy Firestore Rules Only"),
        ("git", "Git Operations Menu"),
        ("health", "Project Health Check"),
        ("cleanup", "Cleanup Release Folder"),
        ("gui", "Launch Premium GUI Console"),
        ("setup", "Launch Setup Wizard"),
        ("browser", "Select Preferred Browser"),
        ("reset", "Reset Terminal Choice"),
        ("register", "Register Manager Globally (orbit command)"),
        ("exit", "Terminate InnerOrbit Manager"),
        ("all", "Ultimate Project Release (Full Chain)")
    ]
    
    for cmd, desc in shortcuts:
        print(f"  {C.WHT}{cmd:<12}{C.RST}  {C.GRAY}→{C.RST}  {desc}")
    
    print(f"\n  {C.GRAY}{'─' * 45}{C.RST}")
    print(f"  {C.YEL}Press ENTER to restart or [Q] to Quit...{C.RST}")
    
    while True:
        choice = get_key()
        if choice == 'q':
            print(f"\n  {C.RED}[*] Exiting InnerOrbit Manager...{C.RST}")
            time.sleep(0.2)
            sys.exit(0)
        elif choice in ['\r', '\n']:
            break
        # Ignore other keys to prevent accidental trigger
    
    print(f"  {C.CYAN}[*] Rebooting InnerOrbit Hub...{C.RST}")
    time.sleep(0.5)
    # Pass --restarted flag to skip animations on reload
    os.execv(sys.executable, [sys.executable] + sys.argv + ["--restarted"])

def main():
    flush_input()
    
    # Persistent launch tracking to detect recent restarts even after exit
    last_launch_file = os.path.join("tools", ".last_launch")
    recent_launch = False
    now = time.time()
    
    if os.path.exists(last_launch_file):
        try:
            with open(last_launch_file, "r") as f:
                last_time = float(f.read().strip())
                # If started again within 5 minutes, treat as a quick reload
                if now - last_time < 300:
                    recent_launch = True
        except:
            pass
    
    try:
        with open(last_launch_file, "w") as f:
            f.write(str(now))
    except:
        pass

    parser = argparse.ArgumentParser(description="InnerOrbit Project Manager")
    parser.add_argument("task", nargs="?", help="Task to run")
    parser.add_argument("--restarted", action="store_true", help="Skip animations on restart")
    args = parser.parse_args()

    # Quick boot if flag is passed OR if we detected a recent manual launch
    is_restarted = args.restarted or recent_launch
    
    if args.task:
        task = args.task.lower()
        # (Task mapping remains same for CLI consistency)
        if task == "debug": build_android_debug()
        elif task in ["release", "prod"]: build_android_release()
        elif task == "android": build_android_both()
        elif task == "clean": clean_android()
        elif task == "fresh": fresh_build_android()
        elif task == "install": install_on_device()
        elif task == "phys": debug_physical_device_workflow()
        elif task == "start": start_dev_server()
        elif task == "react": start_dev_server()
        elif task == "portal": start_react_portal_server()
        elif task == "download": start_download_portal_server()
        elif task == "both": start_both_portals()
        elif task == "dev": physical_dev_flow()
        elif task == "desktop": build_desktop()
        elif task == "web": build_web()
        elif task == "electron": launch_electron_dev()
        elif task == "firebase": deploy_firebase()
        elif task == "rules": deploy_firestore_rules()
        elif task == "git": git_ops_menu()
        elif task == "health": check_project_health()
        elif task == "cleanup": cleanup_release()
        elif task == "gui": launch_gui()
        elif task == "setup": launch_installer()
        elif task == "browser": set_preferred_browser()
        elif task == "reset": reset_terminal_choice()
        elif task == "register": register_globally()
        elif task == "exit": sys.exit(0)
        elif task in ["help", "h"]: show_help_shortcuts()
        elif task == "all": full_release()
        sys.exit(0)

    # --- INTERACTIVE HUB SYSTEM ---
    if not is_restarted:
        time.sleep(0.5) # Smooth transition
    
    show_splash(restarted=is_restarted)
    ask_terminal()
    
    current_cat = "HUB"
    
    try:
        while True:
            choice = None
            flush_input()
            clear_terminal()
            print(f"\n  {C.BLUE}{C.BOLD}INNERORBIT PROJECT HUB{C.RST} {C.GRAY}│ v{VERSION}{C.RST}")
            if is_admin():
                print(f"  {C.RED}{C.BOLD}[ADMIN MODE]{C.RST} {C.GRAY}Elevated privileges active.{C.RST}")
            print(f"  {C.GRAY}{'─' * 45}{C.RST}")

            if current_cat == "HUB":
                print(f"  {C.WHT}Select a category to explore:{C.RST}\n")
                print(f"  {C.GRN}[A]{C.RST}  {C.WHT}Android{C.RST}             {C.GRAY}(APK builds, install to device){C.RST}")
                print(f"  {C.PURP}[B]{C.RST}  {C.WHT}Build & Release{C.RST}     {C.GRAY}(Desktop, Web, macOS, Linux, Full Release){C.RST}")
                print(f"  {C.BLUE}[D]{C.RST}  {C.WHT}Development{C.RST}         {C.GRAY}(Expo server, Electron testing){C.RST}")
                print(f"  {C.CYAN}[P]{C.RST}  {C.WHT}Portals & Browsers{C.RST}  {C.GRAY}(Vite, Legacy, Browser Choice){C.RST}")
                print(f"  {C.YEL}[O]{C.RST}  {C.WHT}Ops & Deployment{C.RST}    {C.GRAY}(Firebase, Git, Health Check){C.RST}")
                print(f"  {C.GRAY}[X]{C.RST}  {C.WHT}Advanced Options{C.RST}    {C.GRAY}(Setup, Cleanup, Globals){C.RST}")
                
                if is_admin():
                    print(f"  {C.RED}[K]{C.RST}  {C.WHT}Kernel Shell{C.RST}        {C.GRAY}(Direct manual command entry){C.RST}")
                else:
                    print(f"  {C.YEL}[E]{C.RST}  {C.WHT}Elevate to Admin{C.RST}    {C.GRAY}(Restart with Administrator rights){C.RST}")
                
                print(f"\n  {C.BLUE}[G]{C.RST}  {C.BOLD}LAUNCH GUI CONSOLE{C.RST} {C.GRAY}(Premium Flask Interface){C.RST}")
                print(f"  {C.CYAN}[R]{C.RST}  {C.WHT}Restart Manager{C.RST}")
                print(f"  {C.RED}[Q]{C.RST}  {C.WHT}Quit Manager{C.RST}")
                print(f"  {C.YEL}[H]{C.RST}  {C.WHT}Help / Shortcuts{C.RST}")
                
                print(f"\n  {C.BOLD}Hub >{C.RST} ", end='', flush=True)
                choice = get_key()
                
                if choice == 'a': current_cat = "ANDROID"
                elif choice == 'b': current_cat = "BUILD"
                elif choice == 'd': current_cat = "DEV"
                elif choice == 'p': current_cat = "PORTAL"
                elif choice == 'o': current_cat = "OPS"
                elif choice == 'x': current_cat = "ADV"
                elif choice == 'k': launch_system_shell()
                elif choice == 'e': elevate_privileges()
                elif choice == 'g': launch_gui()
                elif choice == 'h': show_help_shortcuts()
                elif choice == 'r':
                    print(f"\n  {C.CYAN}[*] Shutting down services...{C.RST}")
                    time.sleep(0.8)
                    print(f"  {C.CYAN}[*] Rebooting InnerOrbit Hub...{C.RST}")
                    time.sleep(0.7)
                    # Pass --restarted flag to skip animations on reload
                    os.execv(sys.executable, [sys.executable] + sys.argv + ["--restarted"])
                elif choice == 'q': break
                continue

            elif current_cat == "ANDROID":
                print(f"  {C.GRN}{C.BOLD}ANDROID{C.RST}")
                print(f"  1. Build Debug APK")
                print(f"  2. Build Release APK")
                print(f"  3. Build Both APKs (Debug + Release)")
                print(f"  4. Clean Project")
                print(f"  5. Fresh Build (Clean + Both)")
                print(f"  6. Install Debug APK to Device")
                print(f"  7. {C.CYAN}Physical Device Debug{C.RST} (Build + Auto-Install)")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Android >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': build_android_debug()
                elif c == '2': build_android_release()
                elif c == '3': build_android_both()
                elif c == '4': clean_android()
                elif c == '5': fresh_build_android()
                elif c == '6': install_on_device()
                elif c == '7': debug_physical_device_workflow()
                
                if c: 
                    set_terminal_mode(True)
                    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")
                    set_terminal_mode(False)

            elif current_cat == "BUILD":
                print(f"  {C.PURP}{C.BOLD}BUILD & RELEASE{C.RST}")
                print(f"  1. Build Windows Desktop App  {C.GRAY}(.exe){C.RST}")
                print(f"  2. Build macOS Standalone     {C.GRAY}(.dmg){C.RST}")
                print(f"  3. Build Linux Standalone     {C.GRAY}(.AppImage){C.RST}")
                print(f"  4. Build Web Application      {C.GRAY}(dist/){C.RST}")
                print(f"  5. {C.BOLD}FULL PROJECT RELEASE{C.RST}        {C.GRAY}(Android + Desktop + Web + Deploy){C.RST}")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Build >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': build_desktop()
                elif c == '2': build_mac()
                elif c == '3': build_linux()
                elif c == '4': build_web()
                elif c == '5': full_release()
                
                if c: 
                    set_terminal_mode(True)
                    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")
                    set_terminal_mode(False)

            elif current_cat == "DEV":
                print(f"  {C.BLUE}{C.BOLD}DEVELOPMENT{C.RST}")
                print(f"  1. Start Expo Dev Server      {C.GRAY}(localhost:8081){C.RST}")
                print(f"  2. {C.CYAN}Launch Electron Testing{C.RST}    {C.GRAY}(opens Electron → localhost:8081){C.RST}")
                print(f"  3. Physical Device Flow       {C.GRAY}(Build + Install + Start){C.RST}")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Dev >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': start_dev_server()
                elif c == '2': launch_electron_dev()
                elif c == '3': physical_dev_flow()
                
                if c: 
                    set_terminal_mode(True)
                    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")
                    set_terminal_mode(False)

            elif current_cat == "PORTAL":
                print(f"  {C.CYAN}{C.BOLD}PORTALS & BROWSERS{C.RST}")
                print(f"  1. Start React Portal         {C.GRAY}(port 5173){C.RST}")
                print(f"  2. Start Legacy Portal        {C.GRAY}(port 5679){C.RST}")
                print(f"  3. Start Both Portals")
                print(f"  4. Select Preferred Browser")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Portal >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': start_react_portal_server()
                elif c == '2': start_download_portal_server()
                elif c == '3': start_both_portals()
                elif c == '4': set_preferred_browser()
                
                if c: 
                    set_terminal_mode(True)
                    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")
                    set_terminal_mode(False)

            elif current_cat == "OPS":
                print(f"  {C.YEL}{C.BOLD}OPS & DEPLOYMENT{C.RST}")
                print(f"  1. Deploy to Firebase")
                print(f"  2. Deploy Firestore Rules Only")
                print(f"  3. Git Operations             {C.GRAY}(Sync, Branch, Status, Reset){C.RST}")
                print(f"  4. Project Health Check")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Ops >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': deploy_firebase()
                elif c == '2': deploy_firestore_rules()
                elif c == '3': git_ops_menu()
                elif c == '4': check_project_health()
                
                if c: 
                    set_terminal_mode(True)
                    input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")
                    set_terminal_mode(False)

            elif current_cat == "ADV":
                print(f"  {C.GRAY}{C.BOLD}ADVANCED TOOLS{C.RST}")
                print(f"  1. Launch GUI Project Console")
                print(f"  2. Launch Setup Wizard")
                print(f"  3. Cleanup Release Folder")
                print(f"  4. Reset Terminal Choice")
                print(f"  5. Register Manager Globally  {C.GRAY}(command: orbit){C.RST}")
                print(f"  6. Upgrade Manager Version")
                print(f"\n  [B] Back to Hub")
                
                print(f"\n  {C.BOLD}Advanced >{C.RST} ", end='', flush=True)
                c = get_key()
                if c == 'b': current_cat = "HUB"; continue
                if c == '1': launch_gui()
                elif c == '2': launch_installer()
                elif c == '3': cleanup_release()
                elif c == '4': reset_terminal_choice()
                elif c == '5': register_globally()
                elif c == '6': self_upgrade_version()
                
                if c: input(f"\n  {C.GRAY}Press Enter to continue...{C.RST}")

            # Final safety check to prevent loop runaway
            if not choice and current_cat == "HUB":
                time.sleep(0.1)

    except KeyboardInterrupt:
        print(f"\n  {C.GRAY}Exiting Hub...{C.RST}")
        sys.exit(0)
    except Exception as e:
        print(f"\n  {C.RED}[CRITICAL ERROR] Hub crashed: {e}{C.RST}")
        print(f"  {C.YEL}Attempting emergency restart...{C.RST}")
        time.sleep(2)
        os.execv(sys.executable, [sys.executable] + sys.argv)
if __name__ == "__main__":
    main()
