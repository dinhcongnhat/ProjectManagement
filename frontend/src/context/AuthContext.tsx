import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: number;
    username: string;
    name: string;
    role: 'ADMIN' | 'USER';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
    checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSession = async () => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        try {
            // Verify token with backend
            // usage of fetch directly to avoid circular dependency if api.ts uses AuthContext (it doesn't, but keeps it clean)
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://jtscapi.duckdns.org/api'}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${storedToken}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                // Update user data from backend (fresh info)
                const updatedUser = {
                    id: userData.id,
                    username: userData.username,
                    name: userData.name,
                    role: userData.role
                };
                setUser(updatedUser);
                setToken(storedToken);
                localStorage.setItem('user', JSON.stringify(updatedUser)); // Update local storage
            } else {
                // Token invalid or expired
                logout();
            }
        } catch (error) {
            console.error('Session check failed:', error);
            // Don't logout immediately on network error, allows offline mode if needed
            // But if 401 it will be caught above
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                // Validate in background to keep UI responsive
                checkSession();
            } else {
                setIsLoading(false);
            }
        };
        initAuth();
    }, []);

    // Listen for PWA resume event
    useEffect(() => {
        const handlePWAResume = () => {
            console.log('[Auth] PWA resumed, checking session...');
            checkSession();
        };

        window.addEventListener('pwa-resume', handlePWAResume);
        return () => window.removeEventListener('pwa-resume', handlePWAResume);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isLoading, checkSession } as any}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
