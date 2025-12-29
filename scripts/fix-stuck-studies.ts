import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Fix script: Promote studies stuck in TITLE_ABSTRACT with INCLUDED status to FULL_TEXT phase
 * 
 * This is a one-time migration to fix studies that were included before the phase promotion
 * logic was added to the decision route.
 */
async function main() {
    console.log("Finding studies stuck in TITLE_ABSTRACT with INCLUDED status...");

    // Find all ProjectWork that have:
    // - status = INCLUDED
    // - phase = TITLE_ABSTRACT
    // These should be promoted to FULL_TEXT with PENDING status
    const stuckStudies = await db.projectWork.findMany({
        where: {
            status: "INCLUDED",
            phase: "TITLE_ABSTRACT",
        },
        select: {
            id: true,
            projectId: true,
            status: true,
            phase: true,
        },
    });

    console.log(`Found ${stuckStudies.length} stuck studies.`);

    if (stuckStudies.length === 0) {
        console.log("No stuck studies found. Exiting.");
        return;
    }

    // Promote each study to FULL_TEXT phase with PENDING status
    console.log("Promoting studies to FULL_TEXT phase...");

    const result = await db.projectWork.updateMany({
        where: {
            status: "INCLUDED",
            phase: "TITLE_ABSTRACT",
        },
        data: {
            phase: "FULL_TEXT",
            status: "PENDING",
            finalDecision: null, // Clear final decision since they need to be screened in the new phase
        },
    });

    console.log(`Successfully promoted ${result.count} studies to FULL_TEXT phase.`);
    console.log("\nStudies are now ready for Full Text screening!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
