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

    const checkSession = async (retries = 3) => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'https://jtscapi.duckdns.org/api';

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per attempt

                const response = await fetch(`${apiUrl}/users/profile`, {
                    headers: {
                        'Authorization': `Bearer ${storedToken}`
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const userData = await response.json();
                    const updatedUser = {
                        id: userData.id,
                        username: userData.username,
                        name: userData.name,
                        role: userData.role
                    };
                    setUser(updatedUser);
                    setToken(storedToken);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    setIsLoading(false);
                    return;
                } else {
                    // Token invalid or expired
                    logout();
                    return;
                }
            } catch (error: any) {
                console.error(`[Auth] Session check attempt ${attempt + 1}/${retries} failed:`, error?.message || error);
                if (attempt < retries - 1) {
                    // Wait with exponential backoff before retrying
                    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                }
            }
        }

        // After all retries failed, still allow the app to load with cached user data
        // This prevents permanent "Loading..." when backend is temporarily unreachable
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const cachedUser = JSON.parse(storedUser);
                setUser(cachedUser);
                setToken(storedToken);
                console.warn('[Auth] Using cached user data - backend may be unreachable');
            } catch {
                logout();
                return;
            }
        }
        setIsLoading(false);
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
