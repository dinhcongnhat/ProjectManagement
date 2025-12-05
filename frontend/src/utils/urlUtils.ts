// URL Utility functions for resolving relative URLs

import { API_URL } from '../config/api';

/**
 * Get the base URL for API (without /api suffix)
 */
export const getApiBaseUrl = (): string => {
    return API_URL.replace(/\/api$/, '');
};

/**
 * Resolve a relative URL to an absolute URL
 * Handles both avatar URLs and attachment URLs
 * Works correctly on both web and PWA mobile
 */
export const resolveUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // If already absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // If it's a data URL (base64), return as is
    if (url.startsWith('data:')) {
        return url;
    }
    
    // If it's a blob URL, return as is
    if (url.startsWith('blob:')) {
        return url;
    }
    
    // For relative URLs starting with /, prepend API base URL
    if (url.startsWith('/')) {
        const baseUrl = getApiBaseUrl();
        return `${baseUrl}${url}`;
    }
    
    // For other relative URLs, also prepend base URL
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/${url}`;
};

/**
 * Resolve avatar URL specifically
 * Alias for resolveUrl for semantic clarity
 */
export const resolveAvatarUrl = resolveUrl;

/**
 * Resolve attachment URL specifically  
 * Alias for resolveUrl for semantic clarity
 */
export const resolveAttachmentUrl = resolveUrl;
