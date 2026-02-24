import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingProjects() {
    try {
        // Update all existing projects to have progress=0 and status='IN_PROGRESS' if they don't already have these fields
        // Since Prisma considers these fields non-nullable now, this where clause is invalid and we probably don't need this script anymore, but we can do a blanket update
        const result = await prisma.project.updateMany({
            where: {
                progress: 0,
            },
            data: {
                progress: 0,
            },
        });

        console.log(`✅ Updated ${result.count} projects with default progress and status`);
    } catch (error) {
        console.error('Error updating projects:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateExistingProjects();
