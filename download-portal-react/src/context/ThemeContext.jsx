import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    // 'system', 'light', 'dark'
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (targetTheme) => {
            if (targetTheme === 'dark') {
                root.setAttribute('data-theme', 'dark');
            } else if (targetTheme === 'light') {
                root.setAttribute('data-theme', 'light');
            } else {
                // System
                const systemIsLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                root.setAttribute('data-theme', systemIsLight ? 'light' : 'dark');
            }
        };

        applyTheme(theme);
        localStorage.setItem('theme', theme);

        // If system, listen for changes
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            const handleChange = (e) => {
                applyTheme('system'); // Re-evaluate
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
