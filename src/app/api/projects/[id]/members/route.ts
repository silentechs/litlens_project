import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  success, 
  created,
  noContent,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for adding a member - uses ProjectRole enum values
const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["REVIEWER", "LEAD", "OBSERVER"]).default("REVIEWER"),
});

// Schema for updating a member
const updateMemberSchema = z.object({
  role: z.enum(["OWNER", "LEAD", "REVIEWER", "OBSERVER"]),
});

// GET /api/projects/[id]/members - List all project members
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Verify project exists and user has access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                institution: true,
              },
            },
          },
          orderBy: [
            { role: "asc" }, // OWNER first, then LEAD, etc.
            { joinedAt: "asc" },
          ],
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project");
    }

    // Check access
    const isMember = project.members.some((m) => m.userId === session.user.id);
    if (!isMember && !project.isPublic) {
      throw new ForbiddenError();
    }

    // Add statistics for each member
    const membersWithStats = await Promise.all(
      project.members.map(async (member) => {
        const stats = await db.screeningDecisionRecord.groupBy({
          by: ["decision"],
          where: {
            reviewerId: member.userId,
            projectWork: {
              projectId,
            },
          },
          _count: true,
        });

        const decisionCounts = {
          total: 0,
          included: 0,
          excluded: 0,
          maybe: 0,
        };

        stats.forEach((s: { decision: string; _count: number }) => {
          decisionCounts.total += s._count;
          if (s.decision === "INCLUDE") decisionCounts.included = s._count;
          else if (s.decision === "EXCLUDE") decisionCounts.excluded = s._count;
          else if (s.decision === "MAYBE") decisionCounts.maybe = s._count;
        });

        return {
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
          stats: decisionCounts,
        };
      })
    );

    return success({
      members: membersWithStats,
      total: membersWithStats.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/members - Add a new member
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { email, role } = addMemberSchema.parse(body);

    // Check if requester has permission to add members
    const requesterMembership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!requesterMembership) {
      throw new NotFoundError("Project");
    }

    if (!["OWNER", "LEAD"].includes(requesterMembership.role)) {
      throw new ForbiddenError("Only project owners and leads can add members");
    }

    // Find user by email
    const userToAdd = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!userToAdd) {
      throw new ValidationError(`User with email ${email} not found. They must register first.`);
    }

    // Check if user is already a member
    const existingMembership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMembership) {
      throw new ValidationError("User is already a member of this project");
    }

    // Add member
    const member = await db.projectMember.create({
      data: {
        projectId,
        userId: userToAdd.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            institution: true,
          },
        },
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "TEAM_MEMBER_ADDED",
        description: `Added ${userToAdd.name || userToAdd.email} to the project as ${role}`,
        metadata: { 
          addedUserId: userToAdd.id,
          addedUserEmail: userToAdd.email,
          role,
        },
      },
    });

    // TODO: Send notification/email to the added user

    return created({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: member.user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id]/members - Bulk update (used for role changes)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    
    const bulkUpdateSchema = z.object({
      updates: z.array(z.object({
        userId: z.string().cuid(),
        role: z.enum(["OWNER", "LEAD", "REVIEWER", "OBSERVER"]),
      })),
    });
    
    const { updates } = bulkUpdateSchema.parse(body);

    // Check if requester is owner
    const requesterMembership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!requesterMembership || requesterMembership.role !== "OWNER") {
      throw new ForbiddenError("Only project owners can change member roles");
    }

    // Ensure at least one owner remains
    const currentOwners = await db.projectMember.count({
      where: {
        projectId,
        role: "OWNER",
      },
    });

    const newOwners = updates.filter((u) => u.role === "OWNER").length;
    const removedOwners = updates.filter(
      (u) => u.role !== "OWNER" && u.userId === session.user.id
    ).length;

    if (currentOwners - removedOwners + newOwners < 1) {
      throw new ValidationError("Project must have at least one owner");
    }

    // Perform updates
    const results = await Promise.all(
      updates.map((update) =>
        db.projectMember.update({
          where: {
            projectId_userId: {
              projectId,
              userId: update.userId,
            },
          },
          data: { role: update.role },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        })
      )
    );

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "SETTINGS_UPDATED",
        description: `Updated roles for ${updates.length} member(s)`,
        metadata: { updates },
      },
    });

    return success({ updated: results });
  } catch (error) {
    return handleApiError(error);
  }
}

