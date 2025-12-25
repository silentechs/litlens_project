import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
  created,
} from "@/lib/api";
import {
  createOrganization,
  getUserOrganizations,
} from "@/lib/services/organizations";
import { z } from "zod";

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// GET /api/organizations - List user's organizations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const organizations = await getUserOrganizations(session.user.id);

    return success(
      organizations.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/organizations - Create organization
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = createOrgSchema.parse(body);

    const org = await createOrganization(session.user.id, data);

    return created({
      ...org,
      createdAt: org.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

