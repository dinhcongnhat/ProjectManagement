import fetch from 'node-fetch';

async function checkApi() {
    try {
        console.log('Checking GET /api/projects...');
        const response = await fetch('http://localhost:3000/api/projects');
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.status === 404) {
            console.log('Route not found. Server might need restart.');
        } else if (response.status === 401 || response.status === 403) {
            console.log('Route exists (Auth required). Server is likely updated.');
        } else if (response.ok) {
            console.log('Route is working.');
        } else {
            console.log('Unexpected status.');
        }
    } catch (error) {
        console.error('Error checking API:', error);
    }
}

checkApi();
