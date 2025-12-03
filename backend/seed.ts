import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'dinhcongnhat';
    const password = 'Congnhat2002';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { username },
        update: {
            password: hashedPassword,
            role: 'ADMIN',
        },
        create: {
            username,
            password: hashedPassword,
            name: 'Dinh Cong Nhat',
            role: 'ADMIN',
        },
    });

    console.log({ user });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
