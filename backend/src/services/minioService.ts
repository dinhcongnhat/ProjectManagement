import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';

// Audio bucket for voice recordings
export const audioBucketName = 'projectmanagement';
export const audioPrefix = 'audio/';
export const discussionPrefix = 'discussions/';
export const onlyofficePrefix = 'onlyoffice/';

// Office file extensions that OnlyOffice Document Server can open
// Includes: Word, Excel, PowerPoint, OpenDocument, plain text, and PDF
export const officeExtensions = [
    // Microsoft Word
    'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
    // Microsoft Excel  
    'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
    // Microsoft PowerPoint
    'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
    // PDF (view-only in OnlyOffice)
    'pdf',
    // Other text formats
    'mht', 'html', 'htm'
];

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

            // Set bucket policy to allow public read access
            try {
                const policy = {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: { AWS: ['*'] },
                            Action: ['s3:GetObject'],
                            Resource: [`arn:aws:s3:::${bucketName}/*`]
                        }
                    ]
                };
                await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
                console.log(`[MinIO] Bucket policy set for public read access.`);
            } catch (policyError) {
                console.warn(`[MinIO] Warning: Could not set bucket policy:`, policyError);
                // Continue anyway - presigned URLs will still work
            }
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

        // Keep original UTF-8 filename - DO NOT normalize
        // Just ensure NFC normalization for Vietnamese characters
        const finalFileName = fileName.normalize('NFC');
        console.log(`[MinIO] Final filename (UTF-8): ${finalFileName}`);

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

        // Add custom metadata for original filename with UTF-8 encoding
        // Extract just the filename part (without folder path)
        const fileNameOnly = finalFileName.split('/').pop() || finalFileName;
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(fileNameOnly);
        finalMetaData['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileNameOnly)}`;

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
        // Keep UTF-8 filename, just normalize to NFC
        const normalizedFileName = fileName.normalize('NFC');
        const audioFileName = `${audioPrefix}${normalizedFileName}`;

        // Add original filename metadata with UTF-8
        const finalMetaData = { ...metaData };
        const fileNameOnly = normalizedFileName.split('/').pop() || normalizedFileName;
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(fileNameOnly);
        finalMetaData['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileNameOnly)}`;

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

// Get partial file stream for Range requests (video streaming)
export const getPartialFileStream = async (fileName: string, start: number, end: number): Promise<Readable> => {
    try {
        await ensureBucketExists();
        console.log(`[MinIO] Getting partial file stream for: ${fileName} (bytes ${start}-${end})`);
        const length = end - start + 1;
        const stream = await minioClient.getPartialObject(bucketName, fileName, start, length);
        console.log(`[MinIO] Partial file stream obtained successfully for: ${fileName}`);
        return stream;
    } catch (error: any) {
        console.error(`[MinIO] Error getting partial file stream for '${fileName}':`, error?.message || error);
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
        // Keep UTF-8 filename, just normalize to NFC
        const normalizedFileName = fileName.normalize('NFC');
        const discussionFileName = `${discussionPrefix}${normalizedFileName}`;

        // Add original filename metadata with UTF-8
        const finalMetaData = { ...metaData };
        const fileNameOnly = normalizedFileName.split('/').pop() || normalizedFileName;
        finalMetaData['X-Amz-Meta-Original-Filename'] = encodeURIComponent(fileNameOnly);
        finalMetaData['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileNameOnly)}`;

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

        // First check if file exists
        console.log(`[MinIO] Getting file stats for: ${fileName}`);
        try {
            await minioClient.statObject(bucketName, fileName);
            console.log(`[MinIO] File exists: ${fileName}`);
        } catch (statError: any) {
            console.log(`[MinIO] Error getting file stats for '${fileName}':`, statError?.message || statError);
            console.log(`[MinIO] Error code:`, statError?.code);

            // If file doesn't exist, throw specific error
            if (statError?.code === 'NoSuchKey' || statError?.code === 'NotFound') {
                throw new Error(`File not found: ${fileName}`);
            }

            // For other errors (like AccessDenied), try to generate presigned URL anyway
            console.log(`[MinIO] Attempting to generate presigned URL despite stat error...`);
        }

        // Generate presigned URL
        console.log(`[MinIO] Generating presigned URL for: ${fileName}`);
        const url = await minioClient.presignedGetObject(bucketName, fileName, expirySeconds);
        console.log(`[MinIO] Presigned URL generated successfully`);
        return url;
    } catch (error: any) {
        console.error(`[MinIO] Error getting presigned URL for '${fileName}':`, error?.message || error);
        console.error(`[MinIO] Error code:`, error?.code);
        console.error(`[MinIO] Error stack:`, error?.stack);
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

// Proxy file via presigned URL - bypasses browser SSL cert issues
// Backend fetches from MinIO (with NODE_TLS_REJECT_UNAUTHORIZED=0) and streams to client
export const proxyFileViaPresignedUrl = async (fileName: string): Promise<{
    stream: Readable;
    contentType: string;
    contentLength: number;
}> => {
    try {
        await ensureBucketExists();

        console.log(`[MinIO Proxy] Getting presigned URL for: ${fileName}`);
        const presignedUrl = await minioClient.presignedGetObject(bucketName, fileName, 3600);
        console.log(`[MinIO Proxy] Presigned URL generated, fetching...`);

        // Fetch the file using presigned URL
        const response = await fetch(presignedUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

        console.log(`[MinIO Proxy] File fetched successfully: ${contentType}, ${contentLength} bytes`);

        // Convert Web API ReadableStream to Node.js Readable
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const nodeStream = new Readable({
            async read() {
                try {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.push(null);
                    } else {
                        this.push(Buffer.from(value));
                    }
                } catch (err) {
                    this.destroy(err as Error);
                }
            }
        });

        return {
            stream: nodeStream,
            contentType,
            contentLength
        };
    } catch (error: any) {
        console.error(`[MinIO Proxy] Error proxying file '${fileName}':`, error?.message || error);
        throw error;
    }
};
