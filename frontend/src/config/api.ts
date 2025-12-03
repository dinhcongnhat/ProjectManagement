// API Configuration
// Backend: ai.jtsc.io.vn (port 3001)
// Frontend: jtsc.io.vn (port 3000)

const getDefaultApiUrl = () => {
    // Production - sử dụng domain backend
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'jtsc.io.vn' || window.location.hostname.endsWith('.jtsc.io.vn'))) {
        return 'https://ai.jtsc.io.vn/api';
    }
    // Development mode - localhost
    return 'http://localhost:3001/api';
};

const getDefaultWsUrl = () => {
    // Production - sử dụng domain backend với WSS
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'jtsc.io.vn' || window.location.hostname.endsWith('.jtsc.io.vn'))) {
        return 'wss://ai.jtsc.io.vn';
    }
    return 'http://localhost:3001';
};

export const API_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();
export const WS_URL = import.meta.env.VITE_WS_URL || getDefaultWsUrl();

// Helper function to get API base URL (without /api suffix)
export const getApiBaseUrl = () => {
    return API_URL.replace('/api', '');
};
