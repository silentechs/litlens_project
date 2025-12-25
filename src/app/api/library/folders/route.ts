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
} from "@/lib/api";
import { z } from "zod";

const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#3B82F6"),
  icon: z.string().max(50).optional().default("folder"),
  parentId: z.string().cuid().optional().nullable(),
});

// GET /api/library/folders - Get user's folders
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get("parentId");
    const flat = searchParams.get("flat") === "true";

    if (flat) {
      // Return flat list of all folders
      const folders = await db.libraryFolder.findMany({
        where: { userId: session.user.id },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { items: true, subFolders: true } },
        },
      });

      return success(
        folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          icon: f.icon,
          parentId: f.parentId,
          itemCount: f._count.items,
          subFolderCount: f._count.subFolders,
          createdAt: f.createdAt.toISOString(),
        }))
      );
    }

    // Return hierarchical structure
    const where: Record<string, unknown> = { userId: session.user.id };
    if (parentId === "null" || !parentId) {
      where.parentId = null;
    } else {
      where.parentId = parentId;
    }

    const folders = await db.libraryFolder.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { items: true, subFolders: true } },
        subFolders: {
          include: {
            _count: { select: { items: true, subFolders: true } },
          },
        },
      },
    });

    return success(
      folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        icon: f.icon,
        parentId: f.parentId,
        itemCount: f._count.items,
        subFolderCount: f._count.subFolders,
        subFolders: f.subFolders.map((sf) => ({
          id: sf.id,
          name: sf.name,
          color: sf.color,
          icon: sf.icon,
          itemCount: sf._count.items,
          subFolderCount: sf._count.subFolders,
        })),
        createdAt: f.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/library/folders - Create folder
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const { name, color, icon, parentId } = createFolderSchema.parse(body);

    // Check if parent exists if provided
    if (parentId) {
      const parent = await db.libraryFolder.findFirst({
        where: { id: parentId, userId: session.user.id },
      });
      if (!parent) {
        throw new NotFoundError("Parent folder");
      }
    }

    // Check for duplicate name at same level
    const existing = await db.libraryFolder.findFirst({
      where: {
        userId: session.user.id,
        name,
        parentId: parentId || null,
      },
    });

    if (existing) {
      throw new ConflictError("A folder with this name already exists at this level");
    }

    const folder = await db.libraryFolder.create({
      data: {
        userId: session.user.id,
        name,
        color,
        icon,
        parentId: parentId || null,
      },
      include: {
        _count: { select: { items: true, subFolders: true } },
      },
    });

    return created({
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
