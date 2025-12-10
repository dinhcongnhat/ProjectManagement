// Test OnlyOffice JWT configuration
// Run with: npx tsx src/test-onlyoffice.ts

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          ONLYOFFICE JWT TEST                                ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Configuration:');
console.log('  OnlyOffice URL:', ONLYOFFICE_URL);
console.log('  JWT Secret:', ONLYOFFICE_JWT_SECRET ? `${ONLYOFFICE_JWT_SECRET.substring(0, 3)}***` : 'NOT SET');
console.log('');

// Test JWT token generation
const testConfig = {
    document: {
        fileType: 'docx',
        key: 'test_' + Date.now(),
        title: 'Test Document.docx',
        url: 'http://localhost:3001/api/test/file.docx',
    },
    documentType: 'word',
    editorConfig: {
        mode: 'view',
    },
};

console.log('Test config:');
console.log(JSON.stringify(testConfig, null, 2));
console.log('');

// Generate token
const token = jwt.sign(testConfig, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });
console.log('Generated JWT token:');
console.log(token.substring(0, 50) + '...');
console.log('');

// Test OnlyOffice API endpoint
async function testOnlyOffice() {
    console.log('Testing OnlyOffice endpoints...');
    console.log('');

    // Test health
    try {
        const healthResponse = await fetch(`${ONLYOFFICE_URL}/healthcheck`, {
            signal: AbortSignal.timeout(10000),
        });
        console.log(`  /healthcheck: ${healthResponse.status} ${healthResponse.statusText}`);
        if (healthResponse.ok) {
            const text = await healthResponse.text();
            console.log(`    Response: ${text}`);
        }
    } catch (error: any) {
        console.log(`  /healthcheck: FAILED - ${error.message}`);
    }

    // Test API endpoint
    try {
        const apiResponse = await fetch(`${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`, {
            signal: AbortSignal.timeout(10000),
        });
        console.log(`  /web-apps/apps/api/documents/api.js: ${apiResponse.status} ${apiResponse.statusText}`);
    } catch (error: any) {
        console.log(`  /web-apps/apps/api/documents/api.js: FAILED - ${error.message}`);
    }

    // Test info (requires JWT)
    try {
        const infoPayload = { iss: 'test' };
        const infoToken = jwt.sign(infoPayload, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });

        const infoResponse = await fetch(`${ONLYOFFICE_URL}/info/info.json`, {
            headers: {
                'Authorization': `Bearer ${infoToken}`,
            },
            signal: AbortSignal.timeout(10000),
        });
        console.log(`  /info/info.json (with JWT): ${infoResponse.status} ${infoResponse.statusText}`);
        if (infoResponse.status === 403) {
            console.log('    ⚠ JWT Secret may be incorrect!');
        }
    } catch (error: any) {
        console.log(`  /info/info.json: FAILED - ${error.message}`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('If you see 403 errors, the JWT_SECRET may be wrong.');
    console.log('Check your OnlyOffice server configuration for the correct secret.');
    console.log('');
}

testOnlyOffice();
