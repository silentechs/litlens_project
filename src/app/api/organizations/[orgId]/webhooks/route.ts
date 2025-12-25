import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  success,
  created,
  noContent,
} from "@/lib/api";
import {
  createWebhook,
  getOrganizationWebhooks,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  getWebhookDeliveries,
  retryDelivery,
  type WebhookEventType,
} from "@/lib/services/webhooks";
import { checkOrganizationPermission } from "@/lib/services/organizations";
import { createAuditLog } from "@/lib/services/audit-log";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

const webhookEvents = [
  "project.created",
  "project.updated",
  "project.deleted",
  "study.imported",
  "study.screened",
  "study.included",
  "study.excluded",
  "extraction.completed",
  "conflict.created",
  "conflict.resolved",
  "member.added",
  "member.removed",
  "review.completed",
] as const;

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(webhookEvents)).min(1, "Select at least one event"),
});

const updateWebhookSchema = z.object({
  webhookId: z.string().cuid(),
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEvents)).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/organizations/[orgId]/webhooks - List webhooks
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const webhookId = searchParams.get("webhookId");

    // Only owners and admins can manage webhooks
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can manage webhooks");
    }

    // If webhookId provided, return deliveries
    if (webhookId) {
      const deliveries = await getWebhookDeliveries(webhookId, orgId);
      return success(
        deliveries.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
        }))
      );
    }

    const webhooks = await getOrganizationWebhooks(orgId);

    return success(
      webhooks.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        lastTriggeredAt: w.lastTriggeredAt?.toISOString() || null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/organizations/[orgId]/webhooks - Create webhook
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    // Only owners and admins can manage webhooks
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can manage webhooks");
    }

    const body = await request.json();

    // Handle special actions
    if (action === "rotate-secret") {
      const { webhookId } = body;
      const newSecret = await rotateWebhookSecret(webhookId, orgId);
      return success({ secret: newSecret });
    }

    if (action === "retry-delivery") {
      const { deliveryId } = body;
      const result = await retryDelivery(deliveryId, orgId);
      return success(result);
    }

    // Create new webhook
    const { url, events } = createWebhookSchema.parse(body);

    const result = await createWebhook(orgId, {
      url,
      events: events as WebhookEventType[],
    });

    // Audit log
    await createAuditLog(orgId, {
      action: "webhook.created",
      resource: "webhook",
      resourceId: result.id,
      newValue: { url, events },
      context: { userId: session.user.id },
    });

    return created({
      id: result.id,
      secret: result.secret, // Only shown once!
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/organizations/[orgId]/webhooks - Update webhook
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners and admins can update webhooks
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can update webhooks");
    }

    const body = await request.json();
    const { webhookId, ...updates } = updateWebhookSchema.parse(body);

    await updateWebhook(webhookId, orgId, {
      ...updates,
      events: updates.events as WebhookEventType[] | undefined,
    });

    // Audit log
    await createAuditLog(orgId, {
      action: "webhook.updated",
      resource: "webhook",
      resourceId: webhookId,
      newValue: updates,
      context: { userId: session.user.id },
    });

    return success({ id: webhookId, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/organizations/[orgId]/webhooks - Delete webhook
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const webhookId = searchParams.get("webhookId");

    if (!webhookId) {
      throw new Error("webhookId is required");
    }

    // Only owners and admins can delete webhooks
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can delete webhooks");
    }

    await deleteWebhook(webhookId, orgId);

    // Audit log
    await createAuditLog(orgId, {
      action: "webhook.deleted",
      resource: "webhook",
      resourceId: webhookId,
      context: { userId: session.user.id },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

