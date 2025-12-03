import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';

// Audio bucket for voice recordings
export const audioBucketName = 'projectmanagement';
export const audioPrefix = 'audio/';
export const discussionPrefix = 'discussions/';
export const onlyofficePrefix = 'onlyoffice/';

// Office file extensions that should be opened with OnlyOffice
export const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf'];

// Check if file is an Office document
export const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

// Normalize Vietnamese filename to ensure proper encoding
export const normalizeVietnameseFilename = (filename: string): string => {
    // Ensure filename is properly encoded in UTF-8
    // Remove any invalid characters but keep Vietnamese diacritics
    return filename
        .normalize('NFC') // Normalize to composed form (NFC)
        .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
        .trim();
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
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, 'us-east-1'); // Region is required but often ignored by MinIO standalone
            console.log(`Bucket '${bucketName}' created successfully.`);
        }
    } catch (error) {
        console.error(`Error ensuring bucket '${bucketName}' exists:`, error);
        throw error;
    }
};

export const uploadFile = async (
    fileName: string,
    fileStream: Readable | Buffer | string,
    metaData: Record<string, string> = {}
): Promise<string> => {
    try {
        await ensureBucketExists();
        
        // Normalize Vietnamese filename
        const normalizedFileName = normalizeVietnameseFilename(fileName);
        
        // Determine if file should go to onlyoffice folder
        const isOffice = isOfficeFile(normalizedFileName);
        const finalFileName = isOffice ? `${onlyofficePrefix}${normalizedFileName}` : normalizedFileName;
        
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
        return await minioClient.getObject(bucketName, fileName);
    } catch (error) {
        console.error(`Error getting file stream for '${fileName}':`, error);
        throw error;
    }
};

export const getFileStats = async (fileName: string): Promise<any> => {
    try {
        await ensureBucketExists();
        return await minioClient.statObject(bucketName, fileName);
    } catch (error) {
        console.error(`Error getting file stats for '${fileName}':`, error);
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
