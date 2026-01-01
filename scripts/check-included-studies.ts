import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
    const projectId = "cmjrzwj1b001o1mk27djoidjv";

    const included = await db.projectWork.findMany({
        where: {
            projectId,
            finalDecision: "INCLUDE",
        },
        select: {
            id: true,
            finalDecision: true,
            phase: true,
            status: true,
            work: { select: { title: true } },
        },
    });

    console.log(`\n=== INCLUDED STUDIES (for extraction) ===`);
    console.log(`Total INCLUDED: ${included.length}`);

    if (included.length === 0) {
        console.log("\n❌ No studies marked as INCLUDE yet!");
        console.log("\nTo fix: Go to screening and mark studies as INCLUDE");
    } else {
        console.log("\n✅ Included studies:");
        included.forEach((s, i) => {
            console.log(`${i + 1}. ${s.work.title.substring(0, 60)}...`);
            console.log(`   Status: ${s.status}, Phase: ${s.phase}, Decision: ${s.finalDecision}`);
        });
    }

    // Check all decisions
    const allDecisions = await db.projectWork.groupBy({
        by: ["finalDecision"],
        where: { projectId },
        _count: true,
    });

    console.log(`\n=== ALL DECISIONS ===`);
    allDecisions.forEach((d) => {
        console.log(`${d.finalDecision || 'PENDING'}: ${d._count}`);
    });

    process.exit(0);
}

main().catch(console.error);
