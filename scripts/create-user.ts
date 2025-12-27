
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { hash } from "bcryptjs";

dotenv.config();

async function main() {
    const { db } = await import("../src/lib/db");

    const email = "admin@victory.edu.gh";
    const password = "password123";
    const name = "Admin User";
    const projectId = "cmjnmac4x0001u3k2dg0rmm9l";

    console.log(`Creating/Updating user: ${email}`);

    const hashedPassword = await hash(password, 12);

    const user = await db.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
        },
        create: {
            email,
            name,
            password: hashedPassword,
            role: "ADMIN",
        },
    });

    console.log(`✅ User upserted: ${user.id}`);

    // Add to project
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (project) {
        await db.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id
                }
            },
            update: {
                role: "LEAD"
            },
            create: {
                projectId,
                userId: user.id,
                role: "LEAD" // LEAD permissions to resolve conflicts
            }
        });
        console.log(`✅ User added to project as LEAD`);
    } else {
        console.error("❌ Project not found, could not add member.");
    }
}

main().catch(console.error);
