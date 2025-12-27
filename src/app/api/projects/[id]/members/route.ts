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
} from "@/lib/api";
import { z } from "zod";
import { sendProjectInvitation, sendWelcomeToProject } from "@/lib/services/email-service";
import { randomBytes } from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for adding a member - uses ProjectRole enum values
const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["REVIEWER", "LEAD", "OBSERVER"]).default("REVIEWER"),
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

    // Bulk fetch statistics for all members
    const allStats = await db.screeningDecisionRecord.groupBy({
      by: ["reviewerId", "decision"],
      where: {
        projectWork: {
          projectId,
        },
      },
      _count: true,
    });

    const membersWithStats = project.members.map((member) => {
      const memberStats = allStats.filter((s) => s.reviewerId === member.userId);

      const decisionCounts = {
        total: 0,
        included: 0,
        excluded: 0,
        maybe: 0,
      };

      memberStats.forEach((s) => {
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
    });

    // Fetch pending invitations
    const invitations = await db.projectInvitation.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return success({
      members: membersWithStats,
      invitations,
      total: membersWithStats.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/members - Add a new member or invite
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
      include: {
        project: {
          select: { title: true }
        }
      }
    });

    if (!requesterMembership) {
      throw new NotFoundError("Project");
    }

    if (!["OWNER", "LEAD"].includes(requesterMembership.role)) {
      throw new ForbiddenError("Only project owners and leads can add members");
    }

    const projectTitle = requesterMembership.project.title;

    // Find user by email
    const userToAdd = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!userToAdd) {
      // User does not exist, create an invitation
      const existingInvitation = await db.projectInvitation.findUnique({
        where: {
          projectId_email: {
            projectId,
            email: email.toLowerCase(),
          },
        },
      });

      if (existingInvitation) {
        throw new ValidationError(`An invitation is already pending for ${email}`);
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create new invitation
      const invitation = await db.projectInvitation.create({
        data: {
          projectId,
          email: email.toLowerCase(),
          role,
          token,
          expiresAt,
          invitedBy: session.user.id,
        },
      });

      // Send email
      await sendProjectInvitation({
        recipientEmail: email,
        inviterName: session.user.name || "A colleague",
        projectTitle,
        role,
        inviteToken: token,
      });

      // Log activity
      await db.activity.create({
        data: {
          userId: session.user.id,
          projectId,
          type: "TEAM_MEMBER_INVITED",
          description: `Invited ${email} to the project as ${role}`,
          metadata: {
            invitedEmail: email,
            role,
          },
        },
      });

      return success({
        message: "Invitation sent",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: "PENDING"
        }
      });
    }

    // Check if user is already a member (Existing logic for registered users)
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

    // Send notification/email to the added user
    await sendWelcomeToProject({
      email: userToAdd.email!,
      userName: userToAdd.name || userToAdd.email!,
      projectTitle,
      role,
      projectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/project/${projectId}`,
    }).catch(console.error);

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

