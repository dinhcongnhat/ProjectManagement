import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { username: true, name: true, role: true }
    });
    console.log('=== DANH SÁCH USERS ===');
    users.forEach(u => {
        console.log(`Username: ${u.username} | Tên: ${u.name} | Role: ${u.role}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
