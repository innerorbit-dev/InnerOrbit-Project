# Last Updated: 2026-03-17
# Description: GUI Project Console for InnerOrbit. Provides a visual interface for running management tasks.
# Project Role: User-friendly alternative to the CLI manager for routine operations.

import tkinter as tk
from tkinter import ttk, scrolledtext
import subprocess
import threading
import os
import sys
import queue
import ctypes

# --- Configuration & Themes ---
THEMES = {
    "dark": {
        "bg": "#0D0D0F",
        "sidebar": "#111114",
        "accent": "#3B82F6",
        "accent2": "#8B5CF6",
        "text": "#F0F0F0",
        "text_secondary": "#6B7280",
        "console_bg": "#08080A",
        "console_fg": "#4ADE80",
        "btn_bg": "#1C1C20",
        "btn_fg": "#D1D5DB",
        "btn_hover": "#2D2D35",
        "separator": "#1F1F25",
        "border": "#27272A",
    },
    "light": {
        "bg": "#F0F2F5",
        "sidebar": "#FFFFFF",
        "accent": "#2563EB",
        "accent2": "#7C3AED",
        "text": "#111827",
        "text_secondary": "#6B7280",
        "console_bg": "#F9FAFB",
        "console_fg": "#065F46",
        "btn_bg": "#E5E7EB",
        "btn_fg": "#1F2937",
        "btn_hover": "#D1D5DB",
        "separator": "#E5E7EB",
        "border": "#D1D5DB",
    }
}

SUCCESS_COLOR = "#22C55E"
ERROR_COLOR  = "#EF4444"
WARN_COLOR   = "#F59E0B"

# Calculation of project root needs to go up two levels from tools/gui/
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANAGER_PATH = os.path.join(PROJECT_ROOT, "manager.py")


class GradientProgressBar(tk.Canvas):
    """Canvas-based progress bar with a blue→purple gradient fill."""
    def __init__(self, parent, height=8, **kwargs):
        super().__init__(parent, height=height, bd=0, highlightthickness=0, **kwargs)
        self._value = 0.0
        self.bind("<Configure>", self._redraw)

    def set(self, value):
        """value: 0–100"""
        self._value = max(0.0, min(100.0, value))
        self._redraw()

    def _redraw(self, event=None):
        self.delete("all")
        w = self.winfo_width()
        h = self.winfo_height()
        if w <= 1:
            return
        # Background track
        self.create_rectangle(0, 0, w, h, fill="#1E1E2E", outline="")
        # Filled portion
        fill_w = int(w * self._value / 100)
        if fill_w > 0:
            steps = max(1, fill_w)
            for i in range(steps):
                t = i / max(steps - 1, 1)
                r = int(0x3B + t * (0x8B - 0x3B))
                g = int(0x82 + t * (0x5C - 0x82))
                b = int(0xF6 + t * (0xF6 - 0xF6))
                color = f"#{r:02x}{g:02x}{b:02x}"
                self.create_line(i, 0, i, h, fill=color)
        # Rounded-cap highlight at tip
        if fill_w > 4:
            self.create_oval(fill_w - 6, 1, fill_w, h - 1, fill="#A78BFA", outline="")

# --- Stealth Mode (Hide calling terminal on Windows) ---
if sys.platform == "win32":
    try:
        # Hide the console window if it's currently focused (usually when launched via manager.py)
        kernel32 = ctypes.WinDLL('kernel32')
        user32 = ctypes.WinDLL('user32')
        hWnd = kernel32.GetConsoleWindow()
        if hWnd:
            user32.ShowWindow(hWnd, 0) # 0 = SW_HIDE
    except Exception:
        pass

