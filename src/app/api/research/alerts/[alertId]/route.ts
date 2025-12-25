import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import {
  getAlertDetails,
  updateAlert,
  deleteAlert,
  markDiscoveriesViewed,
} from "@/lib/services/research-alerts";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ alertId: string }>;
}

const updateAlertSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  searchQuery: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  journals: z.array(z.string()).optional(),
  frequency: z.enum(["REAL_TIME", "HOURLY", "DAILY", "WEEKLY"]).optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/research/alerts/[alertId] - Get alert details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { alertId } = await params;

    const result = await getAlertDetails(alertId, session.user.id);

    if (!result) {
      throw new NotFoundError("Alert");
    }

    return success(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/research/alerts/[alertId] - Update alert
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { alertId } = await params;
    const body = await request.json();
    const data = updateAlertSchema.parse(body);

    await updateAlert(alertId, session.user.id, data);

    return success({ id: alertId, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/research/alerts/[alertId] - Delete alert
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { alertId } = await params;

    await deleteAlert(alertId, session.user.id);

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/research/alerts/[alertId]/mark-viewed - Mark discoveries as viewed
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { alertId } = await params;
    const body = await request.json();
    const discoveryIds = body.discoveryIds as string[] | undefined;

    await markDiscoveriesViewed(alertId, session.user.id, discoveryIds);

    return success({ marked: true });
  } catch (error) {
    return handleApiError(error);
  }
}

