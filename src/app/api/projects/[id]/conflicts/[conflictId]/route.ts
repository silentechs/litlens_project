import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
} from "@/lib/api";
import { 
  getConflictDetails, 
  resolveConflict,
  escalateConflict,
} from "@/lib/services/conflict-resolution";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; conflictId: string }>;
}

// GET /api/projects/[id]/conflicts/[conflictId] - Get conflict details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, conflictId } = await params;

    // Check project access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    const conflict = await getConflictDetails(conflictId);

    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundError("Conflict");
    }

    return success(conflict);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/conflicts/[conflictId] - Resolve conflict
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, conflictId } = await params;

    // Check project access and role (only leads can resolve conflicts)
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can resolve conflicts");
    }

    // Verify conflict belongs to project
    const existingConflict = await db.conflict.findUnique({
      where: { id: conflictId },
    });

    if (!existingConflict || existingConflict.projectId !== projectId) {
      throw new NotFoundError("Conflict");
    }

    // Parse request body
    const bodySchema = z.object({
      finalDecision: z.enum(["INCLUDE", "EXCLUDE", "MAYBE"]),
      reasoning: z.string().min(1, "Reasoning is required"),
    });

    const body = await request.json();
    const { finalDecision, reasoning } = bodySchema.parse(body);

    const resolved = await resolveConflict({
      conflictId,
      resolverId: session.user.id,
      finalDecision,
      reasoning,
    });

    return success(resolved);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id]/conflicts/[conflictId] - Escalate conflict
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, conflictId } = await params;

    // Check project access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    // Verify conflict belongs to project
    const conflict = await db.conflict.findUnique({
      where: { id: conflictId },
    });

    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundError("Conflict");
    }

    // Parse request body
    const bodySchema = z.object({
      action: z.enum(["escalate"]),
      reason: z.string().min(1, "Escalation reason is required"),
    });

    const body = await request.json();
    const { reason } = bodySchema.parse(body);

    await escalateConflict(conflictId, session.user.id, reason);

    return success({ message: "Conflict escalated to project leads" });
  } catch (error) {
    return handleApiError(error);
  }
}

