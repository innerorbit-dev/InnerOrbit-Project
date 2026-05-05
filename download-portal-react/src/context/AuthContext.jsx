import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check session storage on mount
        const access = sessionStorage.getItem('portalAccess');
        if (access === 'granted') {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const login = () => {
        sessionStorage.setItem('portalAccess', 'granted');
        setIsAuthenticated(true);
    };

    const logout = () => {
        sessionStorage.removeItem('portalAccess');
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
