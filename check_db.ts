
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const projectId = 'cmjrzwj1b001o1mk27djoidjv'; // From screenshot

    // 1. Get Project Object
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true, id: true }
    });
    console.log('Project:', project);

    if (!project) {
        console.log('Project not found. Listing all projects:');
        const projects = await prisma.project.findMany({ select: { id: true, title: true } });
        console.log(projects);
        return;
    }

    // 2. Count by Status
    const byStatus = await prisma.projectWork.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true
    });
    console.log('Counts by Status:', byStatus);

    // 3. Count by Phase
    const byPhase = await prisma.projectWork.groupBy({
        by: ['phase'],
        where: { projectId },
        _count: true
    });
    console.log('Counts by Phase:', byPhase);

    // 4. Check Decisions for a few items
    const items = await prisma.projectWork.findMany({
        where: { projectId },
        take: 5,
        include: {
            decisions: true
        }
    });
    console.log('Sample Items:', JSON.stringify(items, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
