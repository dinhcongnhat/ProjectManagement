/**
 * Script to generate PWA icons from source image
 * Run: node scripts/generate-icons.js
 * 
 * Note: This script requires 'sharp' package
 * Install: npm install sharp --save-dev
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceImage = path.join(__dirname, '../public/icons/icon.png');
const outputDir = path.join(__dirname, '../public/icons');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('Generating PWA icons from:', sourceImage);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    try {
      await sharp(sourceImage)
        .resize({ width: size }) // Maintain aspect ratio
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Error generating ${size}x${size}:`, error.message);
    }
  }

  // Auto-update version.json to trigger PWA update flow
  // This ensures that installed PWAs will detect the icon change
  const versionPath = path.join(__dirname, '../public/version.json');
  try {
    const now = new Date();
    const hash = Date.now().toString(36);
    const versionData = {
      version: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}.${hash}`,
      buildTime: now.toISOString(),
      iconUpdated: true
    };
    fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
    console.log(`\n✓ Updated version.json to trigger PWA icon update`);
    console.log(`  New version: ${versionData.version}`);
  } catch (error) {
    console.error('✗ Could not update version.json:', error.message);
  }

  console.log('\nDone! Icons saved to:', outputDir);
  console.log('\n📱 PWA Icon Update Notes:');
  console.log('  • Android/Chrome: Icon updates on next app visit after SW update');
  console.log('  • iOS: Users must remove & re-add the PWA to home screen');
  console.log('  • Deploy the changes and the UpdateChecker will handle the rest');
}

generateIcons().catch(console.error);
