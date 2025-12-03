// Helper to decode Vietnamese filenames that may have encoding issues

export const decodeVietnameseFilename = (filename: string): string => {
    try {
        // First try to decode URI encoding
        let decoded = filename;
        try {
            decoded = decodeURIComponent(filename);
        } catch {
            // Not URI encoded, continue
        }
        
        // Check for mojibake (UTF-8 bytes misinterpreted as Latin-1)
        // Common patterns in Vietnamese mojibake
        if (/Ã|Æ|Â|á»|áº|Ä/.test(decoded)) {
            try {
                // Convert each character to its byte value and re-decode as UTF-8
                const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
                const fixed = new TextDecoder('utf-8').decode(bytes);
                // Check if the result looks valid (no replacement characters)
                if (fixed && !/�/.test(fixed)) {
                    decoded = fixed;
                }
            } catch {
                // Keep original if fix fails
            }
        }
        
        return decoded;
    } catch {
        return filename;
    }
};

// Extract display filename from attachment path
export const getDisplayFilename = (attachment: string): string => {
    if (!attachment) return '';
    
    // Handle path with prefix (e.g., onlyoffice/timestamp-filename)
    let fileName = attachment;
    if (attachment.includes('/')) {
        const pathParts = attachment.split('/');
        fileName = pathParts[pathParts.length - 1];
    }
    
    // Remove timestamp prefix (format: timestamp-filename)
    const parts = fileName.split('-');
    if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        fileName = parts.slice(1).join('-');
    }
    
    return decodeVietnameseFilename(fileName);
};
