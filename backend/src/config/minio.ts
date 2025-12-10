import * as Minio from 'minio';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Strip protocol from endpoint if present (MinIO requires hostname only)
const rawEndpoint = process.env.MINIO_ENDPOINT || 'apiminiojtsc.duckdns.org';
const endPoint = rawEndpoint.replace(/^https?:\/\//, '');

// Default to port 9000 and no SSL (the working configuration)
const port = parseInt(process.env.MINIO_PORT || '9000');
const useSSL = process.env.MINIO_USE_SSL === 'true'; // Default false
const accessKey = process.env.MINIO_ACCESS_KEY || 'jtsc';
const secretKey = process.env.MINIO_SECRET_KEY || 'jtsc12345';
const bucketName = process.env.MINIO_BUCKET_NAME || 'projectmanagement';

console.log('[MinIO Config] Endpoint:', endPoint);
console.log('[MinIO Config] Port:', port);
console.log('[MinIO Config] UseSSL:', useSSL);
console.log('[MinIO Config] Bucket:', bucketName);
console.log('[MinIO Config] AccessKey:', accessKey);
console.log('[MinIO Config] SecretKey:', secretKey ? '***' + secretKey.slice(-4) : 'MISSING');

// Create client with explicit credentials
export const minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
});

export { bucketName };
