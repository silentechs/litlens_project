import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import {
  getOrganization,
  updateOrganization,
  deleteOrganization,
  checkOrganizationPermission,
} from "@/lib/services/organizations";
import { createAuditLogWithDiff } from "@/lib/services/audit-log";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// GET /api/organizations/[orgId] - Get organization details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Check membership
    const hasAccess = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN", "MEMBER", "GUEST"]
    );

    if (!hasAccess) {
      throw new NotFoundError("Organization");
    }

    const org = await getOrganization(orgId);
    if (!org) {
      throw new NotFoundError("Organization");
    }

    return success({
      ...org,
      createdAt: org.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/organizations/[orgId] - Update organization
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners and admins can update
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can update organization settings");
    }

    const oldOrg = await getOrganization(orgId);
    if (!oldOrg) {
      throw new NotFoundError("Organization");
    }

    const body = await request.json();
    const data = updateOrgSchema.parse(body);

    await updateOrganization(orgId, data);

    // Audit log
    await createAuditLogWithDiff(orgId, {
      action: "org.updated",
      resource: "organization",
      resourceId: orgId,
      oldData: oldOrg,
      newData: { ...oldOrg, ...data },
      fieldsToTrack: ["name", "slug", "domain", "logoUrl", "primaryColor"],
      context: { userId: session.user.id },
    });

    return success({ id: orgId, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/organizations/[orgId] - Delete organization
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners can delete
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners can delete the organization");
    }

    await deleteOrganization(orgId);

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

