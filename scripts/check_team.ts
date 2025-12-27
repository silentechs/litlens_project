
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

async function main() {
    const projectId = 'cmjnk0yyc0000nrk2j58zkiok'; // ID from logs

    console.log(`Checking project: ${projectId}`);

    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { title: true }
    });

    if (!project) {
        console.log("Project not found!");
        return;
    }
    console.log(`Project Title: ${project.title}`);

    console.log("\n--- Active Members ---");
    const members = await db.projectMember.findMany({
        where: { projectId },
        include: {
            user: true
        }
    });

    if (members.length === 0) {
        console.log("No active members found.");
    } else {
        members.forEach(m => {
            console.log(`- ${m.user.name || "No Name"} (${m.user.email}) [${m.role}]`);
        });
    }

    console.log("\n--- Pending Invitations ---");
    const invitations = await db.projectInvitation.findMany({
        where: { projectId }
    });

    if (invitations.length === 0) {
        console.log("No pending invitations found.");
    } else {
        invitations.forEach(i => {
            console.log(`- ${i.email} [${i.role}] (Expires: ${i.expiresAt})`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
