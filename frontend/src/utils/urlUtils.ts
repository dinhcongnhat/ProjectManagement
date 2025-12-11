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
 * Also handles avatar endpoint redirects
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
    
    // If it's an avatar path from Minio, construct avatar endpoint URL
    if (url.includes('avatars/') || url.startsWith('avatars/')) {
        // Extract user ID from avatar path if possible, otherwise use the URL
        const baseUrl = getApiBaseUrl();
        // For now, return the full path and let backend handle redirect
        return `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;
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
