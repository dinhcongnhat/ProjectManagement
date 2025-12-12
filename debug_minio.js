
// Test resolving URLs
console.log('Testing URL resolution...');

// Simulate what frontend does
const API_URL = 'http://localhost:3001/api';

const getApiBaseUrl = () => {
    return API_URL.replace(/\/api$/, '');
};

const resolveUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    if (url.startsWith('/')) {
        const baseUrl = getApiBaseUrl();
        return `${baseUrl}${url}`;
    }

    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/${url}`;
};

// Test cases
console.log('API_URL:', API_URL);
console.log('getApiBaseUrl():', getApiBaseUrl());
console.log('');
console.log('resolveUrl("/api/users/5/avatar"):', resolveUrl('/api/users/5/avatar'));
console.log('resolveUrl("/api/chat/conversations/13/messages/114/file"):', resolveUrl('/api/chat/conversations/13/messages/114/file'));
