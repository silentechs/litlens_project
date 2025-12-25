import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  success,
  noContent,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ folderId: string }>;
}

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  parentId: z.string().cuid().nullable().optional(),
});

// GET /api/library/folders/[folderId] - Get folder details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { folderId } = await params;

    const folder = await db.libraryFolder.findFirst({
      where: { id: folderId, userId: session.user.id },
      include: {
        _count: { select: { items: true, subFolders: true } },
        parent: {
          select: { id: true, name: true },
        },
        subFolders: {
          include: {
            _count: { select: { items: true, subFolders: true } },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundError("Folder");
    }

    // Get breadcrumb path
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let current = folder.parent;
    while (current) {
      breadcrumbs.unshift({ id: current.id, name: current.name });
      const parent = await db.libraryFolder.findUnique({
        where: { id: current.id },
        select: { parent: { select: { id: true, name: true } } },
      });
      current = parent?.parent || null;
    }

    return success({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      parentId: folder.parentId,
      itemCount: folder._count.items,
      subFolderCount: folder._count.subFolders,
      breadcrumbs,
      subFolders: folder.subFolders.map((sf) => ({
        id: sf.id,
        name: sf.name,
        color: sf.color,
        icon: sf.icon,
        itemCount: sf._count.items,
        subFolderCount: sf._count.subFolders,
      })),
      createdAt: folder.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/library/folders/[folderId] - Update folder
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { folderId } = await params;

    // Verify ownership
    const existing = await db.libraryFolder.findFirst({
      where: { id: folderId, userId: session.user.id },
    });

    if (!existing) {
      throw new NotFoundError("Folder");
    }

    const body = await request.json();
    const { name, color, icon, parentId } = updateFolderSchema.parse(body);

    // Prevent circular reference
    if (parentId === folderId) {
      throw new ConflictError("A folder cannot be its own parent");
    }

    // Check if moving to a descendant
    if (parentId) {
      const descendants = await getDescendantIds(folderId);
      if (descendants.includes(parentId)) {
        throw new ConflictError("Cannot move folder to one of its descendants");
      }
    }

    // Check for duplicate name at target level
    if (name) {
      const targetParentId = parentId !== undefined ? parentId : existing.parentId;
      const duplicate = await db.libraryFolder.findFirst({
        where: {
          userId: session.user.id,
          name,
          parentId: targetParentId,
          id: { not: folderId },
        },
      });

      if (duplicate) {
        throw new ConflictError("A folder with this name already exists at this level");
      }
    }

    const folder = await db.libraryFolder.update({
      where: { id: folderId },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(icon && { icon }),
        ...(parentId !== undefined && { parentId }),
      },
      include: {
        _count: { select: { items: true, subFolders: true } },
      },
    });

    return success({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      parentId: folder.parentId,
      itemCount: folder._count.items,
      subFolderCount: folder._count.subFolders,
      createdAt: folder.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/library/folders/[folderId] - Delete folder
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { folderId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const moveItemsTo = searchParams.get("moveItemsTo");

    // Verify ownership
    const folder = await db.libraryFolder.findFirst({
      where: { id: folderId, userId: session.user.id },
      include: { _count: { select: { items: true, subFolders: true } } },
    });

    if (!folder) {
      throw new NotFoundError("Folder");
    }

    // Move items if requested, otherwise delete folder and items
    if (moveItemsTo) {
      // Verify target folder
      if (moveItemsTo !== "root") {
        const targetFolder = await db.libraryFolder.findFirst({
          where: { id: moveItemsTo, userId: session.user.id },
        });
        if (!targetFolder) {
          throw new NotFoundError("Target folder");
        }
      }

      // Move all items and subfolders
      await db.$transaction([
        db.libraryItem.updateMany({
          where: { folderId },
          data: { folderId: moveItemsTo === "root" ? null : moveItemsTo },
        }),
        db.libraryFolder.updateMany({
          where: { parentId: folderId },
          data: { parentId: moveItemsTo === "root" ? null : moveItemsTo },
        }),
        db.libraryFolder.delete({ where: { id: folderId } }),
      ]);
    } else {
      // Delete folder and all contents recursively
      await deleteFolderRecursive(folderId);
    }

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

// Helper to get all descendant folder IDs
async function getDescendantIds(folderId: string): Promise<string[]> {
  const children = await db.libraryFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });

  const childIds = children.map((c) => c.id);
  const grandchildIds = await Promise.all(childIds.map(getDescendantIds));

  return [...childIds, ...grandchildIds.flat()];
}

// Helper to delete folder and all contents
async function deleteFolderRecursive(folderId: string) {
  const children = await db.libraryFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });

  // Delete children first
  for (const child of children) {
    await deleteFolderRecursive(child.id);
  }

  // Delete items in this folder
  await db.libraryItem.deleteMany({ where: { folderId } });

  // Delete the folder
  await db.libraryFolder.delete({ where: { id: folderId } });
}

