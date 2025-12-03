// API Configuration
// Backend: ai.jtsc.io.vn (port 3001)
// Frontend: jtsc.io.vn (port 3000)

const isProduction = () => {
    return typeof window !== 'undefined' && 
        (window.location.hostname === 'jtsc.io.vn' || 
         window.location.hostname.endsWith('.jtsc.io.vn') ||
         window.location.hostname === 'ai.jtsc.io.vn');
};

const getDefaultApiUrl = () => {
    // Production - always use domain backend (ignore env vars for production)
    if (isProduction()) {
        return 'https://ai.jtsc.io.vn/api';
    }
    // Development mode - use env or localhost
    return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
};

const getDefaultWsUrl = () => {
    // Production - always use domain backend with WSS
    if (isProduction()) {
        return 'wss://ai.jtsc.io.vn';
    }
    // Development mode - use env or localhost
    return import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
};

export const API_URL = getDefaultApiUrl();
export const WS_URL = getDefaultWsUrl();

// Helper function to get API base URL (without /api suffix)
export const getApiBaseUrl = () => {
    return API_URL.replace('/api', '');
};
