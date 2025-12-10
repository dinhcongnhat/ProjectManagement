// Test MinIO Connection with backup server
// Run with: npx tsx src/test-minio-backup.ts

import * as Minio from 'minio';

// Test with the fallback MinIO server
const configs = [
    {
        name: 'apiminio.jtsc.io.vn (from .env)',
        endPoint: 'apiminio.jtsc.io.vn',
        port: 443,
        useSSL: true,
        accessKey: 'jtsc',
        secretKey: 'jtsc12345',
    },
    {
        name: 'apiminiojtsc.duckdns.org (fallback)',
        endPoint: 'apiminiojtsc.duckdns.org',
        port: 443,
        useSSL: true,
        accessKey: 'jtsc',
        secretKey: 'jtsc12345',
    },
    {
        name: 'apiminiojtsc.duckdns.org (no SSL)',
        endPoint: 'apiminiojtsc.duckdns.org',
        port: 80,
        useSSL: false,
        accessKey: 'jtsc',
        secretKey: 'jtsc12345',
    },
];

const bucketName = 'projectmanagement';

async function testConfig(config: typeof configs[0]) {
    console.log(`\nTesting: ${config.name}`);
    console.log(`  Endpoint: ${config.endPoint}:${config.port} (SSL: ${config.useSSL})`);

    const client = new Minio.Client({
        endPoint: config.endPoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
    });

    try {
        const buckets = await client.listBuckets();
        console.log(`  ✓ SUCCESS! Buckets: ${buckets.map(b => b.name).join(', ') || '(none)'}`);

        const exists = await client.bucketExists(bucketName);
        console.log(`  Bucket "${bucketName}" exists: ${exists}`);

        return true;
    } catch (error: any) {
        console.log(`  ✗ FAILED: ${error.message || 'Unknown error'}`);
        return false;
    }
}

async function runTests() {
    console.log('=== MinIO Server Test ===');

    let workingConfig = null;

    for (const config of configs) {
        const success = await testConfig(config);
        if (success && !workingConfig) {
            workingConfig = config;
        }
    }

    console.log('\n=== Summary ===');
    if (workingConfig) {
        console.log(`\n✓ Working configuration found: ${workingConfig.name}`);
        console.log('\nUpdate your .env file with:');
        console.log(`  MINIO_ENDPOINT=${workingConfig.endPoint}`);
        console.log(`  MINIO_PORT=${workingConfig.port}`);
        console.log(`  MINIO_USE_SSL=${workingConfig.useSSL}`);
        console.log(`  MINIO_ACCESS_KEY=${workingConfig.accessKey}`);
        console.log(`  MINIO_SECRET_KEY=${workingConfig.secretKey}`);
    } else {
        console.log('\n✗ No working MinIO configuration found!');
        console.log('\nPossible issues:');
        console.log('  - All MinIO servers are down');
        console.log('  - Credentials are wrong');
        console.log('  - Network/firewall blocking access');
    }
}

runTests();
