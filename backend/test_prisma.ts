import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully.');

        console.log('Checking User table...');
        const count = await prisma.user.count();
        console.log(`Found ${count} users.`);

        const users = await prisma.user.findMany();
        console.log('Users:', users);

    } catch (e) {
        console.error('Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
