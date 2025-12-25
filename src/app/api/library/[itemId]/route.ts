import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

const updateItemSchema = z.object({
  folderId: z.string().cuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  readingStatus: z.enum(["TO_READ", "READING", "READ", "ARCHIVED"]).optional(),
  highlightColor: z.string().nullable().optional(),
});

// GET /api/library/[itemId] - Get library item details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { itemId } = await params;

    const item = await db.libraryItem.findFirst({
      where: { id: itemId, userId: session.user.id },
      include: {
        work: true,
        folder: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundError("Library item");
    }

    // Update last accessed
    await db.libraryItem.update({
      where: { id: itemId },
      data: { lastAccessedAt: new Date() },
    });

    return success({
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
      aiKeyInsights: item.aiKeyInsights,
      lastAccessedAt: new Date().toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      work: {
        id: item.work.id,
        title: item.work.title,
        abstract: item.work.abstract,
        authors: item.work.authors as Array<{ name: string }>,
        year: item.work.year,
        journal: item.work.journal,
        doi: item.work.doi,
        pmid: item.work.pmid,
        url: item.work.url,
        // pdfUrl not in schema
        citationCount: item.work.citationCount,
        keywords: item.work.keywords,
      },
      folder: item.folder,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/library/[itemId] - Update library item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { itemId } = await params;

    // Verify ownership
    const existing = await db.libraryItem.findFirst({
      where: { id: itemId, userId: session.user.id },
    });

    if (!existing) {
      throw new NotFoundError("Library item");
    }

    const body = await request.json();
    const data = updateItemSchema.parse(body);

    // Verify folder if changing
    if (data.folderId) {
      const folder = await db.libraryFolder.findFirst({
        where: { id: data.folderId, userId: session.user.id },
      });
      if (!folder) {
        throw new NotFoundError("Folder");
      }
    }

    const item = await db.libraryItem.update({
      where: { id: itemId },
      data: {
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.readingStatus !== undefined && { readingStatus: data.readingStatus }),
        ...(data.highlightColor !== undefined && { highlightColor: data.highlightColor }),
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
        folder: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return success({
      id: item.id,
      workId: item.workId,
      folderId: item.folderId,
      tags: item.tags,
      notes: item.notes,
      rating: item.rating,
      readingStatus: item.readingStatus,
      highlightColor: item.highlightColor,
      work: {
        ...item.work,
        authors: item.work.authors as Array<{ name: string }>,
      },
      folder: item.folder,
      updatedAt: item.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/library/[itemId] - Remove from library
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { itemId } = await params;

    // Verify ownership
    const item = await db.libraryItem.findFirst({
      where: { id: itemId, userId: session.user.id },
    });

    if (!item) {
      throw new NotFoundError("Library item");
    }

    await db.libraryItem.delete({ where: { id: itemId } });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

