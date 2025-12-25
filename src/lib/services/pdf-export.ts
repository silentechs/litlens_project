/**
 * PDF Export Service
 * 
 * Generates PDF reports for systematic review projects.
 * Uses jsPDF with autotable plugin for tables.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============== TYPES ==============

interface StudyData {
    id: string;
    title: string;
    authors: string;
    year: number | null;
    journal: string | null;
    status: string;
    decision: string | null;
    qualityScore: string | null;
}

interface PRISMAData {
    identification: {
        databaseSearches: number;
        recordsIdentified: number;
        duplicatesRemoved: number;
    };
    screening: {
        titleAbstract: {
            screened: number;
            excluded: number;
        };
        fullText: {
            assessed: number;
            excluded: number;
            exclusionReasons: Record<string, number>;
        };
    };
    included: {
        qualitativeAnalysis: number;
        quantitativeAnalysis: number;
    };
}

interface PDFExportOptions {
    projectTitle: string;
    projectDescription?: string;
    studies: StudyData[];
    prismaData?: PRISMAData;
    includeStudyList?: boolean;
    includePRISMA?: boolean;
    includeSummary?: boolean;
}

// ============== STYLES ==============

const COLORS = {
    ink: [26, 51, 32] as [number, number, number],
    paper: [245, 245, 240] as [number, number, number],
    muted: [107, 112, 92] as [number, number, number],
    accent: [79, 70, 229] as [number, number, number],
};

// ============== MAIN EXPORT FUNCTION ==============

export function generateProjectPDF(options: PDFExportOptions): Blob {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text("LitLens — Systematic Review Report", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(8);
    doc.text(new Date().toLocaleDateString(), pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(...COLORS.ink);
    const titleLines = doc.splitTextToSize(options.projectTitle, pageWidth - 40);
    doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
    yPos += titleLines.length * 10 + 10;

    // Description
    if (options.projectDescription) {
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.muted);
        const descLines = doc.splitTextToSize(options.projectDescription, pageWidth - 40);
        doc.text(descLines, 20, yPos);
        yPos += descLines.length * 5 + 15;
    }

    // Summary Section
    if (options.includeSummary !== false) {
        yPos = addSummarySection(doc, options, yPos);
    }

    // PRISMA Flow
    if (options.includePRISMA && options.prismaData) {
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }
        yPos = addPRISMASection(doc, options.prismaData, yPos);
    }

    // Study List
    if (options.includeStudyList !== false && options.studies.length > 0) {
        if (yPos > 150) {
            doc.addPage();
            yPos = 20;
        }
        addStudyTable(doc, options.studies, yPos);
    }

    return doc.output("blob");
}

// ============== SECTION BUILDERS ==============

function addSummarySection(doc: jsPDF, options: PDFExportOptions, yPos: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Section header
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.ink);
    doc.text("Summary Statistics", 20, yPos);
    yPos += 10;

    // Draw summary boxes
    const boxWidth = (pageWidth - 60) / 4;
    const boxHeight = 30;
    const startX = 20;

    const included = options.studies.filter(s => s.status === "INCLUDED").length;
    const excluded = options.studies.filter(s => s.status === "EXCLUDED").length;
    const pending = options.studies.filter(s => s.status === "PENDING").length;

    const stats = [
        { label: "Total", value: options.studies.length.toString() },
        { label: "Included", value: included.toString() },
        { label: "Excluded", value: excluded.toString() },
        { label: "Pending", value: pending.toString() },
    ];

    stats.forEach((stat, i) => {
        const x = startX + i * (boxWidth + 5);

        // Box background
        doc.setFillColor(...COLORS.paper);
        doc.rect(x, yPos, boxWidth, boxHeight, "F");
        doc.setDrawColor(...COLORS.muted);
        doc.rect(x, yPos, boxWidth, boxHeight, "S");

        // Value
        doc.setFontSize(18);
        doc.setTextColor(...COLORS.ink);
        doc.text(stat.value, x + boxWidth / 2, yPos + 15, { align: "center" });

        // Label
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text(stat.label, x + boxWidth / 2, yPos + 24, { align: "center" });
    });

    return yPos + boxHeight + 20;
}

function addPRISMASection(doc: jsPDF, prisma: PRISMAData, yPos: number): number {
    // Section header
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.ink);
    doc.text("PRISMA Flow Summary", 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);

    const lines = [
        `Identification: ${prisma.identification.recordsIdentified} records from ${prisma.identification.databaseSearches} databases`,
        `Duplicates removed: ${prisma.identification.duplicatesRemoved}`,
        `Title/Abstract screening: ${prisma.screening.titleAbstract.screened} screened, ${prisma.screening.titleAbstract.excluded} excluded`,
        `Full-text assessment: ${prisma.screening.fullText.assessed} assessed, ${prisma.screening.fullText.excluded} excluded`,
        `Final inclusion: ${prisma.included.qualitativeAnalysis} studies (${prisma.included.quantitativeAnalysis} in quantitative analysis)`,
    ];

    lines.forEach(line => {
        doc.text(`• ${line}`, 25, yPos);
        yPos += 6;
    });

    // Exclusion reasons
    if (Object.keys(prisma.screening.fullText.exclusionReasons).length > 0) {
        yPos += 5;
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.ink);
        doc.text("Exclusion Reasons:", 25, yPos);
        yPos += 6;

        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        Object.entries(prisma.screening.fullText.exclusionReasons).forEach(([reason, count]) => {
            doc.text(`  - ${reason}: ${count}`, 30, yPos);
            yPos += 5;
        });
    }

    return yPos + 15;
}

function addStudyTable(doc: jsPDF, studies: StudyData[], yPos: number): void {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.ink);
    doc.text("Included Studies", 20, yPos);

    const includedStudies = studies.filter(s => s.status === "INCLUDED");

    autoTable(doc, {
        startY: yPos + 5,
        head: [["Title", "Authors", "Year", "Journal", "Quality"]],
        body: includedStudies.map(s => [
            s.title.slice(0, 50) + (s.title.length > 50 ? "..." : ""),
            s.authors.slice(0, 30) + (s.authors.length > 30 ? "..." : ""),
            s.year?.toString() || "-",
            s.journal?.slice(0, 20) || "-",
            s.qualityScore || "-",
        ]),
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: COLORS.ink,
            textColor: [255, 255, 255],
            fontStyle: "bold",
        },
        alternateRowStyles: {
            fillColor: COLORS.paper,
        },
    });
}

// ============== UTILITY ==============

export function downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export default generateProjectPDF;
