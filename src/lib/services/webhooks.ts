/**
 * Webhook Service
 * Handles webhook management, event dispatching, and delivery
 */

import { db } from "@/lib/db";
import { WebhookDeliveryStatus } from "@prisma/client";
import { createHmac, randomBytes } from "crypto";

// ============== TYPES ==============

export type WebhookEventType =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "study.imported"
  | "study.screened"
  | "study.included"
  | "study.excluded"
  | "extraction.completed"
  | "conflict.created"
  | "conflict.resolved"
  | "member.added"
  | "member.removed"
  | "review.completed";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  organizationId: string;
  data: Record<string, unknown>;
}

export interface WebhookData {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseTime?: number;
  error?: string;
}

// ============== WEBHOOK MANAGEMENT ==============

/**
 * Create a new webhook
 */
export async function createWebhook(
  organizationId: string,
  data: {
    url: string;
    events: WebhookEventType[];
  }
): Promise<{ id: string; secret: string }> {
  // Generate a signing secret
  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const webhook = await db.webhook.create({
    data: {
      organizationId,
      url: data.url,
      secret,
      events: data.events,
    },
    select: { id: true },
  });

  return { id: webhook.id, secret };
}

/**
 * Update webhook settings
 */
export async function updateWebhook(
  webhookId: string,
  organizationId: string,
  updates: {
    url?: string;
    events?: WebhookEventType[];
    isActive?: boolean;
  }
): Promise<void> {
  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  await db.webhook.update({
    where: { id: webhookId },
    data: {
      ...(updates.url && { url: updates.url }),
      ...(updates.events && { events: updates.events }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  });
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(
  webhookId: string,
  organizationId: string
): Promise<void> {
  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  await db.webhook.delete({ where: { id: webhookId } });
}

/**
 * Get organization webhooks
 */
export async function getOrganizationWebhooks(
  organizationId: string
): Promise<WebhookData[]> {
  const webhooks = await db.webhook.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    isActive: w.isActive,
    failureCount: w.failureCount,
    lastTriggeredAt: w.lastTriggeredAt,
    createdAt: w.createdAt,
  }));
}

/**
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(
  webhookId: string,
  organizationId: string
): Promise<string> {
  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const newSecret = `whsec_${randomBytes(24).toString("hex")}`;

  await db.webhook.update({
    where: { id: webhookId },
    data: { secret: newSecret },
  });

  return newSecret;
}

// ============== EVENT DISPATCH ==============

/**
 * Dispatch an event to all registered webhooks
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  // Find all active webhooks for this org that subscribe to this event
  const webhooks = await db.webhook.findMany({
    where: {
      organizationId,
      isActive: true,
      events: { has: event },
    },
  });

  if (webhooks.length === 0) {
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    organizationId,
    data,
  };

  // Dispatch to each webhook (in parallel, but with timeout)
  await Promise.allSettled(
    webhooks.map((webhook) => deliverWebhook(webhook, payload))
  );
}

/**
 * Deliver payload to a single webhook
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, webhook.secret);

  const startTime = Date.now();
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": payload.timestamp,
        "User-Agent": "LitLens-Webhook/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;
    responseBody = await response.text().catch(() => "");

    const responseTime = Date.now() - startTime;
    const success = response.ok;

    // Create delivery record
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: payload.event,
        payload: payload as unknown as object,
        statusCode,
        responseBody: responseBody.substring(0, 1000), // Limit stored response
        responseTime,
        status: success ? "SUCCESS" : "FAILED",
      },
    });

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        failureCount: success ? 0 : { increment: 1 },
      },
    });

    // Disable webhook if too many failures
    if (!success) {
      const webhook_data = await db.webhook.findUnique({
        where: { id: webhook.id },
        select: { failureCount: true },
      });
      
      if (webhook_data && webhook_data.failureCount >= 10) {
        await db.webhook.update({
          where: { id: webhook.id },
          data: { isActive: false },
        });
      }
    }

    return {
      success,
      statusCode,
      responseBody,
      responseTime,
    };
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    const responseTime = Date.now() - startTime;

    // Create failed delivery record
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: payload.event,
        payload: payload as unknown as object,
        responseTime,
        status: "FAILED",
      },
    });

    // Update failure count
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        failureCount: { increment: 1 },
      },
    });

    return {
      success: false,
      error,
      responseTime,
    };
  }
}

/**
 * Sign a payload with the webhook secret
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a webhook signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signPayload(payload, secret);
  return signature === expected;
}

// ============== DELIVERY MANAGEMENT ==============

/**
 * Get recent deliveries for a webhook
 */
export async function getWebhookDeliveries(
  webhookId: string,
  organizationId: string,
  options: { limit?: number; status?: WebhookDeliveryStatus } = {}
): Promise<Array<{
  id: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  statusCode: number | null;
  responseTime: number | null;
  attempts: number;
  createdAt: Date;
}>> {
  // Verify webhook belongs to organization
  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const where: Record<string, unknown> = { webhookId };
  if (options.status) {
    where.status = options.status;
  }

  const deliveries = await db.webhookDelivery.findMany({
    where,
    take: options.limit || 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventType: true,
      status: true,
      statusCode: true,
      responseTime: true,
      attempts: true,
      createdAt: true,
    },
  });

  return deliveries;
}

/**
 * Retry a failed delivery
 */
export async function retryDelivery(
  deliveryId: string,
  organizationId: string
): Promise<DeliveryResult> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhook: {
        select: { id: true, url: true, secret: true, organizationId: true },
      },
    },
  });

  if (!delivery || delivery.webhook.organizationId !== organizationId) {
    throw new Error("Delivery not found");
  }

  if (delivery.status === "SUCCESS") {
    throw new Error("Cannot retry successful delivery");
  }

  const payload = delivery.payload as unknown as WebhookPayload;
  const result = await deliverWebhook(delivery.webhook, payload);

  // Update attempt count
  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      status: result.success ? "SUCCESS" : "RETRYING",
    },
  });

  return result;
}

// ============== EVENT HELPERS ==============

/**
 * Helper to dispatch project events
 */
export async function dispatchProjectEvent(
  project: { id: string; organizationId: string | null; title: string },
  eventType: "project.created" | "project.updated" | "project.deleted"
): Promise<void> {
  if (!project.organizationId) return;

  await dispatchWebhookEvent(project.organizationId, eventType, {
    projectId: project.id,
    projectTitle: project.title,
  });
}

/**
 * Helper to dispatch study events
 */
export async function dispatchStudyEvent(
  organizationId: string,
  eventType: "study.imported" | "study.screened" | "study.included" | "study.excluded",
  data: {
    projectId: string;
    workId: string;
    title: string;
    decision?: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(organizationId, eventType, data);
}

