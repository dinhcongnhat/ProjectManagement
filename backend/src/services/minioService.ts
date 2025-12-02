import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';

// Audio bucket for voice recordings
export const audioBucketName = 'projectmanagement';
export const audioPrefix = 'audio/';

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
    metaData: Record<string, any> = {}
): Promise<string> => {
    try {
        await ensureBucketExists();
        await minioClient.putObject(bucketName, fileName, fileStream, undefined, metaData);
        console.log(`File '${fileName}' uploaded successfully.`);
        // Return the URL or path - for private buckets, you might need presigned URLs
        // For now, just returning the filename as confirmation
        return fileName;
    } catch (error) {
        console.error(`Error uploading file '${fileName}':`, error);
        throw error;
    }
};

// Upload audio file to audio subfolder
export const uploadAudioFile = async (
    fileName: string,
    fileStream: Readable | Buffer | string,
    metaData: Record<string, any> = {}
): Promise<string> => {
    try {
        await ensureBucketExists();
        const audioFileName = `${audioPrefix}${fileName}`;
        await minioClient.putObject(audioBucketName, audioFileName, fileStream, undefined, metaData);
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
