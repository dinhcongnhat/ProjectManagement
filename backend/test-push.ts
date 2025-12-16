import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

const prisma = new PrismaClient();

// Load environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLBz5Qk7T7kxNfBJtJjNgFZ2PF4TnvPQKzXoKyKGXZ7qfKmJmKvDqnTpHG9xKhZBqfZ3JkqQr7K8kJvN5xKmKfE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'your-private-key-here';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@jtsc.io.vn';

console.log('=== PUSH NOTIFICATION TEST ===');
console.log('VAPID_PUBLIC_KEY:', VAPID_PUBLIC_KEY ? VAPID_PUBLIC_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('VAPID_PRIVATE_KEY:', VAPID_PRIVATE_KEY !== 'your-private-key-here' ? 'SET' : 'NOT SET');
console.log('');

async function main() {
    if (VAPID_PRIVATE_KEY === 'your-private-key-here') {
        console.error('❌ VAPID_PRIVATE_KEY không được cấu hình trong .env!');
        console.log('');
        console.log('Để sửa, hãy:');
        console.log('1. Tạo VAPID keys: npx web-push generate-vapid-keys');
        console.log('2. Thêm vào .env:');
        console.log('   VAPID_PUBLIC_KEY=...');
        console.log('   VAPID_PRIVATE_KEY=...');
        return;
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('✅ VAPID configured');
    console.log('');

    // Get subscriptions
    const subs = await prisma.pushSubscription.findMany({
        include: { user: { select: { name: true, username: true } } }
    });

    console.log(`Found ${subs.length} subscription(s)`);
    console.log('');

    if (subs.length === 0) {
        console.log('❌ Không có subscription nào! User cần đăng ký push notification trong Settings.');
        return;
    }

    // Test send to first subscription
    const sub = subs[0];
    console.log(`Testing push to: ${sub.user.name} (${sub.user.username})`);
    console.log(`Endpoint: ${sub.endpoint.substring(0, 50)}...`);
    console.log('');

    try {
        const payload = JSON.stringify({
            title: 'Test Push Notification',
            body: 'Nếu bạn thấy thông báo này, push notification đang hoạt động!',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'test-' + Date.now(),
            data: { type: 'project', url: '/' }
        });

        const result = await webpush.sendNotification(
            {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            },
            payload
        );

        console.log('✅ Push sent successfully!');
        console.log('Status:', result.statusCode);
    } catch (error: any) {
        console.error('❌ Push failed:', error.message);
        if (error.statusCode === 410) {
            console.log('Subscription has expired. User needs to re-subscribe.');
        } else if (error.statusCode === 401) {
            console.log('VAPID keys are incorrect.');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
