// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

// Helper function to get API base URL (without /api suffix)
export const getApiBaseUrl = () => {
    return API_URL.replace('/api', '');
};
