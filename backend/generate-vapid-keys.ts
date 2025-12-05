// Script to generate VAPID keys for web push notifications
// Run with: npx tsx generate-vapid-keys.ts

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('='.repeat(60));
console.log('VAPID Keys Generated Successfully!');
console.log('='.repeat(60));
console.log('');
console.log('Add these to your .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@jtsc.io.vn`);
console.log('');
console.log('='.repeat(60));
console.log('');
console.log('Public Key (for frontend):');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key (keep secret!):');
console.log(vapidKeys.privateKey);
console.log('');