class GuiManager:
    def __init__(self, root):
        self.root = root
        self.root.title("InnerOrbit | Project Console")
        self.root.geometry("1100x750") # Slightly taller
        
        self.current_theme_name = "dark"
        self.theme = THEMES[self.current_theme_name]
        
        self.process_queue = queue.Queue()
        self.is_running = False
        self.sidebar_buttons = []

        self.setup_styles()
        self.create_widgets()
        self.apply_theme()
        self.check_queue()

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use('clam')

    def create_widgets(self):
        # --- Main Layout ---
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(0, weight=1)

        # --- Sidebar ---
        self.sidebar_container = tk.Frame(self.root, width=200)
        self.sidebar_container.grid(row=0, column=0, sticky="nsew")
        self.sidebar_container.grid_propagate(False)

        # Sidebar Header (Logo)
        self.logo_frame = tk.Frame(self.sidebar_container)
        self.logo_frame.pack(fill="x")
        self.logo_label = tk.Label(self.logo_frame, text="INNERORBIT", font=("Segoe UI", 16, "bold"), pady=30)
        self.logo_label.pack()

        # Sidebar Canvas (for scrolling)
        self.sidebar_canvas = tk.Canvas(self.sidebar_container, highlightthickness=0)
        self.sidebar_scrollbar = tk.Scrollbar(self.sidebar_container, orient="vertical", command=self.sidebar_canvas.yview)
        self.scrollable_sidebar = tk.Frame(self.sidebar_canvas)

        self.scrollable_sidebar.bind(
            "<Configure>",
            lambda e: self.sidebar_canvas.configure(scrollregion=self.sidebar_canvas.bbox("all"))
        )

        self.canvas_window = self.sidebar_canvas.create_window((0, 0), window=self.scrollable_sidebar, anchor="nw", width=230)
        self.sidebar_canvas.configure(yscrollcommand=self.sidebar_scrollbar.set)

        self.sidebar_canvas.pack(side="left", fill="both", expand=True)
        self.sidebar_scrollbar.pack(side="right", fill="y")

        # Global bindings for MouseWheel
        self.sidebar_canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        # --- Main Area ---
        self.main_container = tk.Frame(self.root)
        self.main_container.grid(row=0, column=1, sticky="nsew")
        
        # Header
        self.header = tk.Frame(self.main_container, height=80)
        self.header.pack(fill="x", padx=25, pady=25)
        
        self.status_container = tk.Frame(self.header)
        self.status_container.pack(side="left")

        self.status_title = tk.Label(self.status_container, text="Ready", font=("Segoe UI", 20, "bold"))
        self.status_title.pack(side="left")

        self.status_indicator = tk.Label(self.status_container, text="●", fg=SUCCESS_COLOR, font=("Arial", 14))
        self.status_indicator.pack(side="left", padx=10)

        # Progress Bar Container
        self.progress_frame = tk.Frame(self.status_container)
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = GradientProgressBar(self.progress_frame, height=8, bg="#1E1E2E")
        self.progress_bar.pack(side="left", fill="x", expand=True)
        self.progress_bar.set(0)
        
        self.progress_label = tk.Label(self.progress_frame, text="0%", font=("Segoe UI", 10, "bold"))
        self.progress_label.pack(side="left", padx=10)

        # Theme Toggle Button (Refined)
        self.theme_btn = tk.Button(self.header, text=" 🌓 TOGGLE THEME ", command=self.toggle_theme,
                                  padx=15, pady=8, font=("Segoe UI", 9, "bold"), relief="flat", cursor="hand2")
        self.theme_btn.pack(side="right")

        # Console Container
        self.console_frame = tk.Frame(self.main_container)
        self.console_frame.pack(fill="both", expand=True, padx=25, pady=(0, 25))

        tk.Label(self.console_frame, text="TERMINAL OUTPUT", font=("Segoe UI", 9, "bold"), fg="#888888").pack(anchor="w", pady=(0, 5))
        
        self.console = scrolledtext.ScrolledText(
            self.console_frame,
            font=("Consolas", 10),
            borderwidth=0,
            padx=12, pady=12,
            wrap="word",
        )
        self.console.pack(fill="both", expand=True)
        self.console.tag_config("error",   foreground=ERROR_COLOR)
        self.console.tag_config("success", foreground=SUCCESS_COLOR)
        self.console.tag_config("warn",    foreground=WARN_COLOR)
        self.console.tag_config("info",    foreground=THEMES["dark"]["accent"])

        # Responsive: re-expand canvas window on sidebar resize
        self.sidebar_canvas.bind(
            "<Configure>",
            lambda e: self.sidebar_canvas.itemconfig(self.canvas_window, width=e.width)
        )

        # --- Fill Sidebar ---
        self.create_sidebar_content()

    def _on_mousewheel(self, event):
        # Determine if we are over the sidebar or main area
        x, y = self.root.winfo_pointerxy()
        widget = self.root.winfo_containing(x, y)
        
        # If hovering over sidebar-related widget, scroll sidebar
        if widget and (self.sidebar_container in self.get_ancestors(widget)):
             self.sidebar_canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def get_ancestors(self, widget):
        ancestors = []
        while widget:
            ancestors.append(widget)
            widget = widget.master
        return ancestors

    def _add_hover(self, btn):
        """Attach hover highlight to a sidebar button."""
        t = self.theme
        btn.bind("<Enter>", lambda e, b=btn: b.configure(bg=t["btn_hover"], fg=t["accent"]))
        btn.bind("<Leave>", lambda e, b=btn: b.configure(bg=t["sidebar"],   fg=t["text"]))

    def create_sidebar_content(self):
        for child in self.scrollable_sidebar.winfo_children():
            child.destroy()
        
        self.sidebar_buttons = []
        sections = [
            ("ANDROID", [
                ("Debug APK", "1"),
                ("Release APK", "2"),
                ("Both APKs", "3"),
                ("Fresh Build", "5"),
                ("Install on Device", "6"),
                ("Clean Project", "4"),
            ]),
            ("DEVELOPMENT", [
                ("Expo Dev Server", "7"),
                ("Physical Dev Flow", "8"),
            ]),
            ("PORTALS", [
                ("React Portal  :5173", "18"),
                ("Legacy Portal :5679", "19"),
                ("Start Both Portals", "20"),
            ]),
            ("DESKTOP", [
                ("Build EXE", "9"),
                ("Setup Wizard", "17"),
                ("Cleanup Release", "15"),
            ]),
            ("WEB & CLOUD", [
                ("Build Web", "10"),
                ("Deploy Firebase", "11"),
            ]),
            ("SYSTEM", [
                ("Git Sync", "12"),
                ("Full Release", "13"),
                ("Compatibility Check", "14"),
                ("Launch GUI Console", "16"),
            ])
        ]

        for section_name, actions in sections:
            # Section separator
            sep = tk.Frame(self.scrollable_sidebar, height=1)
            sep.pack(fill="x", padx=15, pady=(10, 0))
            self.sidebar_buttons.append(sep)

            lbl = tk.Label(
                self.scrollable_sidebar,
                text=section_name,
                font=("Segoe UI", 7, "bold"),
                pady=6,
                anchor="w",
            )
            lbl.pack(anchor="w", padx=20)
            self.sidebar_buttons.append(lbl)

            for label, code in actions:
                btn = tk.Button(
                    self.scrollable_sidebar,
                    text=f"  {label}",
                    command=lambda c=code: self.run_task(c),
                    anchor="w",
                    font=("Segoe UI", 10),
                    relief="flat",
                    cursor="hand2",
                    padx=15,
                    pady=9,
                    bd=0,
                )
                btn.pack(fill="x", padx=8, pady=1)
                self._add_hover(btn)
                self.sidebar_buttons.append(btn)

    def toggle_theme(self):
        self.current_theme_name = "light" if self.current_theme_name == "dark" else "dark"
        self.theme = THEMES[self.current_theme_name]
        self.apply_theme()

    def apply_theme(self):
        t = self.theme
        self.root.configure(bg=t["bg"])

        # Sidebar
        self.sidebar_container.configure(bg=t["sidebar"])
        self.logo_frame.configure(bg=t["sidebar"])
        self.logo_label.configure(bg=t["sidebar"], fg=t["accent"])
        self.sidebar_canvas.configure(bg=t["sidebar"])
        self.scrollable_sidebar.configure(bg=t["sidebar"])

        for widget in self.sidebar_buttons:
            if isinstance(widget, tk.Label):
                widget.configure(bg=t["sidebar"], fg=t["text_secondary"])
            elif isinstance(widget, tk.Frame):  # separator
                widget.configure(bg=t["separator"])
            else:
                widget.configure(
                    bg=t["sidebar"], fg=t["text"],
                    activebackground=t["accent"], activeforeground="white"
                )
                self._add_hover(widget)  # re-bind with updated colours

        # Main Area
        self.main_container.configure(bg=t["bg"])
        self.header.configure(bg=t["bg"])
        self.status_container.configure(bg=t["bg"])
        self.status_title.configure(bg=t["bg"], fg=t["text"])
        self.status_indicator.configure(bg=t["bg"])
        self.progress_frame.configure(bg=t["bg"])
        self.progress_label.configure(bg=t["bg"], fg=t["text_secondary"])
        self.console_frame.configure(bg=t["bg"])

        self.theme_btn.configure(bg=t["btn_bg"], fg=t["btn_fg"], activebackground=t["accent"])

        # Console
        self.console.configure(bg=t["console_bg"], fg=t["console_fg"], insertbackground=t["text"])
        self.console.tag_config("info", foreground=t["accent"])

        # Progress bar track colour
        self.progress_bar.configure(bg="#1E1E2E" if self.current_theme_name == "dark" else "#E5E7EB")

        # Scrollbar
        self.sidebar_scrollbar.configure(bg=t["sidebar"])

    def run_task(self, option_code):
        if self.is_running:
            self.log("Wait for current task to finish...\n", "error")
            return
        
        self.is_running = True
        self.status_title.config(text=f"Executing Task {option_code}")
        self.status_indicator.config(fg="orange")
        self.console.delete(1.0, tk.END)
        self.log(f">>> Initializing task {option_code} via manager.py...\n", "info")
        
        self.progress_bar.set(0)
        self.progress_label.config(text="0%")
        self.progress_frame.pack(side="left", padx=20)
        self.simulate_progress()
        
        thread = threading.Thread(target=self.execute_subprocess, args=(option_code,))
        thread.daemon = True
        thread.start()

    def execute_subprocess(self, option_code):
        cli_map = {
            "1": "debug",    "2": "release",  "3": "android",  "4": "clean",
            "5": "fresh",    "6": "install",  "7": "start",    "8": "dev",
            "9": "desktop",  "10": "web",     "11": "firebase", "12": "git",
            "13": "all",     "14": "compat",  "15": "cleanup",  "16": "gui",
            "17": "setup",   "18": "portal",  "19": "download", "20": "both"
        }
        
        arg = cli_map.get(option_code, "help")
        cmd = [sys.executable, MANAGER_PATH, arg]
        
        try:
            process = subprocess.Popen(
                cmd,
                cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                shell=False,
                bufsize=1,
                universal_newlines=True
            )
            
            for line in process.stdout:
                self.process_queue.put(("log", line))
            
            process.wait()
            self.process_queue.put(("done", process.returncode))
            
        except Exception as e:
            self.process_queue.put(("log", f"Failed to start manager: {e}\n"))
            self.process_queue.put(("done", 1))

    def simulate_progress(self):
        if not self.is_running:
            return
            
        current = self.progress_bar._value
        if current < 95:
            increment = (98 - current) * 0.05
            if increment < 0.1:
                increment = 0.1
            new_val = current + increment
            self.progress_bar.set(new_val)
            self.progress_label.config(text=f"{int(new_val)}%")
            
        self.root.after(500, self.simulate_progress)

    def hide_progress(self):
        if not self.is_running:
            self.progress_frame.pack_forget()

    def log(self, text, tag=None):
        # Check if we should auto-scroll (only if already at the bottom)
        is_at_bottom = self.console.yview()[1] == 1.0
        self.console.insert(tk.END, text, tag)
        if is_at_bottom:
            self.console.see(tk.END)

    def check_queue(self):
        try:
            while True:
                msg_msg = self.process_queue.get_nowait()
                msg_type, data = msg_msg
                if msg_type == "log":
                    self.log(data)
                elif msg_type == "done":
                    self.is_running = False
                    self.progress_var.set(100)
                    self.progress_label.config(text="100%")
                    self.root.after(2500, self.hide_progress)
                    
                    if data == 0:
                        self.status_title.config(text="Task Completed ✓")
                        self.status_indicator.config(fg=SUCCESS_COLOR)
                        self.log("\n✓ Operation completed successfully.\n", "success")
                        self.progress_bar.set(100)
                        self.progress_label.config(text="100%")
                    else:
                        self.status_title.config(text="Task Failed ✗")
                        self.status_indicator.config(fg=ERROR_COLOR)
                        self.log(f"\n✗ Operation failed with exit code {data}.\n", "error")
                        self.progress_bar.set(100)
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self.check_queue)

if __name__ == "__main__":
    root = tk.Tk()
    app = GuiManager(root)
    root.mainloop()
