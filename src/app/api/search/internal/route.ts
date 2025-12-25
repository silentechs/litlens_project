import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  handleApiError,
  UnauthorizedError,
  success,
  buildSearchFilter,
} from "@/lib/api";
import { internalSearchSchema } from "@/lib/validators";
import type { WorkSearchResult } from "@/types/work";

/**
 * GET /api/search/internal
 * Search user's library items and project works
 * 
 * Searches across:
 * - User's personal library
 * - Projects the user is a member of
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;

    const params = internalSearchSchema.parse({
      query: searchParams.get("query"),
      projectId: searchParams.get("projectId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      filters: {
        status: searchParams.get("status") || undefined,
        phase: searchParams.get("phase") || undefined,
        yearFrom: searchParams.get("yearFrom") || undefined,
        yearTo: searchParams.get("yearTo") || undefined,
      },
    });

    const { query, projectId, page, limit, filters } = params;
    const skip = (page - 1) * limit;

    // Build work search conditions
    const workSearchConditions = buildSearchFilter(query, [
      "title",
      "abstract",
    ]);

    // Also search by author name (requires different approach)
    const authorSearchCondition = {
      authors: {
        some: {
          name: { contains: query, mode: "insensitive" as const },
        },
      },
    };

    // Year filter
    const yearFilter: Record<string, unknown> = {};
    if (filters?.yearFrom) {
      yearFilter.year = { ...yearFilter.year as object, gte: filters.yearFrom };
    }
    if (filters?.yearTo) {
      yearFilter.year = { ...yearFilter.year as object, lte: filters.yearTo };
    }

    const results: WorkSearchResult[] = [];

    // Search library items
    const libraryItems = await db.libraryItem.findMany({
      where: {
        userId: session.user.id,
        work: {
          OR: [
            workSearchConditions || {},
            authorSearchCondition,
          ],
          ...yearFilter,
        },
      },
      include: {
        work: true,
      },
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
    });

    // Transform library items to search results
    for (const item of libraryItems) {
      results.push({
        id: item.work.id,
        title: item.work.title,
        authors: (item.work.authors as { name: string; orcid?: string }[]).map((a) => ({
          name: a.name,
          orcid: a.orcid || undefined,
        })),
        abstract: item.work.abstract,
        year: item.work.year,
        journal: item.work.journal,
        doi: item.work.doi,
        pmid: item.work.pmid,
        url: item.work.url,
        citationCount: item.work.citationCount || 0,
        source: "library" as const,
        relevanceScore: 0.9, // Library items get high relevance
        metadata: {
          libraryItemId: item.id,
          addedAt: item.createdAt.toISOString(),
          tags: item.tags,
          notes: item.notes,
        },
      });
    }

    // Search project works if projectId provided or search all user's projects
    const projectCondition = projectId
      ? { id: projectId }
      : { members: { some: { userId: session.user.id } } };

    // Build project work status/phase filters
    const projectWorkFilters: Record<string, unknown> = {};
    if (filters?.status) {
      projectWorkFilters.screeningStatus = filters.status;
    }
    if (filters?.phase) {
      projectWorkFilters.screeningPhase = filters.phase;
    }

    const projectWorks = await db.projectWork.findMany({
      where: {
        project: projectCondition,
        work: {
          OR: [
            workSearchConditions || {},
            authorSearchCondition,
          ],
          ...yearFilter,
        },
        ...projectWorkFilters,
      },
      include: {
        work: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
    });

    // Transform project works to search results (avoid duplicates)
    const seenWorkIds = new Set(results.map((r) => r.id));

    for (const pw of projectWorks) {
      if (seenWorkIds.has(pw.work.id)) continue;
      seenWorkIds.add(pw.work.id);

      results.push({
        id: pw.work.id,
        title: pw.work.title,
        authors: (pw.work.authors as { name: string; orcid?: string }[]).map((a) => ({
          name: a.name,
          orcid: a.orcid || undefined,
        })),
        abstract: pw.work.abstract,
        year: pw.work.year,
        journal: pw.work.journal,
        doi: pw.work.doi,
        pmid: pw.work.pmid,
        url: pw.work.url,
        citationCount: pw.work.citationCount || 0,
        source: "internal" as const,
        relevanceScore: 0.85,
        metadata: {
          projectWorkId: pw.id,
          projectId: pw.project.id,
          projectName: pw.project.name,
          screeningStatus: pw.screeningStatus,
          screeningPhase: pw.screeningPhase,
        },
      });
    }

    // Get total counts for pagination
    const [libraryCount, projectCount] = await Promise.all([
      db.libraryItem.count({
        where: {
          userId: session.user.id,
          work: {
            OR: [
              workSearchConditions || {},
              authorSearchCondition,
            ],
            ...yearFilter,
          },
        },
      }),
      db.projectWork.count({
        where: {
          project: projectCondition,
          work: {
            OR: [
              workSearchConditions || {},
              authorSearchCondition,
            ],
            ...yearFilter,
          },
          ...projectWorkFilters,
        },
      }),
    ]);

    const total = libraryCount + projectCount;

    return success({
      items: results,
      total,
      sources: ["library", "projects"],
      breakdown: {
        library: libraryCount,
        projects: projectCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

