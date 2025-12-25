/**
 * Organization Service
 * Handles multi-tenancy, organization management, and permissions
 */

import { db } from "@/lib/db";
import { OrganizationRole, OrganizationTier } from "@prisma/client";
import { randomBytes } from "crypto";

// ============== TYPES ==============

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string;
  tier: OrganizationTier;
  maxProjects: number;
  maxMembers: number;
  maxStudiesPerProject: number;
  memberCount?: number;
  projectCount?: number;
  createdAt: Date;
}

export interface OrganizationMemberData {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: OrganizationRole;
  capabilities: string[];
  joinedAt: Date;
}

export interface InvitationData {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: Date;
  createdAt: Date;
}

// ============== ORGANIZATION CRUD ==============

/**
 * Create a new organization
 */
export async function createOrganization(
  userId: string,
  data: {
    name: string;
    slug?: string;
    domain?: string;
    logoUrl?: string;
    primaryColor?: string;
  }
): Promise<OrganizationData> {
  // Generate slug if not provided
  const slug = data.slug || generateSlug(data.name);

  // Check slug uniqueness
  const existing = await db.organization.findUnique({
    where: { slug },
  });

  if (existing) {
    throw new Error("Organization slug already exists");
  }

  // Create organization with user as owner
  const org = await db.organization.create({
    data: {
      name: data.name,
      slug,
      domain: data.domain,
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor || "#4F46E5",
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    tier: org.tier,
    maxProjects: org.maxProjects,
    maxMembers: org.maxMembers,
    maxStudiesPerProject: org.maxStudiesPerProject,
    createdAt: org.createdAt,
  };
}

/**
 * Get organization by ID
 */
export async function getOrganization(
  organizationId: string
): Promise<OrganizationData | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    tier: org.tier,
    maxProjects: org.maxProjects,
    maxMembers: org.maxMembers,
    maxStudiesPerProject: org.maxStudiesPerProject,
    memberCount: org._count.members,
    projectCount: org._count.projects,
    createdAt: org.createdAt,
  };
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(
  slug: string
): Promise<OrganizationData | null> {
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    tier: org.tier,
    maxProjects: org.maxProjects,
    maxMembers: org.maxMembers,
    maxStudiesPerProject: org.maxStudiesPerProject,
    memberCount: org._count.members,
    projectCount: org._count.projects,
    createdAt: org.createdAt,
  };
}

/**
 * Update organization
 */
export async function updateOrganization(
  organizationId: string,
  data: {
    name?: string;
    slug?: string;
    domain?: string;
    logoUrl?: string;
    primaryColor?: string;
  }
): Promise<void> {
  if (data.slug) {
    const existing = await db.organization.findFirst({
      where: { slug: data.slug, id: { not: organizationId } },
    });
    if (existing) {
      throw new Error("Slug already in use");
    }
  }

  await db.organization.update({
    where: { id: organizationId },
    data,
  });
}

/**
 * Delete organization
 */
export async function deleteOrganization(organizationId: string): Promise<void> {
  await db.organization.delete({ where: { id: organizationId } });
}

/**
 * Get user's organizations
 */
export async function getUserOrganizations(
  userId: string
): Promise<Array<OrganizationData & { role: OrganizationRole }>> {
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    domain: m.organization.domain,
    logoUrl: m.organization.logoUrl,
    primaryColor: m.organization.primaryColor,
    tier: m.organization.tier,
    maxProjects: m.organization.maxProjects,
    maxMembers: m.organization.maxMembers,
    maxStudiesPerProject: m.organization.maxStudiesPerProject,
    memberCount: m.organization._count.members,
    projectCount: m.organization._count.projects,
    createdAt: m.organization.createdAt,
    role: m.role,
  }));
}

// ============== MEMBER MANAGEMENT ==============

/**
 * Get organization members
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberData[]> {
  const members = await db.organizationMember.findMany({
    where: { organizationId },
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
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    user: m.user,
    role: m.role,
    capabilities: (m.capabilities as string[]) || [],
    joinedAt: m.joinedAt,
  }));
}

/**
 * Add member to organization
 */
