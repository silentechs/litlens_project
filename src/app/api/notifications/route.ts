import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  paginated,
} from "@/lib/api";

// GET /api/notifications - Get user notifications (from activities)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const projectId = searchParams.get("projectId");

    // Get user's projects
    const userProjects = await db.projectMember.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });

    const projectIds = userProjects.map(p => p.projectId);

    // Build where clause
    const where: Record<string, unknown> = {
      OR: [
        // Activities from user's projects (excluding their own)
        {
          projectId: { in: projectIds },
          userId: { not: session.user.id },
        },
        // System notifications directed at user (if we add a targetUserId field later)
      ],
    };

    if (projectId) {
      where.projectId = projectId;
    }

    // Get total count
    const total = await db.activity.count({ where });

    // Get activities as notifications
    const activities = await db.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Transform to notifications
    const notifications = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      title: getNotificationTitle(activity.type),
      message: activity.description,
      metadata: activity.metadata,
      user: activity.user,
      project: activity.project,
      createdAt: activity.createdAt.toISOString(),
      isRead: false, // TODO: Add read tracking
    }));

    return paginated(notifications, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

function getNotificationTitle(type: string): string {
  const titles: Record<string, string> = {
    PROJECT_CREATED: "New Project",
    PROJECT_UPDATED: "Project Updated",
    MEMBER_ADDED: "Team Member Added",
    MEMBER_REMOVED: "Team Member Removed",
    MEMBER_LEFT: "Team Member Left",
    MEMBER_UPDATED: "Role Changed",
    STUDY_IMPORTED: "Studies Imported",
    SCREENING_STARTED: "Screening Started",
    SCREENING_DECISION: "Screening Decision",
    SCREENING_COMPLETED: "Screening Completed",
    CONFLICT_CREATED: "New Conflict",
    CONFLICT_RESOLVED: "Conflict Resolved",
    IMPORT_DELETED: "Import Deleted",
    PROTOCOL_CREATED: "Protocol Created",
    PROTOCOL_UPDATED: "Protocol Updated",
  };
  return titles[type] || "Activity";
}

