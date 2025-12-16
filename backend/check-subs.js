import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const subs = await prisma.pushSubscription.findMany({
        select: {
            id: true,
            userId: true,
            endpoint: true,
            createdAt: true,
            user: { select: { name: true, username: true } }
        }
    });
    console.log('=== PUSH SUBSCRIPTIONS ===');
    console.log(`Total: ${subs.length}`);
    subs.forEach(s => {
        console.log(`ID: ${s.id} | User: ${s.user.name} (${s.user.username}) | Endpoint: ${s.endpoint.substring(0, 50)}...`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
