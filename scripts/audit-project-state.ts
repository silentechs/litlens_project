/**
 * Project State Audit (DB verification)
 *
 * Prints a high-signal snapshot of screening + conflicts + ingestion state for a given project.
 *
 * Usage:
 *   npx tsx scripts/audit-project-state.ts <projectId>
 */

import "dotenv/config";

import { db } from "@/lib/db";

type Phase = "TITLE_ABSTRACT" | "FULL_TEXT" | "FINAL";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toISOString();
}

function padRight(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/audit-project-state.ts <projectId>");
    process.exit(1);
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      blindScreening: true,
      requireDualScreening: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const reviewersNeeded = project.requireDualScreening ? 2 : 1;

  const members = await db.projectMember.findMany({
    where: { projectId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const [totalWorks, byPhase, byStatus, byFinalDecision] = await Promise.all([
    db.projectWork.count({ where: { projectId } }),
    db.projectWork.groupBy({
      by: ["phase"],
      where: { projectId },
      _count: true,
    }),
    db.projectWork.groupBy({
      by: ["phase", "status"],
      where: { projectId },
      _count: true,
    }),
    db.projectWork.groupBy({
      by: ["finalDecision"],
      where: { projectId },
      _count: true,
    }),
  ]);

  const phases: Phase[] = ["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"];

  // Conflicts by phase (unresolved)
  const conflictsByPhase = await db.conflict.groupBy({
    by: ["phase", "status"],
    where: { projectId, status: { in: ["PENDING", "IN_DISCUSSION"] } },
    _count: true,
  });

  // Decision counts per projectWork per phase
  const decisionCounts = await db.screeningDecisionRecord.groupBy({
    by: ["projectWorkId", "phase"],
    where: {
      projectWork: { projectId },
    },
    _count: true,
  });

  // Quick map: `${projectWorkId}:${phase}` -> count
  const decisionCountMap = new Map<string, number>();
  for (const row of decisionCounts) {
    decisionCountMap.set(`${row.projectWorkId}:${row.phase}`, row._count);
  }

  // Next-steps-style “team completion” for each phase (single SQL query each phase)
  const completionByPhase: Record<string, { total: number; withRequired: number; awaiting: number; conflicts: number }> =
    {};

  for (const phase of phases) {
    const total = await db.projectWork.count({ where: { projectId, phase } });
    const requiredRows = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM (
        SELECT sdr."projectWorkId"
        FROM "ScreeningDecisionRecord" sdr
        JOIN "ProjectWork" pw ON pw."id" = sdr."projectWorkId"
        WHERE pw."projectId" = ${projectId}
          AND pw."phase" = ${phase}::"ScreeningPhase"
          AND sdr."phase" = ${phase}::"ScreeningPhase"
        GROUP BY sdr."projectWorkId"
        HAVING COUNT(*) >= ${reviewersNeeded}
      ) t;
    `;
    const withRequired = Number(requiredRows?.[0]?.count ?? 0);
    const awaiting = Math.max(0, total - withRequired);

    const phaseConflicts = conflictsByPhase
      .filter((c) => c.phase === phase)
      .reduce((acc, c) => acc + Number(c._count), 0);

    completionByPhase[phase] = { total, withRequired, awaiting, conflicts: phaseConflicts };
  }

  // Sample a few studies (latest updated)
  const sample = await db.projectWork.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: {
      id: true,
      workId: true,
      phase: true,
      status: true,
      finalDecision: true,
      ingestionStatus: true,
      chunksCreated: true,
      lastIngestedAt: true,
      pdfR2Key: true,
      updatedAt: true,
      work: { select: { title: true, year: true, doi: true } },
    },
  });

  // Basic integrity checks
  const conflictOrphans = await db.projectWork.count({
    where: {
      projectId,
      status: "CONFLICT",
      // A study marked as CONFLICT should have at least one unresolved conflict row.
      conflicts: { none: { status: { in: ["PENDING", "IN_DISCUSSION"] } } },
    },
  });

  const duplicateConflicts = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM (
      SELECT "projectWorkId", "phase", COUNT(*) as c
      FROM "Conflict"
      WHERE "projectId" = ${projectId}
      GROUP BY "projectWorkId", "phase"
      HAVING COUNT(*) > 1
    ) t;
  `;

  const chunkCounts = await db.$queryRaw<Array<{ total: bigint; included: bigint; worksWithChunks: bigint }>>`
    SELECT
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE pw."finalDecision" = 'INCLUDE')::bigint as included,
      COUNT(DISTINCT chunk."workId")::bigint as "worksWithChunks"
    FROM "DocumentChunk" chunk
    JOIN "Work" work ON chunk."workId" = work."id"
    JOIN "ProjectWork" pw ON work."id" = pw."workId"
    WHERE pw."projectId" = ${projectId};
  `;

  console.log("");
  console.log("=== LitLens Project State Audit (DB) ===");
  console.log(`Project: ${project.title}`);
  console.log(`ID:      ${project.id}`);
  console.log(`Status:  ${project.status}`);
  console.log(
    `Config:  blindScreening=${project.blindScreening} requireDualScreening=${project.requireDualScreening} reviewersNeeded=${reviewersNeeded}`
  );
  console.log(`Created: ${fmtDate(project.createdAt)}  Updated: ${fmtDate(project.updatedAt)}`);
  console.log("");

  console.log("Members:");
  for (const m of members) {
    const name = m.user.name ?? "(no name)";
    const email = m.user.email ?? "(no email)";
    console.log(
      `- ${padRight(name, 22)} ${padRight(email, 28)} role=${padRight(m.role, 8)} joined=${fmtDate(m.joinedAt)}`
    );
  }
  console.log("");

  console.log("ProjectWorks counts:");
  console.log(`- Total: ${totalWorks}`);
  console.log("- By phase:");
  for (const p of byPhase) {
    console.log(`  - ${p.phase}: ${p._count}`);
  }
  console.log("- By finalDecision:");
  for (const d of byFinalDecision) {
    console.log(`  - ${d.finalDecision ?? "NULL"}: ${d._count}`);
  }
  console.log("");

  console.log("Phase completion (team-level):");
  for (const phase of phases) {
    const c = completionByPhase[phase];
    console.log(
      `- ${padRight(phase, 13)} total=${padRight(String(c.total), 4)} withRequiredDecisions=${padRight(
        String(c.withRequired),
        4
      )} awaitingMoreReviews=${padRight(String(c.awaiting), 4)} unresolvedConflicts=${c.conflicts}`
    );
  }
  console.log("");

  console.log("Unresolved conflicts (by phase/status):");
  if (conflictsByPhase.length === 0) {
    console.log("- none");
  } else {
    for (const c of conflictsByPhase) {
      console.log(`- ${c.phase} ${c.status}: ${c._count}`);
    }
  }
  console.log("");

  console.log("Evidence index (DocumentChunk):");
  console.log(`- Total chunks linked to project: ${Number(chunkCounts?.[0]?.total ?? 0)}`);
  console.log(`- Chunks linked to INCLUDED studies: ${Number(chunkCounts?.[0]?.included ?? 0)}`);
  console.log(`- Distinct works with chunks: ${Number(chunkCounts?.[0]?.worksWithChunks ?? 0)}`);
  console.log("");

  console.log("Recent studies (latest updated):");
  for (const s of sample) {
    const title = s.work?.title ?? "(untitled)";
    const year = s.work?.year ? ` ${s.work.year}` : "";
    const doi = s.work?.doi ? ` doi=${s.work.doi}` : "";
    const decCount = decisionCountMap.get(`${s.id}:${s.phase}`) ?? 0;
    const hasPdf = s.pdfR2Key ? "yes" : "no";
    console.log(
      `- ${s.id} phase=${padRight(s.phase, 13)} status=${padRight(s.status, 9)} final=${
        s.finalDecision ?? "NULL"
      } decisionsInPhase=${decCount} pdf=${hasPdf} ingestion=${s.ingestionStatus ?? "NULL"} chunks=${
        s.chunksCreated ?? 0
      } lastIngested=${fmtDate(s.lastIngestedAt)} updated=${fmtDate(s.updatedAt)}`
    );
    console.log(`  title: ${title}${year}${doi}`);
  }
  console.log("");

  console.log("Integrity checks:");
  console.log(`- ProjectWork in CONFLICT status with no Conflict row: ${conflictOrphans}`);
  console.log(`- Duplicate conflicts for (projectWorkId, phase): ${Number(duplicateConflicts?.[0]?.count ?? 0)}`);
  console.log("");

  // Useful for manual cross-checking with UI
  console.log("Notes to compare with UI:");
  console.log(
    `- If you’re on TITLE_ABSTRACT screen and it shows “Studies Awaiting Review = 0”, then completionByPhase.TITLE_ABSTRACT.awaitingMoreReviews should be 0.`
  );
  console.log(
    `- If it shows “Conflicts = 0”, then unresolved conflicts above should show none for that phase.`
  );
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect().catch(() => {});
  });


