import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';

// Audio bucket for voice recordings
export const audioBucketName = 'projectmanagement';
export const audioPrefix = 'audio/';
export const discussionPrefix = 'discussions/';
export const onlyofficePrefix = 'onlyoffice/';

// Office file extensions that should be opened with OnlyOffice
export const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf', 'pdf'];

// Check if file is an Office document
export const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

// Normalize Vietnamese filename to ensure proper encoding
export const normalizeVietnameseFilename = (filename: string): string => {
    try {
        // Multer sends filename as latin1 encoded bytes when it should be UTF-8
        // We need to convert from latin1 to UTF-8
        if (/[\xC0-\xFF]/.test(filename)) {
            // Contains high bytes, likely UTF-8 interpreted as latin1
            try {
                const utf8Filename = Buffer.from(filename, 'latin1').toString('utf8');
                // Normalize to composed form (NFC)
                return utf8Filename.normalize('NFC').trim();
            } catch (e) {
                console.warn('[normalizeFilename] UTF-8 conversion failed:', e);
            }
        }
        
        // Try URL decoding if encoded
        try {
            if (filename.includes('%')) {
                const decoded = decodeURIComponent(filename);
                return decoded.normalize('NFC').trim();
            }
        } catch {
            // Not URL encoded
        }
        
        // Already clean, just normalize
        return filename.normalize('NFC').trim();
    } catch (error) {
        console.warn('[normalizeFilename] Error normalizing:', error);
        return filename;
    }
};

export const checkMinioConnection = async (): Promise<boolean> => {
    try {
        await minioClient.listBuckets();
        return true;
    } catch (error) {
        console.error('MinIO connection failed:', error);
        return false;
    }
};

export const ensureBucketExists = async (): Promise<void> => {
    try {
        console.log(`[MinIO] Checking if bucket '${bucketName}' exists...`);
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            console.log(`[MinIO] Bucket '${bucketName}' does not exist, creating...`);
            await minioClient.makeBucket(bucketName, 'us-east-1'); // Region is required but often ignored by MinIO standalone
            console.log(`[MinIO] Bucket '${bucketName}' created successfully.`);
        } else {
            console.log(`[MinIO] Bucket '${bucketName}' already exists.`);
        }
    } catch (error) {
        console.error(`[MinIO] Error ensuring bucket '${bucketName}' exists:`, error);
        throw error;
    }
};

export const uploadFile = async (
    fileName: string,
    fileStream: Readable | Buffer | string,
    metaData: Record<string, string> = {}
): Promise<string> => {
    try {
        console.log(`[MinIO] uploadFile starting for: ${fileName}`);
        await ensureBucketExists();
        
        // Normalize Vietnamese filename
        const normalizedFileName = normalizeVietnameseFilename(fileName);
        console.log(`[MinIO] Normalized filename: ${normalizedFileName}`);
        
        // Determine if file should go to onlyoffice folder
        const isOffice = isOfficeFile(normalizedFileName);
        const finalFileName = isOffice ? `${onlyofficePrefix}${normalizedFileName}` : normalizedFileName;
        console.log(`[MinIO] Final filename: ${finalFileName}, isOffice: ${isOffice}`);
        
        // Ensure Content-Type header includes charset for text-based files
        const finalMetaData: Record<string, string> = { ...metaData };
        const contentType = finalMetaData['Content-Type'];
        if (contentType && !contentType.includes('charset')) {
            // Add UTF-8 charset for text-based content types
            const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript'];
            if (textTypes.some(t => contentType.includes(t))) {
                finalMetaData['Content-Type'] = `${contentType}; charset=utf-8`;
            }
        }
        
        // Add custom metadata for original filename with proper encoding
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(normalizedFileName);
        
        // Check if file exists and delete it first (to ensure fresh upload)
        try {
            const exists = await minioClient.statObject(bucketName, finalFileName);
            if (exists) {
                console.log(`[MinIO] File exists, will overwrite: ${finalFileName}`);
            }
        } catch (err) {
            // File doesn't exist, that's fine
        }
        
        await minioClient.putObject(bucketName, finalFileName, fileStream, undefined, finalMetaData);
        console.log(`File '${finalFileName}' uploaded successfully.`);
        return finalFileName;
    } catch (error) {
        console.error(`Error uploading file '${fileName}':`, error);
        throw error;
    }
};

// Upload audio file to audio subfolder
export const uploadAudioFile = async (
    fileName: string,
    fileStream: Readable | Buffer | string,
    metaData: Record<string, string> = {}
): Promise<string> => {
    try {
        await ensureBucketExists();
        const normalizedFileName = normalizeVietnameseFilename(fileName);
        const audioFileName = `${audioPrefix}${normalizedFileName}`;
        
        // Add original filename metadata
        const finalMetaData = { ...metaData };
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(normalizedFileName);
        
        await minioClient.putObject(audioBucketName, audioFileName, fileStream, undefined, finalMetaData);
        console.log(`Audio file '${audioFileName}' uploaded successfully.`);
        return audioFileName;
    } catch (error) {
        console.error(`Error uploading audio file '${fileName}':`, error);
        throw error;
    }
};

export const getFileStream = async (fileName: string): Promise<Readable> => {
    try {
        await ensureBucketExists();
        console.log(`[MinIO] Getting file stream for: ${fileName}`);
        const stream = await minioClient.getObject(bucketName, fileName);
        console.log(`[MinIO] File stream obtained successfully for: ${fileName}`);
        return stream;
    } catch (error: any) {
        console.error(`[MinIO] Error getting file stream for '${fileName}':`, error?.message || error);
        throw error;
    }
};

export const getFileStats = async (fileName: string): Promise<any> => {
    try {
        await ensureBucketExists();
        console.log(`[MinIO] Getting file stats for: ${fileName}`);
        
        const stats = await minioClient.statObject(bucketName, fileName);
        console.log(`[MinIO] File stats obtained for: ${fileName}, size: ${stats.size}`);
        return stats;
    } catch (error: any) {
        console.error(`[MinIO] Error getting file stats for '${fileName}':`, error?.message || error);
        console.error(`[MinIO] Error code:`, error?.code);
        throw error;
    }
};

// Upload discussion attachment file
export const uploadDiscussionFile = async (
    fileName: string,
    fileStream: Readable | Buffer | string,
    metaData: Record<string, string> = {}
): Promise<string> => {
    try {
        await ensureBucketExists();
        const normalizedFileName = normalizeVietnameseFilename(fileName);
        const discussionFileName = `${discussionPrefix}${normalizedFileName}`;
        
        // Add original filename metadata
        const finalMetaData = { ...metaData };
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(normalizedFileName);
        
        await minioClient.putObject(bucketName, discussionFileName, fileStream, undefined, finalMetaData);
        console.log(`Discussion file '${discussionFileName}' uploaded successfully.`);
        return discussionFileName;
    } catch (error) {
        console.error(`Error uploading discussion file '${fileName}':`, error);
        throw error;
    }
};

// Get presigned URL for file download (for viewing images directly)
export const getPresignedUrl = async (fileName: string, expirySeconds: number = 3600): Promise<string> => {
    try {
        await ensureBucketExists();
        return await minioClient.presignedGetObject(bucketName, fileName, expirySeconds);
    } catch (error) {
        console.error(`Error getting presigned URL for '${fileName}':`, error);
        throw error;
    }
};

// Delete file from MinIO
export const deleteFile = async (fileName: string): Promise<void> => {
    try {
        await ensureBucketExists();
        await minioClient.removeObject(bucketName, fileName);
        console.log(`File '${fileName}' deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting file '${fileName}':`, error);
        throw error;
    }
};
