import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
});

console.log('MinIO Configuration:');
console.log('  Endpoint:', process.env.MINIO_ENDPOINT);
console.log('  Port:', process.env.MINIO_PORT);
console.log('  Use SSL:', process.env.MINIO_USE_SSL);
console.log('  Access Key:', process.env.MINIO_ACCESS_KEY);
console.log('  Bucket:', process.env.MINIO_BUCKET_NAME);
console.log('');

const testConnection = async () => {
    try {
        console.log('Testing MinIO connection...');
        const buckets = await minioClient.listBuckets();
        console.log('✅ MinIO connection successful!');
        console.log('Available buckets:', buckets.map(b => b.name).join(', '));
        
        // Check if the target bucket exists
        const targetBucket = process.env.MINIO_BUCKET_NAME || 'projectmanagement';
        const exists = await minioClient.bucketExists(targetBucket);
        if (exists) {
            console.log(`✅ Bucket '${targetBucket}' exists.`);
        } else {
            console.log(`⚠️ Bucket '${targetBucket}' does not exist.`);
        }
    } catch (error) {
        console.error('❌ MinIO connection failed:', error);
    }
};

testConnection();
