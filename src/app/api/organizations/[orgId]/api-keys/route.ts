import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
  created,
  noContent,
} from "@/lib/api";
import {
  generateApiKey,
  getOrganizationApiKeys,
  updateApiKey,
  revokeApiKey,
  getApiKeyUsageStats,
} from "@/lib/services/api-keys";
import { checkOrganizationPermission } from "@/lib/services/organizations";
import { createAuditLog } from "@/lib/services/audit-log";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.string()),
  })).optional(),
  rateLimit: z.number().min(100).max(100000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateKeySchema = z.object({
  keyId: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.string()),
  })).optional(),
  rateLimit: z.number().min(100).max(100000).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/organizations/[orgId]/api-keys - List API keys
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const keyId = searchParams.get("keyId");

    // Only owners and admins can manage API keys
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can manage API keys");
    }

    // If keyId provided, return usage stats
    if (keyId) {
      const stats = await getApiKeyUsageStats(keyId);
      return success(stats);
    }

    const keys = await getOrganizationApiKeys(orgId);

    return success(
      keys.map((k) => ({
        ...k,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
        expiresAt: k.expiresAt?.toISOString() || null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/organizations/[orgId]/api-keys - Create API key
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners and admins can create API keys
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can create API keys");
    }

    const body = await request.json();
    const { name, permissions, rateLimit, expiresAt } = createKeySchema.parse(body);

    const result = await generateApiKey(orgId, {
      name,
      permissions,
      rateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Audit log
    await createAuditLog(orgId, {
      action: "api_key.created",
      resource: "api_key",
      resourceId: result.keyData.id,
      newValue: { name, permissions, rateLimit },
      context: { userId: session.user.id },
    });

    // Return the key (only shown once!)
    return created({
      key: result.key,
      keyData: {
        ...result.keyData,
        createdAt: result.keyData.createdAt.toISOString(),
        lastUsedAt: result.keyData.lastUsedAt?.toISOString() || null,
        expiresAt: result.keyData.expiresAt?.toISOString() || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/organizations/[orgId]/api-keys - Update API key
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners and admins can update API keys
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can update API keys");
    }

    const body = await request.json();
    const { keyId, ...updates } = updateKeySchema.parse(body);

    await updateApiKey(keyId, orgId, updates);

    // Audit log
    await createAuditLog(orgId, {
      action: "api_key.created", // Using available action type
      resource: "api_key",
      resourceId: keyId,
      newValue: updates,
      context: { userId: session.user.id },
    });

    return success({ id: keyId, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/organizations/[orgId]/api-keys - Revoke API key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      throw new Error("keyId is required");
    }

    // Only owners and admins can revoke API keys
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can revoke API keys");
    }

    await revokeApiKey(keyId, orgId);

    // Audit log
    await createAuditLog(orgId, {
      action: "api_key.revoked",
      resource: "api_key",
      resourceId: keyId,
      context: { userId: session.user.id },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

