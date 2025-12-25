/**
 * Export Service for LitLens
 * 
 * Provides comprehensive export functionality for systematic review projects.
 * Supports CSV, Excel, RIS (EndNote), and JSON formats.
 */

import * as XLSX from "xlsx";
import { db } from "@/lib/db";

// ============== TYPES ==============

export type ExportFormat = "csv" | "excel" | "ris" | "json";

export interface ExportOptions {
    format: ExportFormat;
    projectId: string;
    includeScreeningData?: boolean;
    includeExtractionData?: boolean;
    includeQualityAssessments?: boolean;
    studyFilter?: "all" | "included" | "excluded" | "pending";
}

interface ExportableStudy {
    id: string;
    title: string;
    authors: string;
    year: number | null;
    journal: string | null;
    doi: string | null;
    pmid: string | null;
    abstract: string | null;
    status: string;
    phase: string;
    screeningDecision: string | null;
    exclusionReason: string | null;
    extractionData: Record<string, unknown> | null;
    qualityScore: string | null;
}

// ============== CORE EXPORT FUNCTIONS ==============

/**
 * Export project studies in the specified format
 */
export async function exportProjectStudies(options: ExportOptions): Promise<{
    data: Buffer | string;
    filename: string;
    contentType: string;
}> {
    const studies = await getExportableStudies(options);

    switch (options.format) {
        case "csv":
            return exportToCSV(studies, options.projectId);
        case "excel":
            return exportToExcel(studies, options.projectId);
        case "ris":
            return exportToRIS(studies, options.projectId);
        case "json":
            return exportToJSON(studies, options.projectId);
        default:
            throw new Error(`Unsupported export format: ${options.format}`);
    }
}

/**
 * Fetch studies with all relevant data for export
 */
async function getExportableStudies(options: ExportOptions): Promise<ExportableStudy[]> {
    const statusFilter = options.studyFilter === "all" ? undefined : {
        included: "INCLUDED",
        excluded: "EXCLUDED",
        pending: "PENDING",
    }[options.studyFilter as string];

    const projectWorks = await db.projectWork.findMany({
        where: {
            projectId: options.projectId,
            ...(statusFilter && { status: statusFilter as "INCLUDED" | "EXCLUDED" | "PENDING" }),
        },
        include: {
            work: true,
            decisions: {
                orderBy: { createdAt: "desc" },
                take: 1,
            },
            ...(options.includeExtractionData && {
                extractionData: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            }),
            ...(options.includeQualityAssessments && {
                qualityAssessments: {
                    include: { tool: true },
                    take: 1,
                },
            }),
        },
        orderBy: { createdAt: "asc" },
    });

    return projectWorks.map((pw) => ({
        id: pw.id,
        title: pw.work.title,
        authors: Array.isArray(pw.work.authors)
            ? (pw.work.authors as string[]).join("; ")
            : String(pw.work.authors || ""),
        year: pw.work.publicationDate ? new Date(pw.work.publicationDate).getFullYear() : null,
        journal: pw.work.journal,
        doi: pw.work.doi,
        pmid: pw.work.pmid,
        abstract: pw.work.abstract,
        status: pw.status,
        phase: pw.phase,
        screeningDecision: pw.decisions[0]?.decision || null,
        exclusionReason: pw.decisions[0]?.exclusionReason || null,
        extractionData: options.includeExtractionData && pw.extractionData?.[0]
            ? pw.extractionData[0].data as Record<string, unknown>
            : null,
        qualityScore: options.includeQualityAssessments && pw.qualityAssessments?.[0]
            ? pw.qualityAssessments[0].overallScore
            : null,
    }));
}

// ============== FORMAT HANDLERS ==============

/**
 * Export to CSV format
 */
