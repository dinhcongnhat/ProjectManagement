// API Configuration
// Backend: ai.jtsc.io.vn (port 3001)
// Frontend: jtsc.io.vn (port 3000)

const isProduction = () => {
    return typeof window !== 'undefined' && 
        (window.location.hostname === 'jtsc.io.vn' || 
         window.location.hostname.endsWith('.jtsc.io.vn') ||
         window.location.hostname === 'ai.jtsc.io.vn');
};

const isMobileApp = () => {
    // Check if running as PWA or mobile browser
    return typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
    );
};

const getDefaultApiUrl = () => {
    // Production - always use domain backend (ignore env vars for production)
    if (isProduction()) {
        return 'https://ai.jtsc.io.vn/api';
    }
    // Development mode - use env or IP default
    return import.meta.env.VITE_API_URL || 'http://10.10.1.254:3001/api';
};

const getDefaultWsUrl = () => {
    // Production - always use domain backend
    if (isProduction()) {
        return 'wss://ai.jtsc.io.vn';
    }
    // Development mode - use env or IP default
    return import.meta.env.VITE_WS_URL || 'ws://10.10.1.254:3001';
};

export const API_URL = getDefaultApiUrl();
export const WS_URL = getDefaultWsUrl();

// Helper function to get API base URL (without /api suffix)
export const getApiBaseUrl = () => {
    return API_URL.replace('/api', '');
};

// Check if device is mobile
export const isMobile = isMobileApp;

// Create axios-like API instance
const createApi = () => {
    const getAuthHeaders = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    return {
        get: async (path: string, config?: { params?: Record<string, any> }) => {
            const url = new URL(`${API_URL}${path}`);
            if (config?.params) {
                Object.entries(config.params).forEach(([key, value]) => {
                    if (value !== undefined) url.searchParams.append(key, String(value));
                });
            }
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                } as HeadersInit
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: 'Request failed' }));
                throw { response: { data: error, status: res.status } };
            }
            return { data: await res.json() };
        },
        
        post: async (path: string, data?: any, config?: { headers?: Record<string, string> }) => {
            const isFormData = data instanceof FormData;
            const headers: Record<string, string> = {
                ...getAuthHeaders()
            };
            
            // For FormData, don't set Content-Type - browser will set it with boundary
            if (!isFormData) {
                headers['Content-Type'] = 'application/json';
            }
            
            // Merge custom headers, but ignore Content-Type for FormData
            if (config?.headers) {
                Object.entries(config.headers).forEach(([key, value]) => {
                    if (isFormData && key.toLowerCase() === 'content-type') {
                        // Skip Content-Type for FormData to let browser set it
                        return;
                    }
                    headers[key] = value;
                });
            }
            
            const res = await fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers: headers as HeadersInit,
                body: isFormData ? data : JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: 'Request failed' }));
                throw { response: { data: error, status: res.status } };
            }
            return { data: await res.json() };
        },
        
        put: async (path: string, data?: any) => {
            const res = await fetch(`${API_URL}${path}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                } as HeadersInit,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: 'Request failed' }));
                throw { response: { data: error, status: res.status } };
            }
            return { data: await res.json() };
        },
        
        delete: async (path: string) => {
            const res = await fetch(`${API_URL}${path}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                } as HeadersInit
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: 'Request failed' }));
                throw { response: { data: error, status: res.status } };
            }
            return { data: await res.json() };
        }
    };
};

const api = createApi();
export default api;

// Fetch with retry for mobile network issues
export const fetchWithRetry = async (
    url: string, 
    options: RequestInit = {}, 
    retries = 3
): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return response;
            }
            
            // Don't retry for client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
                return response;
            }
            
            lastError = new Error(`HTTP ${response.status}`);
        } catch (err: any) {
            lastError = err;
            
            // Don't retry if request was aborted by user
            if (err.name === 'AbortError') {
                throw err;
            }
            
            // Wait before retrying
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    
    throw lastError || new Error('Fetch failed');
};
