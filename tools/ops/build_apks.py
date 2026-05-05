# Last Updated: 2026-03-17
# Description: Automated Android APK build script. Compiles both Debug and Release versions.
# Project Role: Core build utility for generating Android installers.

import os
import subprocess
import sys

def run_command(command, cwd):
    print(f"\nRunning: {' '.join(command)}")
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        for line in process.stdout:
            print(line, end='')
            
        process.wait()
        return process.returncode
    except Exception as e:
        print(f"Error executing command: {e}")
        return 1

def main():
    # Determine base directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # script_dir is tools/ops, so we go up two levels for root
    base_dir = os.path.dirname(os.path.dirname(script_dir))
    
    # Try to find 'android' directory
    android_dir = os.path.join(base_dir, "innerorbit-universal", "android")
    if not os.path.exists(android_dir):
        # Fallback for different structures
        android_dir = os.path.join(base_dir, "android")
        
    if not os.path.exists(android_dir):
        print(f"Error: Could not find 'android' directory at {android_dir}")
        sys.exit(1)

    print(f"--- Starting Android APK Build Process ---")
    print(f"Working Directory: {android_dir}")

    # Build Debug
    print("\n[1/2] Building Debug APK...")
    gradle_cmd = r".\gradlew" if os.name == 'nt' else "./gradlew"
    debug_rc = run_command([gradle_cmd, "assembleDebug"], android_dir)
    if debug_rc != 0:
        print("\nDebug build failed!")
        sys.exit(1)

    # Build Release
    print("\n[2/2] Building Release APK...")
    release_rc = run_command([gradle_cmd, "assembleRelease"], android_dir)
    if release_rc != 0:
        print("\nRelease build failed!")
        sys.exit(1)

    print("\n--- Build Successful! ---")
    apk_base = os.path.join(android_dir, "app", "build", "outputs", "apk")
    print(f"Debug APK:   {os.path.join(apk_base, 'debug', 'app-debug.apk')}")
    print(f"Release APK: {os.path.join(apk_base, 'release', 'app-release.apk')}")

if __name__ == "__main__":
    main()
