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
  getOrganizationMembers,
  addOrganizationMember,
  updateMemberRole,
  removeOrganizationMember,
  checkOrganizationPermission,
} from "@/lib/services/organizations";
import { createAuditLog } from "@/lib/services/audit-log";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

const addMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
});

const updateMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]),
});

// GET /api/organizations/[orgId]/members - List members
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

    const members = await getOrganizationMembers(orgId);

    return success(
      members.map((m) => ({
        ...m,
        joinedAt: m.joinedAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/organizations/[orgId]/members - Add member
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners and admins can add members
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can add members");
    }

    const body = await request.json();
    const { userId, role } = addMemberSchema.parse(body);

    await addOrganizationMember(orgId, userId, role);

    // Audit log
    await createAuditLog(orgId, {
      action: "org.member_added",
      resource: "organization",
      resourceId: orgId,
      newValue: { userId, role },
      context: { userId: session.user.id },
    });

    return created({ userId, role, added: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/organizations/[orgId]/members - Update member role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;

    // Only owners can change roles
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners can change member roles");
    }

    const body = await request.json();
    const { userId, role } = updateMemberSchema.parse(body);

    await updateMemberRole(orgId, userId, role);

    // Audit log
    await createAuditLog(orgId, {
      action: "org.member_role_changed",
      resource: "organization",
      resourceId: orgId,
      newValue: { userId, newRole: role },
      context: { userId: session.user.id },
    });

    return success({ userId, role, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/organizations/[orgId]/members - Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      throw new Error("userId is required");
    }

    // Allow users to remove themselves or admins/owners to remove others
    const isRemovingSelf = userId === session.user.id;
    
    if (!isRemovingSelf) {
      const hasPermission = await checkOrganizationPermission(
        orgId,
        session.user.id,
        ["OWNER", "ADMIN"]
      );

      if (!hasPermission) {
        throw new ForbiddenError("Only owners and admins can remove members");
      }
    }

    await removeOrganizationMember(orgId, userId);

    // Audit log
    await createAuditLog(orgId, {
      action: "org.member_removed",
      resource: "organization",
      resourceId: orgId,
      oldValue: { userId },
      context: { userId: session.user.id },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

