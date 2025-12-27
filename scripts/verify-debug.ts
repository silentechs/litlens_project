
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

// Use dynamic import for db if needed, or just new Client to be safe/simple
// But stick to the pattern that worked: dynamic import
async function main() {
    const { db } = await import("../src/lib/db");

    const email = "admin@victory.edu.gh";
    const projectId = "cmjnmac4x0001u3k2dg0rmm9l";

    console.log(`Checking DB for user: ${email} and project: ${projectId}`);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
        console.error("❌ User NOT found!");
    } else {
        console.log(`✅ User found: ${user.id} (${user.name})`);
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
        console.error("❌ Project NOT found!");
    } else {
        console.log(`✅ Project found: ${project.title}`);
    }

    if (project) {
        const members = await db.projectMember.findMany({
            where: { projectId }
        });
        console.log(`Found ${members.length} members for project.`);
        members.forEach(m => console.log(`- Member: ${m.userId} (${m.role})`));

        if (members.length > 0) {
            const ownerId = members[0].userId;
            const owner = await db.user.findUnique({ where: { id: ownerId } });
            console.log(`\nOwner Details (${ownerId}):`);
            console.log(`- Email: ${owner?.email}`);
            console.log(`- Name: ${owner?.name}`);
        }

    }

}

main().catch(console.error);
