// Test MinIO và OnlyOffice Connection
// Run with: npx tsx src/test-services.ts

import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// ==================== MINIO CONFIG ====================
const minioConfigs = [
    {
        name: 'apiminio.jtsc.io.vn (from .env)',
        endPoint: 'apiminio.jtsc.io.vn',
        port: 443,
        useSSL: true,
        accessKey: process.env.MINIO_ACCESS_KEY || 'jtsc',
        secretKey: process.env.MINIO_SECRET_KEY || 'jtsc12345',
    },
    {
        name: 'apiminiojtsc.duckdns.org (SSL)',
        endPoint: 'apiminiojtsc.duckdns.org',
        port: 443,
        useSSL: true,
        accessKey: 'jtsc',
        secretKey: 'jtsc12345',
    },
    {
        name: 'apiminiojtsc.duckdns.org (no SSL)',
        endPoint: 'apiminiojtsc.duckdns.org',
        port: 9000,
        useSSL: false,
        accessKey: 'jtsc',
        secretKey: 'jtsc12345',
    },
];

// ==================== ONLYOFFICE CONFIG ====================
const onlyofficeUrls = [
    'https://jtsconlyoffice.duckdns.org',
    'https://jtscoffice.duckdns.org',
];

const bucketName = process.env.MINIO_BUCKET_NAME || 'projectmanagement';

// ==================== TEST FUNCTIONS ====================

async function testMinIO(config: typeof minioConfigs[0]): Promise<boolean> {
    console.log(`\n  Testing: ${config.name}`);
    console.log(`    Endpoint: ${config.endPoint}:${config.port} (SSL: ${config.useSSL})`);

    const client = new Minio.Client({
        endPoint: config.endPoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
    });

    try {
        // Test 1: List buckets
        console.log('    Connecting...');
        const buckets = await client.listBuckets();
        console.log(`    ✓ Connected! Buckets: ${buckets.map(b => b.name).join(', ') || '(none)'}`);

        // Test 2: Check bucket exists
        const exists = await client.bucketExists(bucketName);
        if (exists) {
            console.log(`    ✓ Bucket "${bucketName}" exists!`);
        } else {
            console.log(`    ⚠ Bucket "${bucketName}" does NOT exist`);
            // Try to create
            try {
                await client.makeBucket(bucketName, 'us-east-1');
                console.log(`    ✓ Created bucket "${bucketName}"`);
            } catch (e: any) {
                console.log(`    ✗ Could not create bucket: ${e.message}`);
            }
        }

        // Test 3: Upload test file
        try {
            const testContent = Buffer.from('Test ' + Date.now());
            await client.putObject(bucketName, 'test-upload.txt', testContent);
            console.log('    ✓ Upload test passed!');
            await client.removeObject(bucketName, 'test-upload.txt');
        } catch (e: any) {
            console.log(`    ⚠ Upload test failed: ${e.message}`);
        }

        return true;
    } catch (error: any) {
        console.log(`    ✗ FAILED: ${error.message || 'Unknown error'}`);
        return false;
    }
}

async function testOnlyOffice(url: string): Promise<boolean> {
    console.log(`\n  Testing: ${url}`);

    try {
        // Test health endpoint
        const healthUrl = `${url}/healthcheck`;
        console.log(`    Checking health: ${healthUrl}`);

        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
            const text = await response.text();
            console.log(`    ✓ OnlyOffice is healthy! Response: ${text.substring(0, 100)}`);
            return true;
        } else {
            console.log(`    ⚠ Health check returned ${response.status}: ${response.statusText}`);

            // Try root URL
            const rootResponse = await fetch(url, {
                signal: AbortSignal.timeout(10000),
            });
            if (rootResponse.ok) {
                console.log(`    ✓ OnlyOffice root accessible (status ${rootResponse.status})`);
                return true;
            }
            return false;
        }
    } catch (error: any) {
        console.log(`    ✗ FAILED: ${error.message || 'Unknown error'}`);
        return false;
    }
}

// ==================== RUN TESTS ====================

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          MINIO & ONLYOFFICE SERVICE TEST                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Test MinIO
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📦 MINIO STORAGE SERVICE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let workingMinIO = null;
    for (const config of minioConfigs) {
        const success = await testMinIO(config);
        if (success && !workingMinIO) {
            workingMinIO = config;
        }
    }

    // Test OnlyOffice
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📄 ONLYOFFICE DOCUMENT SERVER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let workingOnlyOffice = null;
    for (const url of onlyofficeUrls) {
        const success = await testOnlyOffice(url);
        if (success && !workingOnlyOffice) {
            workingOnlyOffice = url;
        }
    }

    // Summary
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                       SUMMARY                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    console.log('\n📦 MINIO:');
    if (workingMinIO) {
        console.log(`   ✓ Working: ${workingMinIO.name}`);
        console.log('   Update .env with:');
        console.log(`     MINIO_ENDPOINT=${workingMinIO.endPoint}`);
        console.log(`     MINIO_PORT=${workingMinIO.port}`);
        console.log(`     MINIO_USE_SSL=${workingMinIO.useSSL}`);
    } else {
        console.log('   ✗ No working MinIO server found!');
        console.log('   → Check if MinIO server is running');
        console.log('   → Verify credentials are correct');
    }

    console.log('\n📄 ONLYOFFICE:');
    if (workingOnlyOffice) {
        console.log(`   ✓ Working: ${workingOnlyOffice}`);
        console.log('   Update .env with:');
        console.log(`     ONLYOFFICE_URL=${workingOnlyOffice}`);
    } else {
        console.log('   ✗ No working OnlyOffice server found!');
        console.log('   → Check if OnlyOffice server is running');
    }

    console.log('\n');
}

runAllTests().catch(console.error);
