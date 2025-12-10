// Test MinIO Connection
// Run with: npx tsx src/test-minio.ts

import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// Get config
const rawEndpoint = process.env.MINIO_ENDPOINT || 'apiminiojtsc.duckdns.org';
const endPoint = rawEndpoint.replace(/^https?:\/\//, '');
const port = parseInt(process.env.MINIO_PORT || '443');
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'jtsc';
const secretKey = process.env.MINIO_SECRET_KEY || 'jtsc12345';
const bucketName = process.env.MINIO_BUCKET_NAME || 'projectmanagement';

console.log('=== MinIO Connection Test ===');
console.log('');
console.log('Configuration:');
console.log('  Endpoint:', endPoint);
console.log('  Port:', port);
console.log('  UseSSL:', useSSL);
console.log('  Bucket:', bucketName);
console.log('  AccessKey:', accessKey);
console.log('  SecretKey:', secretKey ? '***' + secretKey.slice(-4) : 'MISSING');
console.log('');

const client = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
});

async function testConnection() {
    try {
        console.log('1. Testing connection by listing buckets...');
        const buckets = await client.listBuckets();
        console.log('   ✓ Connected successfully!');
        console.log('   Buckets found:', buckets.map(b => b.name).join(', ') || '(none)');

        console.log('');
        console.log(`2. Checking if bucket "${bucketName}" exists...`);
        const exists = await client.bucketExists(bucketName);

        if (exists) {
            console.log(`   ✓ Bucket "${bucketName}" exists!`);

            console.log('');
            console.log('3. Testing file upload...');
            const testContent = Buffer.from('Test file content - ' + new Date().toISOString());
            const testFile = 'test/connection-test.txt';

            await client.putObject(bucketName, testFile, testContent);
            console.log('   ✓ File uploaded successfully!');

            console.log('');
            console.log('4. Testing file read...');
            const stat = await client.statObject(bucketName, testFile);
            console.log('   ✓ File read successfully!');
            console.log('   File size:', stat.size, 'bytes');

            console.log('');
            console.log('5. Cleaning up test file...');
            await client.removeObject(bucketName, testFile);
            console.log('   ✓ Test file deleted!');

            console.log('');
            console.log('=== ALL TESTS PASSED ===');
            console.log('MinIO is working correctly!');
        } else {
            console.log(`   ✗ Bucket "${bucketName}" does NOT exist!`);
            console.log('');
            console.log('Creating bucket...');

            try {
                await client.makeBucket(bucketName, 'us-east-1');
                console.log(`   ✓ Bucket "${bucketName}" created successfully!`);
            } catch (createError: any) {
                console.log('   ✗ Failed to create bucket:', createError.message);
            }
        }

    } catch (error: any) {
        console.log('');
        console.log('=== TEST FAILED ===');
        console.log('Error:', error.message);
        console.log('');
        console.log('Full error:', error);
        console.log('');
        console.log('Possible causes:');
        console.log('  1. MinIO server is not running or unreachable');
        console.log('  2. Wrong endpoint/port configuration');
        console.log('  3. Invalid credentials (access key / secret key)');
        console.log('  4. SSL certificate issues');
        console.log('');
        console.log('Try these solutions:');
        console.log('  - Check if MinIO server is running');
        console.log('  - Verify credentials in .env file');
        console.log('  - Try with useSSL=false if using self-signed cert');
    }
}

testConnection();
