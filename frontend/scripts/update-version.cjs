// Script to update version.json before each build
// Usage: node scripts/update-version.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const versionPath = path.join(__dirname, '..', 'public', 'version.json');

// Generate a unique version based on timestamp + random hash
const timestamp = new Date().toISOString();
const hash = crypto.randomBytes(4).toString('hex');
const version = `${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}.${hash}`;

const versionData = {
    version,
    buildTime: timestamp
};

fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
console.log(`[update-version] Updated version.json to ${version}`);
