import { z } from "zod";

// ============== PROJECT SCHEMAS ==============

export const createProjectSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  population: z.string().max(1000).optional(),
  intervention: z.string().max(1000).optional(),
  comparison: z.string().max(1000).optional(),
  outcome: z.string().max(1000).optional(),
  isPublic: z.boolean().optional().default(false),
  blindScreening: z.boolean().optional().default(true),
  requireDualScreening: z.boolean().optional().default(true),
});

export const updateProjectSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters")
    .optional(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .nullable(),
  population: z.string().max(1000).optional().nullable(),
  intervention: z.string().max(1000).optional().nullable(),
  comparison: z.string().max(1000).optional().nullable(),
  outcome: z.string().max(1000).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  isPublic: z.boolean().optional(),
  blindScreening: z.boolean().optional(),
  requireDualScreening: z.boolean().optional(),
});

export const projectIdSchema = z.object({
  id: z.string().cuid(),
});

// ============== MEMBER SCHEMAS ==============

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER", "LEAD", "REVIEWER", "OBSERVER"]).default("REVIEWER"),
  message: z.string().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "LEAD", "REVIEWER", "OBSERVER"]),
});

// ============== FILTER SCHEMAS ==============

export const projectFiltersSchema = z.object({
  status: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
      .or(z.array(z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])))
      .optional()
  ),
  search: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.string().max(100).optional()
  ),
  organizationId: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.string().cuid().optional()
  ),
  isArchived: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.boolean().optional()
  ),
});

// ============== TYPE EXPORTS ==============

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

