// API Configuration
// Backend: ai.jtsc.io.vn (port 3001)
// Frontend: jtsc.io.vn (port 3000)

const isProduction = () => {
    return typeof window !== 'undefined' &&
        (window.location.hostname === 'jtsc.io.vn' ||
            window.location.hostname.endsWith('.jtsc.io.vn') ||
            window.location.hostname === 'jtscapi.duckdns.org');
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
        return 'https://jtscapi.duckdns.org/api';
    }
    // Development mode - use env or IP default
    return import.meta.env.VITE_API_URL || 'https://jtscapi.duckdns.org/api';
};

const getDefaultWsUrl = () => {
    // Production - always use domain backend
    if (isProduction()) {
        return 'wss://jtscapi.duckdns.org';
    }
    // Development mode - use env or IP default
    return import.meta.env.VITE_WS_URL || 'wss://jtscapi.duckdns.org';
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

    const handleResponse = async (res: Response) => {
        if (res.status === 401) {
            localStorage.removeItem('token');
            // Check if we are not already on the login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
            throw { response: { status: 401, data: { message: 'Session expired' } } };
        }

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Request failed' }));
            throw { response: { data: error, status: res.status } };
        }
        return { data: await res.json() };
    };

    const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    return {
        get: async (path: string, config?: { params?: Record<string, any>, responseType?: 'json' | 'blob' }) => {
            const url = new URL(`${API_URL}${path}`);
            if (config?.params) {
                Object.entries(config.params).forEach(([key, value]) => {
                    if (value !== undefined) url.searchParams.append(key, String(value));
                });
            }

            try {
                const res = await fetchWithTimeout(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    } as HeadersInit
                });

                if (config?.responseType === 'blob') {
                    if (!res.ok) {
                        const error = await res.json().catch(() => ({ message: 'Request failed' }));
                        throw { response: { data: error, status: res.status } };
                    }
                    return { data: await res.blob() };
                }

                return handleResponse(res);
            } catch (error: any) {
                if (error.name === 'AbortError') throw { response: { status: 408, data: { message: 'Request timeout' } } };
                throw error;
            }
        },

        post: async (path: string, data?: any, config?: { headers?: Record<string, string> }) => {
            const isFormData = data instanceof FormData;
            const headers: Record<string, string> = {
                ...getAuthHeaders()
            };

            if (!isFormData) {
                headers['Content-Type'] = 'application/json';
            }

            if (config?.headers) {
                Object.entries(config.headers).forEach(([key, value]) => {
                    if (isFormData && key.toLowerCase() === 'content-type') return;
                    headers[key] = value;
                });
            }

            try {
                const res = await fetchWithTimeout(`${API_URL}${path}`, {
                    method: 'POST',
                    headers: headers as HeadersInit,
                    body: isFormData ? data : JSON.stringify(data)
                });
                return handleResponse(res);
            } catch (error: any) {
                if (error.name === 'AbortError') throw { response: { status: 408, data: { message: 'Request timeout' } } };
                throw error;
            }
        },

        put: async (path: string, data?: any) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}${path}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    } as HeadersInit,
                    body: JSON.stringify(data)
                });
                return handleResponse(res);
            } catch (error: any) {
                if (error.name === 'AbortError') throw { response: { status: 408, data: { message: 'Request timeout' } } };
                throw error;
            }
        },

        patch: async (path: string, data?: any) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}${path}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    } as HeadersInit,
                    body: JSON.stringify(data)
                });
                return handleResponse(res);
            } catch (error: any) {
                if (error.name === 'AbortError') throw { response: { status: 408, data: { message: 'Request timeout' } } };
                throw error;
            }
        },

        delete: async (path: string) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    } as HeadersInit
                });
                return handleResponse(res);
            } catch (error: any) {
                if (error.name === 'AbortError') throw { response: { status: 408, data: { message: 'Request timeout' } } };
                throw error;
            }
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
