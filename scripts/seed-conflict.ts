import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/lib/db";

async function main() {
    const projectId = "cmjnk0yyc0000nrk2j58zkiok"; // From user's URL

    console.log(`Seeding conflict for project: ${projectId}`);

    // 1. Find a suitable work
    const work = await db.projectWork.findFirst({
        where: {
            projectId,
            // preferably pending or already screening, but not yet finalized
        },
    });

    if (!work) {
        console.error("No works found in project.");
        return;
    }

    console.log(`Found work: ${work.id} (${work.status})`);

    // 2. Create Conflict Record
    const conflict = await db.conflict.create({
        data: {
            projectId,
            projectWorkId: work.id,
            phase: "TITLE_ABSTRACT",
            status: "PENDING",
            decisions: [
                {
                    reviewerId: "user1",
                    reviewerName: "Dr. Smith",
                    decision: "INCLUDE",
                    reasoning: "Relevant to topic.",
                },
                {
                    reviewerId: "user2",
                    reviewerName: "Prof. Jones",
                    decision: "EXCLUDE",
                    reasoning: "Wrong population.",
                },
            ],
        },
    });

    // 3. Update ProjectWork status
    await db.projectWork.update({
        where: { id: work.id },
        data: {
            status: "CONFLICT",
            phase: "TITLE_ABSTRACT", // Ensure phase aligns
        },
    });

    console.log("Conflict seeded successfully!");
    console.log("Refresh the Screening Queue page to see the 'Resolve Now' button.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