function exportToCSV(studies: ExportableStudy[], projectId: string): {
    data: Buffer;
    filename: string;
    contentType: string;
} {
    const headers = [
        "ID", "Title", "Authors", "Year", "Journal", "DOI", "PMID",
        "Status", "Phase", "Decision", "Exclusion Reason", "Quality Score",
    ];

    const rows = studies.map((s) => [
        s.id,
        escapeCSV(s.title),
        escapeCSV(s.authors),
        s.year || "",
        escapeCSV(s.journal || ""),
        s.doi || "",
        s.pmid || "",
        s.status,
        s.phase,
        s.screeningDecision || "",
        escapeCSV(s.exclusionReason || ""),
        s.qualityScore || "",
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
    ].join("\n");

    return {
        data: Buffer.from(csvContent, "utf-8"),
        filename: `litlens-export-${projectId}-${Date.now()}.csv`,
        contentType: "text/csv; charset=utf-8",
    };
}

/**
 * Export to Excel format
 */
function exportToExcel(studies: ExportableStudy[], projectId: string): {
    data: Buffer;
    filename: string;
    contentType: string;
} {
    const workbook = XLSX.utils.book_new();

    // Main studies sheet
    const studiesData = studies.map((s) => ({
        "ID": s.id,
        "Title": s.title,
        "Authors": s.authors,
        "Year": s.year,
        "Journal": s.journal,
        "DOI": s.doi,
        "PMID": s.pmid,
        "Status": s.status,
        "Phase": s.phase,
        "Decision": s.screeningDecision,
        "Exclusion Reason": s.exclusionReason,
        "Quality Score": s.qualityScore,
    }));

    const studiesSheet = XLSX.utils.json_to_sheet(studiesData);
    XLSX.utils.book_append_sheet(workbook, studiesSheet, "Studies");

    // Extraction data sheet (if available)
    const studiesWithExtraction = studies.filter((s) => s.extractionData);
    if (studiesWithExtraction.length > 0) {
        const extractionData = studiesWithExtraction.map((s) => ({
            "Study ID": s.id,
            "Title": s.title,
            ...flattenObject(s.extractionData || {}),
        }));
        const extractionSheet = XLSX.utils.json_to_sheet(extractionData);
        XLSX.utils.book_append_sheet(workbook, extractionSheet, "Extraction Data");
    }

    // Summary sheet
    const summaryData = [
        { "Metric": "Total Studies", "Value": studies.length },
        { "Metric": "Included", "Value": studies.filter((s) => s.status === "INCLUDED").length },
        { "Metric": "Excluded", "Value": studies.filter((s) => s.status === "EXCLUDED").length },
        { "Metric": "Pending", "Value": studies.filter((s) => s.status === "PENDING").length },
        { "Metric": "Export Date", "Value": new Date().toISOString() },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return {
        data: buffer,
        filename: `litlens-export-${projectId}-${Date.now()}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
}

/**
 * Export to RIS format (EndNote compatible)
 */
function exportToRIS(studies: ExportableStudy[], projectId: string): {
    data: Buffer;
    filename: string;
    contentType: string;
} {
    const risEntries = studies.map((s) => {
        const lines: string[] = [];

        // Type - default to Journal Article
        lines.push("TY  - JOUR");

        // Title
        lines.push(`TI  - ${s.title}`);

        // Authors
        const authors = s.authors.split(";").map((a) => a.trim());
        authors.forEach((author) => {
            if (author) lines.push(`AU  - ${author}`);
        });

        // Year
        if (s.year) lines.push(`PY  - ${s.year}`);

        // Journal
        if (s.journal) lines.push(`JO  - ${s.journal}`);

        // DOI
        if (s.doi) lines.push(`DO  - ${s.doi}`);

        // PMID
        if (s.pmid) lines.push(`AN  - PMID:${s.pmid}`);

        // Abstract
        if (s.abstract) lines.push(`AB  - ${s.abstract.replace(/\n/g, " ")}`);

        // Custom fields for screening data
        lines.push(`N1  - Status: ${s.status}`);
        if (s.screeningDecision) lines.push(`N1  - Decision: ${s.screeningDecision}`);
        if (s.exclusionReason) lines.push(`N1  - Exclusion Reason: ${s.exclusionReason}`);
        if (s.qualityScore) lines.push(`N1  - Quality Score: ${s.qualityScore}`);

        // End of record
        lines.push("ER  - ");

        return lines.join("\n");
    });

    const risContent = risEntries.join("\n\n");

    return {
        data: Buffer.from(risContent, "utf-8"),
        filename: `litlens-export-${projectId}-${Date.now()}.ris`,
        contentType: "application/x-research-info-systems",
    };
}

/**
 * Export to JSON format
 */
function exportToJSON(studies: ExportableStudy[], projectId: string): {
    data: Buffer;
    filename: string;
    contentType: string;
} {
    const exportData = {
        exportDate: new Date().toISOString(),
        projectId,
        totalStudies: studies.length,
        summary: {
            included: studies.filter((s) => s.status === "INCLUDED").length,
            excluded: studies.filter((s) => s.status === "EXCLUDED").length,
            pending: studies.filter((s) => s.status === "PENDING").length,
        },
        studies,
    };

    return {
        data: Buffer.from(JSON.stringify(exportData, null, 2), "utf-8"),
        filename: `litlens-export-${projectId}-${Date.now()}.json`,
        contentType: "application/json",
    };
}

// ============== PRISMA FORMAT (Systematic Review Standard) ==============

/**
 * Generate PRISMA flow diagram data
 */
export async function generatePRISMAData(projectId: string) {
    const project = await db.project.findUnique({
        where: { id: projectId },
        include: {
            importBatches: true,
            projectWorks: {
                include: {
                    decisions: true,
                },
            },
        },
    });

    if (!project) throw new Error("Project not found");

    const works = project.projectWorks;
    const titleAbstractDecisions = works.filter((w) => w.phase === "TITLE_ABSTRACT");
    const fullTextDecisions = works.filter((w) => w.phase === "FULL_TEXT");

    // Count exclusion reasons
    const exclusionReasons: Record<string, number> = {};
    works
        .filter((w) => w.status === "EXCLUDED")
        .forEach((w) => {
            const reason = w.decisions[0]?.exclusionReason || "Not specified";
            exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1;
        });

    // Count included studies with extraction data
    const includedWithExtraction = await db.extractionData.count({
        where: {
            projectWork: {
                projectId,
                status: "INCLUDED",
            },
        },
    });

    return {
        identification: {
            databaseSearches: project.importBatches.length,
            recordsIdentified: works.length,
            duplicatesRemoved: works.filter((w) => w.duplicateOfId).length,
        },
        screening: {
            titleAbstract: {
                screened: titleAbstractDecisions.length,
                excluded: titleAbstractDecisions.filter((w) => w.status === "EXCLUDED").length,
            },
            fullText: {
                assessed: fullTextDecisions.length,
                excluded: fullTextDecisions.filter((w) => w.status === "EXCLUDED").length,
                exclusionReasons,
            },
        },
        included: {
            qualitativeAnalysis: works.filter((w) => w.status === "INCLUDED").length,
            quantitativeAnalysis: includedWithExtraction,
        },
    };
}

// ============== UTILITIES ==============

function escapeCSV(value: string): string {
    if (!value) return "";
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey));
        } else {
            flattened[newKey] = value;
        }
    }

    return flattened;
}
