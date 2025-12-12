
const fs = require('fs');

const BASE_URL = 'http://localhost:3001'; // Backend URL

async function testBackendEndpoints() {
    console.log('Testing backend endpoints with fetch...');

    try {
        // 1. Health check
        console.log('1. Checking health...');
        const healthRes = await fetch(`${BASE_URL}/health`);
        console.log('Health Status:', healthRes.status);
        const healthData = await healthRes.json();
        console.log('Health Data:', healthData);

        // 2. Attempt login
        console.log('2. Attempting login...');
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@jtsc.io.vn',
                password: 'admin'
            })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed with status ${loginRes.status}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        const userId = loginData.user.id;
        console.log('Login successful. User ID:', userId);

        // 3. Check User Avatar Endpoint
        console.log(`3. Testing User Avatar Endpoint for User ${userId}...`);
        const avatarRes = await fetch(`${BASE_URL}/api/users/${userId}/avatar`);
        console.log('Avatar Status:', avatarRes.status);
        console.log('Avatar Content-Type:', avatarRes.headers.get('content-type'));

        if (avatarRes.status === 200 && avatarRes.headers.get('content-type').includes('image')) {
            console.log('✅ User Avatar is streaming correctly!');
        } else if (avatarRes.status === 404) {
            console.log('⚠️ Avatar not found, but endpoint reached (404).');
        } else {
            console.log('❌ Avatar check failed:', avatarRes.status);
        }

        // 4. Check Chat Attachment Endpoint
        console.log('4. Testing Chat Attachment Endpoint (Non-existent message)...');
        const chatRes = await fetch(`${BASE_URL}/api/chat/messages/99999/file`);
        console.log('Chat Attachment Status:', chatRes.status);
        if (chatRes.status === 404) {
            console.log('✅ Chat Attachment endpoint returns 404 for missing file.');
        } else {
            console.log('❌ Chat Attachment endpoint unexpected status:', chatRes.status);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testBackendEndpoints();
