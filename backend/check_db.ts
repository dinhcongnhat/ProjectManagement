import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking User table...');
        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        console.log('Checking Project table...');
        // @ts-ignore
        if (prisma.project) {
            // @ts-ignore
            const projectCount = await prisma.project.count();
            console.log(`Project count: ${projectCount}`);
        } else {
            console.log('Project model not found on prisma client instance.');
        }

    } catch (e) {
        console.error('Error checking DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
