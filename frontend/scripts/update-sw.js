import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swPath = path.resolve(__dirname, '../public/custom-sw.js');

try {
    let content = fs.readFileSync(swPath, 'utf8');

    // Update Version
    const versionRegex = /\/\/ Version: (\d+\.\d+\.\d+)/;
    const versionMatch = content.match(versionRegex);

    let newVersion = '1.0.0';
    if (versionMatch) {
        const parts = versionMatch[1].split('.').map(Number);
        parts[2]++; // Patch bump
        newVersion = parts.join('.');
        content = content.replace(versionRegex, `// Version: ${newVersion}`);
    } else {
        // If no version comment found, add it
        content = `// Version: ${newVersion}\n` + content;
    }

    // Update Cache Name with timestamp to force update
    const timestamp = Date.now();
    const cacheNameRegex = /const CACHE_NAME = ['"]pwa-cache-[^'"]*['"];/;

    if (cacheNameRegex.test(content)) {
        content = content.replace(cacheNameRegex, `const CACHE_NAME = 'pwa-cache-${timestamp}';`);
    } else {
        // Fallback if regex fails (e.g. if I read the file content slightly wrongly or it changed)
        console.warn('Could not find CACHE_NAME definition to update.');
    }

    fs.writeFileSync(swPath, content);
    console.log(`Updated Service Worker to version ${newVersion} and cache name pwa-cache-${timestamp}`);

} catch (err) {
    console.error('Error updating Service Worker:', err);
    process.exit(1);
}
