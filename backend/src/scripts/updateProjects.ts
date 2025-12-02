import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingProjects() {
    try {
        // Update all existing projects to have progress=0 and status='IN_PROGRESS' if they don't already have these fields
        const result = await prisma.project.updateMany({
            where: {
                OR: [
                    { progress: null },
                    { status: null },
                ],
            },
            data: {
                progress: 0,
                status: 'IN_PROGRESS',
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
