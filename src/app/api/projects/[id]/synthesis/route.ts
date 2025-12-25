import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
} from "@/lib/api";
import { 
  generatePRISMAFlow, 
  exportPRISMAFlow,
  getPRISMAChecklist,
} from "@/lib/services/prisma-generation";
import {
  getGradeAssessments,
  saveGradeAssessment,
  generateSummaryOfFindings,
  exportGradeTable,
} from "@/lib/services/grade-framework";
import {
  fixedEffectsMeta,
  randomEffectsMeta,
  generateForestPlot,
  generateForestPlotSVG,
  type StudyEffect,
  type EffectMeasure,
} from "@/lib/services/meta-analysis";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/synthesis - Get synthesis data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Check project access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    const type = searchParams.get("type");

    switch (type) {
      case "prisma":
        const format = (searchParams.get("format") || "json") as "svg" | "json" | "markdown";
        const prismaData = await exportPRISMAFlow(projectId, format);
        
        if (format === "svg") {
          return new Response(prismaData, {
            headers: { "Content-Type": "image/svg+xml" },
          });
        }
        if (format === "markdown") {
          return new Response(prismaData, {
            headers: { "Content-Type": "text/markdown" },
          });
        }
        return success(JSON.parse(prismaData));

      case "prisma-checklist":
        const checklist = getPRISMAChecklist();
        return success(checklist);

      case "grade":
        const gradeAssessments = await getGradeAssessments(projectId);
        return success(gradeAssessments);

      default:
        // Return summary of all synthesis data
        const [prismaFlow, grade] = await Promise.all([
          generatePRISMAFlow(projectId),
          getGradeAssessments(projectId),
        ]);

        return success({
          prisma: prismaFlow,
          grade: {
            assessments: grade,
            outcomeCount: grade.length,
          },
        });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/synthesis - Run synthesis operations
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access (only leads can run synthesis)
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can run synthesis operations");
    }

    const body = await request.json();
    const operation = body.operation;

    switch (operation) {
      case "grade_assessment":
        const gradeSchema = z.object({
          outcomeName: z.string(),
          outcomeDescription: z.string().optional(),
          numberOfStudies: z.number(),
          totalParticipants: z.number().optional(),
          studyDesign: z.enum(["RCT", "OBSERVATIONAL", "MIXED"]),
          riskOfBias: z.object({
            level: z.enum(["NO_CONCERNS", "SERIOUS", "VERY_SERIOUS"]),
            downgrades: z.number().min(0).max(2),
            justification: z.string(),
          }),
          inconsistency: z.object({
            level: z.enum(["NO_CONCERNS", "SERIOUS", "VERY_SERIOUS"]),
            downgrades: z.number().min(0).max(2),
            justification: z.string(),
          }),
          indirectness: z.object({
            level: z.enum(["NO_CONCERNS", "SERIOUS", "VERY_SERIOUS"]),
            downgrades: z.number().min(0).max(2),
            justification: z.string(),
          }),
          imprecision: z.object({
            level: z.enum(["NO_CONCERNS", "SERIOUS", "VERY_SERIOUS"]),
            downgrades: z.number().min(0).max(2),
            justification: z.string(),
          }),
          publicationBias: z.object({
            level: z.enum(["NO_CONCERNS", "SERIOUS", "VERY_SERIOUS"]),
            downgrades: z.number().min(0).max(2),
            justification: z.string(),
          }),
          largeEffect: z.object({
            applies: z.boolean(),
            upgrades: z.number().min(0).max(2),
            justification: z.string(),
          }).optional(),
          doseResponse: z.object({
            applies: z.boolean(),
            upgrades: z.number().min(0).max(2),
            justification: z.string(),
          }).optional(),
          plausibleConfounding: z.object({
            applies: z.boolean(),
            upgrades: z.number().min(0).max(2),
            justification: z.string(),
          }).optional(),
          effectEstimate: z.object({
            type: z.enum(["RR", "OR", "HR", "MD", "SMD"]),
            value: z.number(),
            ciLower: z.number(),
            ciUpper: z.number(),
          }).optional(),
          summary: z.string(),
          importanceRating: z.number().min(1).max(9).optional(),
        });

        const gradeData = gradeSchema.parse(body.data);
        const assessment = await saveGradeAssessment(projectId, {
          ...gradeData,
          startingGrade: gradeData.studyDesign === "OBSERVATIONAL" ? 2 : 4,
        });

        return success(assessment);

      case "summary_of_findings":
        const sofSchema = z.object({
          title: z.string(),
          comparison: z.string(),
        });
        const sofData = sofSchema.parse(body.data);
        const sof = await generateSummaryOfFindings(projectId, sofData.title, sofData.comparison);
        
        if (body.format === "markdown") {
          const markdown = exportGradeTable(sof);
          return new Response(markdown, {
            headers: { "Content-Type": "text/markdown" },
          });
        }
        
        return success(sof);

      case "meta_analysis":
        const metaSchema = z.object({
          studies: z.array(z.object({
            studyId: z.string(),
            studyName: z.string(),
            year: z.number().optional(),
            // Binary data
            eventsTreatment: z.number().optional(),
            totalTreatment: z.number().optional(),
            eventsControl: z.number().optional(),
            totalControl: z.number().optional(),
            // Continuous data
            meanTreatment: z.number().optional(),
            sdTreatment: z.number().optional(),
            nTreatment: z.number().optional(),
            meanControl: z.number().optional(),
            sdControl: z.number().optional(),
            nControl: z.number().optional(),
            // Pre-calculated
            effectSize: z.number().optional(),
            variance: z.number().optional(),
          })),
          effectMeasure: z.enum(["RR", "OR", "HR", "RD", "MD", "SMD"]),
          model: z.enum(["fixed", "random"]).default("random"),
          outputFormat: z.enum(["json", "svg"]).default("json"),
        });

        const metaData = metaSchema.parse(body.data);
        const metaFn = metaData.model === "fixed" ? fixedEffectsMeta : randomEffectsMeta;
        const result = metaFn(metaData.studies as StudyEffect[], metaData.effectMeasure as EffectMeasure);

        if (metaData.outputFormat === "svg") {
          const forestPlot = generateForestPlot(result);
          const svg = generateForestPlotSVG(forestPlot);
          return new Response(svg, {
            headers: { "Content-Type": "image/svg+xml" },
          });
        }

        return success({
          result,
          forestPlot: generateForestPlot(result),
        });

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

