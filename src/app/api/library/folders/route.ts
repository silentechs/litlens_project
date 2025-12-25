import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ConflictError,
  success, 
  created,
} from "@/lib/api";
import { createFolderSchema } from "@/lib/validators";

// GET /api/library/folders - Get user's folders
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Get all folders with item counts
    const folders = await db.libraryFolder.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: {
            items: true,
            subFolders: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Build tree structure
    const folderMap = new Map(folders.map((f) => [f.id, { ...f, children: [] as typeof folders }]));
    const rootFolders: typeof folders = [];

    folders.forEach((folder) => {
      const mapped = folderMap.get(folder.id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          (parent.children as typeof folders).push(mapped as typeof folders[0]);
        }
      } else {
        rootFolders.push(mapped as typeof folders[0]);
      }
    });

    return success(rootFolders);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/library/folders - Create a folder
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = createFolderSchema.parse(body);

    // Check for duplicate name at same level
    const parentId = data.parentId ?? null;
    const existing = await db.libraryFolder.findFirst({
      where: {
        userId: session.user.id,
        name: data.name,
        parentId,
      },
    });

    if (existing) {
      throw new ConflictError("A folder with this name already exists");
    }

    // Verify parent folder if provided
    if (data.parentId) {
      const parent = await db.libraryFolder.findFirst({
        where: {
          id: data.parentId,
          userId: session.user.id,
        },
      });

      if (!parent) {
        throw new ConflictError("Parent folder not found");
      }
    }

    const folder = await db.libraryFolder.create({
      data: {
        userId: session.user.id,
        name: data.name,
        parentId: data.parentId,
        color: data.color,
        icon: data.icon,
      },
      include: {
        _count: {
          select: {
            items: true,
            subFolders: true,
          },
        },
      },
    });

    return created(folder);
  } catch (error) {
    return handleApiError(error);
  }
}

