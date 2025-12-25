import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
  created,
} from "@/lib/api";
import {
  createAlert,
  getUserAlerts,
  getAlertStats,
} from "@/lib/services/research-alerts";
import { z } from "zod";

const createAlertSchema = z.object({
  name: z.string().min(1, "Alert name is required"),
  description: z.string().optional(),
  alertType: z.enum(["NEW_PUBLICATION", "CITATION_UPDATE", "AUTHOR_ACTIVITY", "KEYWORD_TREND", "CUSTOM_QUERY"]),
  searchQuery: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  authors: z.array(z.string()).default([]),
  journals: z.array(z.string()).default([]),
  frequency: z.enum(["REAL_TIME", "HOURLY", "DAILY", "WEEKLY"]).default("DAILY"),
  emailEnabled: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  projectId: z.string().cuid().optional(),
});

// GET /api/research/alerts - List user's alerts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") === "true";
    const projectId = searchParams.get("projectId") || undefined;
    const includeStats = searchParams.get("includeStats") === "true";

    const alerts = await getUserAlerts(session.user.id, { activeOnly, projectId });

    if (includeStats) {
      const stats = await getAlertStats(session.user.id);
      return success({ alerts, stats });
    }

    return success(alerts);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/research/alerts - Create alert
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = createAlertSchema.parse(body);

    const alert = await createAlert(session.user.id, {
      name: data.name,
      description: data.description,
      alertType: data.alertType,
      searchQuery: data.searchQuery,
      keywords: data.keywords,
      authors: data.authors,
      journals: data.journals,
      frequency: data.frequency,
      emailEnabled: data.emailEnabled,
      inAppEnabled: data.inAppEnabled,
      projectId: data.projectId,
    });

    return created(alert);
  } catch (error) {
    return handleApiError(error);
  }
}

