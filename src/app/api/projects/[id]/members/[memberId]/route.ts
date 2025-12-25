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
  noContent,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

// Schema for updating a member
const updateMemberSchema = z.object({
  role: z.enum(["OWNER", "LEAD", "REVIEWER", "VIEWER"]),
});

// GET /api/projects/[id]/members/[memberId] - Get a specific member
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, memberId } = await params;

    // Check access
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

    const member = await db.projectMember.findUnique({
      where: { id: memberId },
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

    if (!member || member.projectId !== projectId) {
      throw new NotFoundError("Member");
    }

    // Get member's screening stats
    const stats = await db.screeningDecision.aggregate({
      where: {
        userId: member.userId,
        projectWork: {
          projectId,
        },
      },
      _count: true,
      _avg: {
        timeSpentMs: true,
      },
    });

    const decisionBreakdown = await db.screeningDecision.groupBy({
      by: ["decision"],
      where: {
        userId: member.userId,
        projectWork: {
          projectId,
        },
      },
      _count: true,
    });

    return success({
      ...member,
      stats: {
        totalDecisions: stats._count,
        avgTimePerDecision: stats._avg.timeSpentMs,
        breakdown: Object.fromEntries(
          decisionBreakdown.map((d) => [d.decision.toLowerCase(), d._count])
        ),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id]/members/[memberId] - Update a member's role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, memberId } = await params;
    const body = await request.json();
    const { role } = updateMemberSchema.parse(body);

    // Check if requester has permission
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

    // Find the member to update
    const memberToUpdate = await db.projectMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!memberToUpdate || memberToUpdate.projectId !== projectId) {
      throw new NotFoundError("Member");
    }

    // Permission checks
    const isOwner = requesterMembership.role === "OWNER";
    const isLead = requesterMembership.role === "LEAD";
    const isSelf = memberToUpdate.userId === session.user.id;

    // Only owners can change roles
    if (!isOwner) {
      throw new ForbiddenError("Only project owners can change member roles");
    }

    // If demoting self from owner, ensure another owner exists
    if (isSelf && memberToUpdate.role === "OWNER" && role !== "OWNER") {
      const otherOwners = await db.projectMember.count({
        where: {
          projectId,
          role: "OWNER",
          NOT: { id: memberId },
        },
      });

      if (otherOwners === 0) {
        throw new ValidationError(
          "Cannot remove your owner role. Transfer ownership to another member first."
        );
      }
    }

    // Update the member
    const updatedMember = await db.projectMember.update({
      where: { id: memberId },
      data: { role },
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
        type: "MEMBER_UPDATED",
        description: `Changed ${memberToUpdate.user.name || memberToUpdate.user.email}'s role from ${memberToUpdate.role} to ${role}`,
        metadata: {
          memberId,
          previousRole: memberToUpdate.role,
          newRole: role,
        },
      },
    });

    return success(updatedMember);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id]/members/[memberId] - Remove a member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, memberId } = await params;

    // Check if requester has permission
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

    // Find the member to remove
    const memberToRemove = await db.projectMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!memberToRemove || memberToRemove.projectId !== projectId) {
      throw new NotFoundError("Member");
    }

    const isOwner = requesterMembership.role === "OWNER";
    const isLead = requesterMembership.role === "LEAD";
    const isSelf = memberToRemove.userId === session.user.id;

    // Permission checks
    if (!isSelf && !isOwner && !isLead) {
      throw new ForbiddenError("You don't have permission to remove this member");
    }

    // Leads can only remove viewers and reviewers
    if (isLead && !isSelf && ["OWNER", "LEAD"].includes(memberToRemove.role)) {
      throw new ForbiddenError("Leads can only remove viewers and reviewers");
    }

    // Cannot remove the last owner
    if (memberToRemove.role === "OWNER") {
      const otherOwners = await db.projectMember.count({
        where: {
          projectId,
          role: "OWNER",
          NOT: { id: memberId },
        },
      });

      if (otherOwners === 0) {
        throw new ValidationError(
          "Cannot remove the last owner. Transfer ownership to another member first."
        );
      }
    }

    // Remove the member
    await db.projectMember.delete({
      where: { id: memberId },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: isSelf ? "MEMBER_LEFT" : "MEMBER_REMOVED",
        description: isSelf
          ? `Left the project`
          : `Removed ${memberToRemove.user.name || memberToRemove.user.email} from the project`,
        metadata: {
          removedUserId: memberToRemove.userId,
          removedUserEmail: memberToRemove.user.email,
          role: memberToRemove.role,
        },
      },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

