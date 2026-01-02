import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  handleApiError,
  UnauthorizedError,
  success,
} from "@/lib/api";
import { semanticSearchSchema } from "@/lib/validators";
import type { WorkSearchResult } from "@/types/work";

/**
 * GET /api/search/semantic
 * Simplified search using Database LIKE queries (Optimization)
 * 
 * Replaces the previous CPU-intensive in-memory "semantic" fallback.
 * Uses Prisma's `contains` filter to search within the scoped works.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;

    const params = semanticSearchSchema.parse({
      query: searchParams.get("query"),
      projectId: searchParams.get("projectId") || undefined,
      limit: searchParams.get("limit") || undefined,
      threshold: searchParams.get("threshold") || undefined, // Ignored in this version
    });

    const { query, projectId, limit = 20 } = params;

    // 1. Scope the search (Project or User Library)
    let workIds: string[] = [];

    if (projectId) {
      const projectWorks = await db.projectWork.findMany({
        where: {
          projectId,
          status: "INCLUDED",
        },
        select: { workId: true },
      });
      workIds = projectWorks.map((pw) => pw.workId);
    } else {
      const libraryItems = await db.libraryItem.findMany({
        where: { userId: session.user.id },
        select: { workId: true },
      });
      workIds = libraryItems.map((li) => li.workId);
    }

    if (workIds.length === 0) {
      return success({
        items: [],
        total: 0,
        sources: ["database"],
        message: projectId
          ? "No included studies in this project to search"
          : "Your library is empty. Add papers to enable search.",
      });
    }

    // 2. Perform Database Search
    // Optimized: Pushes filtering to the database instead of Node.js
    const works = await db.work.findMany({
      where: {
        id: { in: workIds },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { abstract: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: {
        year: "desc", // Default sort by recent
      },
    });

    // 3. Map to Result Format
    const results: WorkSearchResult[] = works.map((work) => ({
      id: work.id,
      title: work.title,
      authors: work.authors.map((a) => ({
        name: a.name,
        orcid: a.orcid || undefined,
      })),
      abstract: work.abstract,
      year: work.year,
      journal: work.journal,
      doi: work.doi,
      pmid: work.pmid,
      url: work.url,
      citationCount: work.citationCount || 0,
      source: "semantic", // Keeping identifier for frontend compatibility
      relevanceScore: 1.0, // specialized score not available in simple DB search
    }));

    return success({
      items: results,
      total: results.length,
      sources: ["database"],
      searchMode: "database-text",
      note: "Using optimized database text search.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
