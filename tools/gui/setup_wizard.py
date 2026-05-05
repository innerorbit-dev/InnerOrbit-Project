# Last Updated: 2026-03-17
# Description: Premium Setup Wizard for InnerOrbit. Handles application installation, shortcut creation, and registration.
# Project Role: User-facing installer for the Windows desktop application.

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
import shutil
import threading
import subprocess
import sys
import winreg

# --- Configuration & Theme ---
BG_COLOR = "#0A0A0A"        # Obsidian Black
SIDEBAR_COLOR = "#141414"   # Dark Grey
ACCENT_COLOR = "#007AFF"    # Apple Blue
TEXT_COLOR = "#E0E0E0"      # Off-white
SUCCESS_COLOR = "#28A745"

APP_NAME = "InnerOrbit"
APP_ID = "com.innerorbit.app"
VERSION = "1.0.3"

# Default Install Path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_INSTALL_DIR = os.path.join(os.environ.get("LOCALAPPDATA", "C:\\"), "Programs", APP_NAME)

class SetupWizard:
    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} Setup")
        self.root.geometry("600x450")
        self.root.resizable(False, False)
        self.root.configure(bg=BG_COLOR)

        self.current_page = 0
        self.install_dir = tk.StringVar(value=DEFAULT_INSTALL_DIR)
        self.create_desktop_shortcut = tk.BooleanVar(value=True)
        
        # Source directory (expecting win-unpacked in innerorbit-universal/release/win-unpacked)
        self.source_dir = os.path.join(PROJECT_ROOT, "innerorbit-universal", "release", "win-unpacked")

        self.setup_styles()
        self.container = tk.Frame(self.root, bg=BG_COLOR)
        self.container.pack(fill="both", expand=True)
        
        self.show_page(0)

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TButton", background="#1A1A1A", foreground=TEXT_COLOR, borderwidth=0, padding=10)
        style.map("TButton", background=[('active', ACCENT_COLOR)])
        
        style.configure("Accent.TButton", background=ACCENT_COLOR, foreground="white", font=("Segoe UI", 10, "bold"))
        style.map("Accent.TButton", background=[('active', '#005BB5')])

    def clear_container(self):
        for widget in self.container.winfo_children():
            widget.destroy()

    def show_page(self, page_num):
        self.clear_container()
        self.current_page = page_num
        
        if page_num == 0: self.page_welcome()
        elif page_num == 1: self.page_directory()
        elif page_num == 2: self.page_installing()
        elif page_num == 3: self.page_finish()

    def page_welcome(self):
        # Header Area
        header = tk.Frame(self.container, bg=SIDEBAR_COLOR, height=120)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text=APP_NAME, bg=SIDEBAR_COLOR, fg=ACCENT_COLOR, font=("Segoe UI", 24, "bold")).pack(pady=(20, 0))
        tk.Label(header, text=f"Version {VERSION} | Secure Messaging", bg=SIDEBAR_COLOR, fg="#888888", font=("Segoe UI", 9)).pack()

        # Content
        content = tk.Frame(self.container, bg=BG_COLOR, pady=40)
        content.pack(fill="both", expand=True)

        tk.Label(content, text="Welcome to the InnerOrbit Setup Wizard", bg=BG_COLOR, fg="white", 
                 font=("Segoe UI", 14, "bold")).pack(pady=10)
        
        msg = ("This wizard will guide you through the installation of InnerOrbit on your computer.\n\n"
               "InnerOrbit is a secure messaging platform disguised as a calculator, "
               "providing privacy and stealth for your communications.")
        
        tk.Label(content, text=msg, bg=BG_COLOR, fg=TEXT_COLOR, font=("Segoe UI", 10), 
                 wraplength=500, justify="center").pack(pady=10)

        # Footer
        footer = tk.Frame(self.container, bg=BG_COLOR, pady=20)
        footer.pack(side="bottom", fill="x")
        
        ttk.Button(footer, text="Next", style="Accent.TButton", command=lambda: self.show_page(1)).pack(side="right", padx=20)
        ttk.Button(footer, text="Cancel", command=self.root.quit).pack(side="right", padx=10)

    def page_directory(self):
        tk.Label(self.container, text="Installation Folder", bg=BG_COLOR, fg="white", font=("Segoe UI", 14, "bold"), pady=20).pack()
        
        tk.Label(self.container, text="Select the directory where you want to install InnerOrbit:", 
                 bg=BG_COLOR, fg=TEXT_COLOR, font=("Segoe UI", 10)).pack(pady=10)
        
        dir_frame = tk.Frame(self.container, bg=BG_COLOR)
        dir_frame.pack(pady=10, padx=40, fill="x")
        
        tk.Entry(dir_frame, textvariable=self.install_dir, bg="#1A1A1A", fg="white", borderwidth=0, font=("Segoe UI", 10)).pack(side="left", fill="x", expand=True, padx=(0, 10))
        ttk.Button(dir_frame, text="Browse...", command=self.browse_dir).pack(side="right")
        
        # Options
        opt_frame = tk.Frame(self.container, bg=BG_COLOR)
        opt_frame.pack(pady=20, padx=40, fill="x")
        
        tk.Checkbutton(opt_frame, text="Create Desktop Shortcut", variable=self.create_desktop_shortcut, 
                       bg=BG_COLOR, fg=TEXT_COLOR, selectcolor=BG_COLOR, activebackground=BG_COLOR,
                       activeforeground=ACCENT_COLOR, font=("Segoe UI", 10)).pack(anchor="w")

        # Footer
        footer = tk.Frame(self.container, bg=BG_COLOR, pady=20)
        footer.pack(side="bottom", fill="x")
        
        ttk.Button(footer, text="Install", style="Accent.TButton", command=lambda: self.show_page(2)).pack(side="right", padx=20)
        ttk.Button(footer, text="Back", command=lambda: self.show_page(0)).pack(side="right", padx=10)

    def browse_dir(self):
        path = filedialog.askdirectory(initialdir=self.install_dir.get())
        if path:
            self.install_dir.set(os.path.join(path, APP_NAME))

    def page_installing(self):
        tk.Label(self.container, text="Installing InnerOrbit...", bg=BG_COLOR, fg="white", font=("Segoe UI", 14, "bold"), pady=40).pack()
        
        self.progress = ttk.Progressbar(self.container, orient="horizontal", length=400, mode="determinate")
        self.progress.pack(pady=10)
        
        self.status_label = tk.Label(self.container, text="Preparing files...", bg=BG_COLOR, fg="#888888", font=("Segoe UI", 9))
        self.status_label.pack()
        
        # Start installation in thread
        threading.Thread(target=self.perform_installation).start()

    def update_status(self, text, val):
        self.status_label.config(text=text)
        self.progress['value'] = val
        self.root.update_idletasks()

    def perform_installation(self):
        try:
            dest = self.install_dir.get()
            
            # 1. Create directory
            self.update_status("Creating installation directory...", 10)
            os.makedirs(dest, exist_ok=True)
            
            # 2. Copy files
            self.update_status("Deploying application files...", 30)
            if not os.path.exists(self.source_dir):
                # Look for it in common locations if not found relative
                self.source_dir = os.path.join(PROJECT_ROOT, "innerorbit-universal", "release", "win-unpacked")
            
            if not os.path.exists(self.source_dir):
                 raise Exception(f"Source files not found! Please build the app first. Checked: {self.source_dir}")

            # Copy tree manually to track progress (roughly)
            files = []
            for root_dir, dirs, filenames in os.walk(self.source_dir):
                for f in filenames:
                    files.append(os.path.join(root_dir, f))
            
            total_files = len(files)
            for i, f in enumerate(files):
                rel_path = os.path.relpath(f, self.source_dir)
                dest_path = os.path.join(dest, rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                shutil.copy2(f, dest_path)
                if i % 5 == 0:
                    self.update_status(f"Copying: {os.path.basename(f)}", 30 + (i/total_files)*50)

            # 3. Create Shortcuts
            self.update_status("Creating shortcuts...", 85)
            exe_path = os.path.join(dest, "InnerOrbit.exe")
            if self.create_desktop_shortcut.get():
                self.create_shortcut(exe_path, os.path.join(os.environ["USERPROFILE"], "Desktop", "InnerOrbit.lnk"))
            
            # Start Menu
            start_menu = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs")
            self.create_shortcut(exe_path, os.path.join(start_menu, "InnerOrbit.lnk"))

            # 4. Registry Entries (Uninstaller)
            self.update_status("Registering application...", 95)
            self.register_uninstaller(dest)
            
            self.update_status("Installation complete!", 100)
            self.root.after(500, lambda: self.show_page(3))
            
        except Exception as e:
            messagebox.showerror("Installation Error", str(e))
            self.root.after(100, lambda: self.show_page(1))

    def create_shortcut(self, target, path):
        # Using PowerShell to create a shortcut (no external libs needed)
        ps_script = f'$Shell = New-Object -ComObject WScript.Shell; $Shortcut = $Shell.CreateShortcut("{path}"); $Shortcut.TargetPath = "{target}"; $Shortcut.Save()'
        subprocess.run(["powershell", "-Command", ps_script], capture_output=True)

    def register_uninstaller(self, install_dir):
        # Register in Windows Add/Remove Programs
        reg_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\InnerOrbit"
        try:
            key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path)
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "InnerOrbit")
            winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'"{sys.executable}" "{os.path.join(install_dir, "uninstall.py")}"')
            winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, os.path.join(install_dir, "InnerOrbit.exe"))
            winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, VERSION)
            winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, "InnerOrbit")
            winreg.CloseKey(key)
            
            # Create a simple uninstall.py in the destination
            with open(os.path.join(install_dir, "uninstall.py"), "w") as f:
                f.write(f'''
import os, shutil, winreg, sys, subprocess
print("Uninstalling InnerOrbit...")
reg_path = r"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\InnerOrbit"
try:
    winreg.DeleteKey(winreg.HKEY_CURRENT_USER, reg_path)
except: pass

# Delete shortcuts (simple approach)
try: os.remove(os.path.join(os.environ["USERPROFILE"], "Desktop", "InnerOrbit.lnk"))
except: pass
try: os.remove(os.path.join(os.environ["APPDATA"], r"Microsoft\\Windows\\Start Menu\\Programs", "InnerOrbit.lnk"))
except: pass

print("Removal complete. Please delete the installation folder manually if any files remain.")
''')
        except Exception as e:
            print(f"Failed to register uninstaller: {e}")

    def page_finish(self):
        tk.Label(self.container, text="Installation Successful!", bg=BG_COLOR, fg=SUCCESS_COLOR, font=("Segoe UI", 18, "bold"), pady=40).pack()
        
        tk.Label(self.container, text="InnerOrbit has been correctly installed on your computer.", 
                 bg=BG_COLOR, fg=TEXT_COLOR, font=("Segoe UI", 11)).pack(pady=10)
        
        tk.Label(self.container, text=f"Location: {self.install_dir.get()}", bg=BG_COLOR, fg="#888888", font=("Segoe UI", 9)).pack()

        # Footer
        footer = tk.Frame(self.container, bg=BG_COLOR, pady=20)
        footer.pack(side="bottom", fill="x")
        
        ttk.Button(footer, text="Finish", style="Accent.TButton", command=self.root.quit).pack(side="right", padx=20)
        
        # Checkbox to launch app
        self.launch_var = tk.BooleanVar(value=True)
        tk.Checkbutton(self.container, text="Launch InnerOrbit now", variable=self.launch_var, 
                       bg=BG_COLOR, fg=TEXT_COLOR, selectcolor=BG_COLOR, activebackground=BG_COLOR,
                       activeforeground=ACCENT_COLOR, font=("Segoe UI", 10)).pack(pady=20)

if __name__ == "__main__":
    root = tk.Tk()
    app = SetupWizard(root)
    root.mainloop()
