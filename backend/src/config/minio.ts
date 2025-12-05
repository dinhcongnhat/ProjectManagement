import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const useSSL = process.env.MINIO_USE_SSL === 'true';

console.log('[MinIO Config] Endpoint:', process.env.MINIO_ENDPOINT || 'localhost');
console.log('[MinIO Config] Port:', process.env.MINIO_PORT || '9000');
console.log('[MinIO Config] UseSSL:', useSSL);
console.log('[MinIO Config] Bucket:', process.env.MINIO_BUCKET_NAME || 'projectmanagement');
console.log('[MinIO Config] AccessKey present:', !!process.env.MINIO_ACCESS_KEY);
console.log('[MinIO Config] SecretKey present:', !!process.env.MINIO_SECRET_KEY);

export const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
});

export const bucketName = process.env.MINIO_BUCKET_NAME || 'projectmanagement';