export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrganizationRole = "MEMBER"
): Promise<void> {
  // Check limits
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (org._count.members >= org.maxMembers) {
    throw new Error("Organization member limit reached");
  }

  // Check if already a member
  const existing = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });

  if (existing) {
    throw new Error("User is already a member");
  }

  await db.organizationMember.create({
    data: {
      organizationId,
      userId,
      role,
    },
  });
}

/**
 * Update member role
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  newRole: OrganizationRole
): Promise<void> {
  // Prevent removing the last owner
  if (newRole !== "OWNER") {
    const owners = await db.organizationMember.count({
      where: { organizationId, role: "OWNER" },
    });

    const currentMember = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    if (currentMember?.role === "OWNER" && owners <= 1) {
      throw new Error("Cannot remove the last owner");
    }
  }

  await db.organizationMember.update({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    data: { role: newRole },
  });
}

/**
 * Remove member from organization
 */
export async function removeOrganizationMember(
  organizationId: string,
  userId: string
): Promise<void> {
  // Prevent removing the last owner
  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (member?.role === "OWNER") {
    const owners = await db.organizationMember.count({
      where: { organizationId, role: "OWNER" },
    });

    if (owners <= 1) {
      throw new Error("Cannot remove the last owner");
    }
  }

  await db.organizationMember.delete({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
}

// ============== INVITATIONS ==============

/**
 * Create invitation
 */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: OrganizationRole = "MEMBER"
): Promise<{ token: string; expiresAt: Date }> {
  // Check if already a member
  const existingMember = await db.user.findFirst({
    where: {
      email,
      organizationMembers: {
        some: { organizationId },
      },
    },
  });

  if (existingMember) {
    throw new Error("User is already a member");
  }

  // Check for pending invitation
  const existingInvite = await db.organizationInvitation.findFirst({
    where: {
      organizationId,
      email,
      expiresAt: { gt: new Date() },
      acceptedAt: null,
    },
  });

  if (existingInvite) {
    return {
      token: existingInvite.token,
      expiresAt: existingInvite.expiresAt,
    };
  }

  // Create new invitation
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await db.organizationInvitation.create({
    data: {
      organizationId,
      email,
      role,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Accept invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<{ organizationId: string }> {
  const invitation = await db.organizationInvitation.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  if (!invitation) {
    throw new Error("Invalid invitation");
  }

  if (invitation.acceptedAt) {
    throw new Error("Invitation already accepted");
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("Invitation has expired");
  }

  // Verify email matches
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error("Invitation email does not match");
  }

  // Add member and mark invitation as accepted
  await db.$transaction([
    db.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
    }),
    db.organizationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return { organizationId: invitation.organizationId };
}

/**
 * Get pending invitations
 */
export async function getPendingInvitations(
  organizationId: string
): Promise<InvitationData[]> {
  const invitations = await db.organizationInvitation.findMany({
    where: {
      organizationId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));
}

/**
 * Cancel invitation
 */
export async function cancelInvitation(
  organizationId: string,
  invitationId: string
): Promise<void> {
  await db.organizationInvitation.delete({
    where: {
      id: invitationId,
      organizationId,
    },
  });
}

// ============== PERMISSIONS ==============

/**
 * Check if user has permission in organization
 */
export async function checkOrganizationPermission(
  organizationId: string,
  userId: string,
  requiredRoles: OrganizationRole[]
): Promise<boolean> {
  const member = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    select: { role: true },
  });

  if (!member) {
    return false;
  }

  return requiredRoles.includes(member.role);
}

/**
 * Get user's role in organization
 */
export async function getUserOrganizationRole(
  organizationId: string,
  userId: string
): Promise<OrganizationRole | null> {
  const member = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    select: { role: true },
  });

  return member?.role || null;
}

// ============== TIER LIMITS ==============

/**
 * Check if organization can create more projects
 */
export async function canCreateProject(organizationId: string): Promise<boolean> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: { select: { projects: true } },
    },
  });

  if (!org) return false;
  return org._count.projects < org.maxProjects;
}

/**
 * Check if project can have more studies
 */
export async function canImportStudies(
  organizationId: string,
  projectId: string,
  count: number
): Promise<boolean> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { maxStudiesPerProject: true },
  });

  if (!org) return false;

  const currentCount = await db.projectWork.count({
    where: { projectId },
  });

  return currentCount + count <= org.maxStudiesPerProject;
}

// ============== HELPERS ==============

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

