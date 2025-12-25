import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  success, 
  created, 
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { 
  addToLibrarySchema, 
  libraryFiltersSchema, 
  paginationSchema 
} from "@/lib/validators";
import { Prisma } from "@prisma/client";

// Build orderBy for library items - handles related Work fields
function buildLibraryOrderBy(
  sortBy: string | undefined,
  sortOrder: "asc" | "desc" = "desc"
): Prisma.LibraryItemOrderByWithRelationInput {
  const order = sortOrder;
  
  switch (sortBy) {
    case "title":
      return { work: { title: order } };
    case "year":
      return { work: { year: order } };
    case "rating":
      return { rating: { sort: order, nulls: "last" } };
    case "lastAccessed":
      return { lastAccessedAt: { sort: order, nulls: "last" } };
    case "addedAt":
    default:
      return { createdAt: order };
  }
}

// GET /api/library - Get user's library items
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Parse params
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sortBy: searchParams.get("sortBy") || "addedAt",
      sortOrder: searchParams.get("sortOrder"),
    });

    const filters = libraryFiltersSchema.parse({
      folderId: searchParams.get("folderId"),
      search: searchParams.get("search"),
      tags: searchParams.getAll("tags"),
      readingStatus: searchParams.get("readingStatus"),
      rating: searchParams.get("rating") ? parseInt(searchParams.get("rating")!) : undefined,
    });

    // Build where clause
    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    // Folder filter
    if (filters.folderId === "null") {
      where.folderId = null; // Root level
    } else if (filters.folderId) {
      where.folderId = filters.folderId;
    }

    // Other filters
    if (filters.readingStatus) {
      where.readingStatus = filters.readingStatus;
    }

    if (filters.rating) {
      where.rating = filters.rating;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasEvery: filters.tags };
    }

    // Search
    if (filters.search) {
      where.work = {
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { abstract: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }

    // Get total count
    const total = await db.libraryItem.count({ where });

    // Get items
    const items = await db.libraryItem.findMany({
      where,
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy: buildLibraryOrderBy(pagination.sortBy, pagination.sortOrder),
      include: {
        work: {
          select: {
            id: true,
            title: true,
            authors: true,
            abstract: true,
            year: true,
            journal: true,
            doi: true,
            url: true,
            citationCount: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Transform response
    const libraryItems = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      workId: item.workId,
      folderId: item.folderId,
      tags: item.tags,
      notes: item.notes,
      rating: item.rating,
      readingStatus: item.readingStatus,
      highlightColor: item.highlightColor,
      aiSummary: item.aiSummary,
      lastAccessedAt: item.lastAccessedAt?.toISOString() || null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      work: {
        ...item.work,
        authors: item.work.authors as Array<{ name: string }>,
      },
      folder: item.folder,
    }));

    return paginated(libraryItems, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/library - Add work to library
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = addToLibrarySchema.parse(body);

    // Check if work exists
    const work = await db.work.findUnique({
      where: { id: data.workId },
    });

    if (!work) {
      throw new NotFoundError("Work");
    }

    // Check if already in library
    const existing = await db.libraryItem.findUnique({
      where: {
        userId_workId: {
          userId: session.user.id,
          workId: data.workId,
        },
      },
    });

    if (existing) {
      throw new ConflictError("This work is already in your library");
    }

    // Verify folder belongs to user if provided
    if (data.folderId) {
      const folder = await db.libraryFolder.findFirst({
        where: {
          id: data.folderId,
          userId: session.user.id,
        },
      });

      if (!folder) {
        throw new NotFoundError("Folder");
      }
    }

    // Create library item
    const item = await db.libraryItem.create({
      data: {
        userId: session.user.id,
        workId: data.workId,
        folderId: data.folderId,
        tags: data.tags || [],
        notes: data.notes,
        rating: data.rating,
        readingStatus: data.readingStatus || "TO_READ",
      },
      include: {
        work: {
          select: {
            id: true,
            title: true,
            authors: true,
            year: true,
            journal: true,
          },
        },
        folder: true,
      },
    });

    return created({
      ...item,
      work: {
        ...item.work,
        authors: item.work.authors as Array<{ name: string }>,
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

