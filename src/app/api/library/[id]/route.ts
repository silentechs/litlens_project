import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success, 
  noContent,
} from "@/lib/api";
import { updateLibraryItemSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/library/[id] - Get a single library item
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    const item = await db.libraryItem.findUnique({
      where: { id },
      include: {
        work: true,
        folder: true,
      },
    });

    if (!item) {
      throw new NotFoundError("Library item");
    }

    if (item.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    // Update last accessed
    await db.libraryItem.update({
      where: { id },
      data: { lastAccessedAt: new Date() },
    });

    return success({
      ...item,
      work: {
        ...item.work,
        authors: item.work.authors as Array<{ name: string }>,
      },
      lastAccessedAt: new Date().toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/library/[id] - Update a library item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    // Check ownership
    const existing = await db.libraryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Library item");
    }

    if (existing.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const data = updateLibraryItemSchema.parse(body);

    // Verify folder if changing
    if (data.folderId && data.folderId !== existing.folderId) {
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

    const item = await db.libraryItem.update({
      where: { id },
      data: {
        folderId: data.folderId,
        tags: data.tags,
        notes: data.notes,
        rating: data.rating,
        readingStatus: data.readingStatus,
        highlightColor: data.highlightColor,
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

    return success({
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

// DELETE /api/library/[id] - Remove from library
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    // Check ownership
    const existing = await db.libraryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Library item");
    }

    if (existing.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    await db.libraryItem.delete({
      where: { id },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

