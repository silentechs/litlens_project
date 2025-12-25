/**
 * PRISMA Flow Diagram Generation Service
 * Generates PRISMA 2020 compliant flow diagrams
 */

import { db } from "@/lib/db";
import { ScreeningPhase, ProjectWorkStatus } from "@prisma/client";

// ============== TYPES ==============

export interface PRISMAFlowData {
  // Identification
  identification: {
    databases: PRISMADatabase[];
    totalFromDatabases: number;
    registers: PRISMARegister[];
    totalFromRegisters: number;
    otherMethods: PRISMAOtherSource[];
    totalFromOther: number;
  };
  
  // Duplicates
  duplicatesRemoved: number;
  automatedRemoved: number;
  otherReasonsRemoved: number;
  
  // Screening
  screening: {
    titleAbstract: {
      screened: number;
      excluded: number;
      reasons: PRISMAExclusionReason[];
    };
    fullText: {
      soughtForRetrieval: number;
      notRetrieved: number;
      notRetrievedReasons: string[];
      assessed: number;
      excluded: number;
      reasons: PRISMAExclusionReason[];
    };
  };
  
  // Included
  included: {
    newStudies: number;
    previousStudies: number;
    totalStudies: number;
    totalReports: number;
  };
  
  // Metadata
  reviewType: "NEW" | "UPDATE";
  generatedAt: Date;
}

export interface PRISMADatabase {
  name: string;
  recordsIdentified: number;
  searchDate?: Date;
}

export interface PRISMARegister {
  name: string;
  recordsIdentified: number;
}

export interface PRISMAOtherSource {
  type: "citation_searching" | "reference_lists" | "expert_consultation" | "other";
  description: string;
  recordsIdentified: number;
}

export interface PRISMAExclusionReason {
  reason: string;
  count: number;
}

export interface PRISMAChecklist {
  section: string;
  item: number;
  description: string;
  completed: boolean;
  pageNumbers?: string;
  notes?: string;
}

// ============== PRISMA FLOW GENERATION ==============

/**
 * Generate PRISMA flow data for a project
 */
export async function generatePRISMAFlow(projectId: string): Promise<PRISMAFlowData> {
  // Get import batches for identification
  const importBatches = await db.importBatch.findMany({
    where: { projectId },
    select: {
      filename: true,
      totalRecords: true,
      duplicatesFound: true,
      createdAt: true,
    },
  });

  // Build databases list from import batches
  const databases: PRISMADatabase[] = importBatches.map((batch) => ({
    name: extractDatabaseName(batch.filename),
    recordsIdentified: batch.totalRecords || 0,
    searchDate: batch.createdAt,
  }));

  const totalFromDatabases = databases.reduce((sum, d) => sum + d.recordsIdentified, 0);
  const duplicatesRemoved = importBatches.reduce((sum, b) => sum + (b.duplicatesFound || 0), 0);

  // Get screening statistics
  const [
    titleAbstractTotal,
    titleAbstractExcluded,
    fullTextTotal,
    fullTextExcluded,
    includedTotal,
  ] = await Promise.all([
    db.projectWork.count({
      where: { projectId },
    }),
    db.projectWork.count({
      where: { projectId, phase: ScreeningPhase.TITLE_ABSTRACT, status: ProjectWorkStatus.EXCLUDED },
    }),
    db.projectWork.count({
      where: { projectId, phase: ScreeningPhase.FULL_TEXT },
    }),
    db.projectWork.count({
      where: { projectId, phase: ScreeningPhase.FULL_TEXT, status: ProjectWorkStatus.EXCLUDED },
    }),
    db.projectWork.count({
      where: { projectId, status: ProjectWorkStatus.INCLUDED },
    }),
  ]);

  // Get exclusion reasons
  const taExclusionReasons = await getExclusionReasons(projectId, ScreeningPhase.TITLE_ABSTRACT);
  const ftExclusionReasons = await getExclusionReasons(projectId, ScreeningPhase.FULL_TEXT);

  return {
    identification: {
      databases,
      totalFromDatabases,
      registers: [],
      totalFromRegisters: 0,
      otherMethods: [],
      totalFromOther: 0,
    },
    duplicatesRemoved,
    automatedRemoved: 0,
    otherReasonsRemoved: 0,
    screening: {
      titleAbstract: {
        screened: titleAbstractTotal - duplicatesRemoved,
        excluded: titleAbstractExcluded,
        reasons: taExclusionReasons,
      },
      fullText: {
        soughtForRetrieval: fullTextTotal + fullTextExcluded,
        notRetrieved: 0, // Would need PDF retrieval tracking
        notRetrievedReasons: [],
        assessed: fullTextTotal,
        excluded: fullTextExcluded,
        reasons: ftExclusionReasons,
      },
    },
    included: {
      newStudies: includedTotal,
      previousStudies: 0, // For review updates
      totalStudies: includedTotal,
      totalReports: includedTotal, // Assumes 1 report per study
    },
    reviewType: "NEW",
    generatedAt: new Date(),
  };
}

/**
 * Get exclusion reasons grouped by count
 */
async function getExclusionReasons(
  projectId: string,
  phase: ScreeningPhase
): Promise<PRISMAExclusionReason[]> {
  const reasons = await db.screeningDecisionRecord.groupBy({
    by: ["exclusionReason"],
    where: {
      projectWork: { projectId },
      phase,
      decision: "EXCLUDE",
      exclusionReason: { not: null },
    },
    _count: true,
  });

  return reasons
    .filter((r) => r.exclusionReason)
    .map((r) => ({
      reason: r.exclusionReason!,
      count: r._count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate PRISMA flow diagram as SVG
 */
export function generatePRISMASVG(data: PRISMAFlowData): string {
  const width = 800;
  const height = 1000;
  const boxWidth = 200;
  const boxHeight = 60;
  const padding = 20;

  // Helper to create a box
  const box = (x: number, y: number, text: string, subtext: string, color = "#e5e7eb") => `
    <g transform="translate(${x}, ${y})">
      <rect width="${boxWidth}" height="${boxHeight}" rx="4" fill="${color}" stroke="#9ca3af" stroke-width="1"/>
      <text x="${boxWidth / 2}" y="25" text-anchor="middle" font-size="12" font-weight="bold">${text}</text>
      <text x="${boxWidth / 2}" y="45" text-anchor="middle" font-size="11" fill="#4b5563">${subtext}</text>
    </g>
  `;

  // Helper to create an arrow
  const arrow = (x1: number, y1: number, x2: number, y2: number) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9ca3af" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  `;

  const totalIdentified = data.identification.totalFromDatabases + 
    data.identification.totalFromRegisters + 
    data.identification.totalFromOther;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af"/>
    </marker>
  </defs>
  
  <!-- Background sections -->
  <rect x="0" y="0" width="${width}" height="150" fill="#fef3c7" opacity="0.5"/>
  <text x="20" y="30" font-size="14" font-weight="bold" fill="#92400e">Identification</text>
  
  <rect x="0" y="150" width="${width}" height="350" fill="#dbeafe" opacity="0.5"/>
  <text x="20" y="180" font-size="14" font-weight="bold" fill="#1e40af">Screening</text>
  
  <rect x="0" y="500" width="${width}" height="200" fill="#dcfce7" opacity="0.5"/>
  <text x="20" y="530" font-size="14" font-weight="bold" fill="#166534">Included</text>

  <!-- Identification -->
  ${box(50, 50, "Records identified", `(n = ${totalIdentified})`, "#fef3c7")}
  ${box(300, 50, "Duplicates removed", `(n = ${data.duplicatesRemoved})`, "#fee2e2")}
  
  ${arrow(150, 110, 150, 200)}
  ${arrow(250, 80, 300, 80)}

  <!-- Screening - Title/Abstract -->
  ${box(50, 200, "Records screened", `(n = ${data.screening.titleAbstract.screened})`, "#dbeafe")}
  ${box(300, 200, "Records excluded", `(n = ${data.screening.titleAbstract.excluded})`, "#fee2e2")}
  
  ${arrow(150, 260, 150, 320)}
  ${arrow(250, 230, 300, 230)}

  <!-- Screening - Full Text -->
  ${box(50, 320, "Reports sought", `(n = ${data.screening.fullText.soughtForRetrieval})`, "#dbeafe")}
  ${box(300, 320, "Not retrieved", `(n = ${data.screening.fullText.notRetrieved})`, "#fee2e2")}
  
  ${arrow(150, 380, 150, 420)}
  ${arrow(250, 350, 300, 350)}

  ${box(50, 420, "Reports assessed", `(n = ${data.screening.fullText.assessed})`, "#dbeafe")}
  ${box(300, 420, "Reports excluded", `(n = ${data.screening.fullText.excluded})`, "#fee2e2")}
  
  ${arrow(150, 480, 150, 550)}
  ${arrow(250, 450, 300, 450)}

  <!-- Exclusion reasons -->
  <g transform="translate(520, 420)">
    <text font-size="10" font-weight="bold">Exclusion reasons:</text>
    ${data.screening.fullText.reasons.slice(0, 5).map((r, i) => 
      `<text y="${20 + i * 15}" font-size="9">${r.reason} (n=${r.count})</text>`
    ).join("")}
  </g>

  <!-- Included -->
  ${box(50, 550, "Studies included", `(n = ${data.included.totalStudies})`, "#dcfce7")}
  ${box(50, 630, "Reports included", `(n = ${data.included.totalReports})`, "#dcfce7")}
  
  ${arrow(150, 610, 150, 630)}

  <!-- Footer -->
  <text x="${width / 2}" y="${height - 20}" text-anchor="middle" font-size="10" fill="#6b7280">
    Generated: ${data.generatedAt.toISOString().split("T")[0]} | PRISMA 2020 Flow Diagram
  </text>
</svg>`;

  return svg;
}

/**
 * Generate PRISMA checklist
 */
export function getPRISMAChecklist(): PRISMAChecklist[] {
  return [
    // Title
    { section: "Title", item: 1, description: "Identify the report as a systematic review", completed: false },
    
    // Abstract
    { section: "Abstract", item: 2, description: "Provide a structured summary including background, objectives, data sources, study eligibility criteria, participants, interventions, study appraisal and synthesis methods, results, limitations, conclusions and implications of key findings", completed: false },
    
    // Introduction
    { section: "Introduction", item: 3, description: "Describe the rationale for the review in the context of existing knowledge", completed: false },
    { section: "Introduction", item: 4, description: "Provide an explicit statement of the objective(s) or question(s) the review addresses", completed: false },
    
    // Methods
    { section: "Methods", item: 5, description: "Indicate whether a review protocol exists, where it can be accessed, and provide registration information", completed: false },
    { section: "Methods", item: 6, description: "Specify characteristics of the studies and reports to be included", completed: false },
    { section: "Methods", item: 7, description: "Describe all information sources searched or consulted", completed: false },
    { section: "Methods", item: 8, description: "Present the full search strategies for all databases, registers and websites", completed: false },
    { section: "Methods", item: 9, description: "Specify the methods used to decide whether a study met the inclusion criteria", completed: false },
    { section: "Methods", item: 10, description: "Specify the methods used to collect data from reports", completed: false },
    { section: "Methods", item: 11, description: "List and define all outcomes for which data were sought", completed: false },
    { section: "Methods", item: 12, description: "Specify the methods used to assess risk of bias in included studies", completed: false },
    { section: "Methods", item: 13, description: "Specify any methods used to assess certainty in the body of evidence", completed: false },
    
    // Results
    { section: "Results", item: 14, description: "Describe the results of the search and selection process", completed: false },
    { section: "Results", item: 15, description: "Cite each included study and present its characteristics", completed: false },
    { section: "Results", item: 16, description: "Present the assessment of risk of bias for each included study", completed: false },
    { section: "Results", item: 17, description: "Present results of all statistical syntheses conducted", completed: false },
    
    // Discussion
    { section: "Discussion", item: 18, description: "Discuss limitations of the evidence and of the review process", completed: false },
    { section: "Discussion", item: 19, description: "Provide a general interpretation of results in the context of other evidence", completed: false },
    { section: "Discussion", item: 20, description: "Discuss implications for practice, policy, and future research", completed: false },
    
    // Other
    { section: "Other", item: 21, description: "Describe sources of funding and any conflicts of interest", completed: false },
    { section: "Other", item: 22, description: "Provide information about data, code and other materials availability", completed: false },
  ];
}

/**
 * Export PRISMA flow as various formats
 */
export async function exportPRISMAFlow(
  projectId: string,
  format: "svg" | "json" | "markdown"
): Promise<string> {
  const data = await generatePRISMAFlow(projectId);

  switch (format) {
    case "svg":
      return generatePRISMASVG(data);
    
    case "json":
      return JSON.stringify(data, null, 2);
    
    case "markdown":
      return generatePRISMAMarkdown(data);
    
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function generatePRISMAMarkdown(data: PRISMAFlowData): string {
  const totalIdentified = data.identification.totalFromDatabases + 
    data.identification.totalFromRegisters + 
    data.identification.totalFromOther;

  return `# PRISMA 2020 Flow Diagram

## Identification

**Records identified from databases (n = ${data.identification.totalFromDatabases})**
${data.identification.databases.map(d => `- ${d.name}: ${d.recordsIdentified}`).join("\n")}

**Records identified from registers (n = ${data.identification.totalFromRegisters})**
${data.identification.registers.map(r => `- ${r.name}: ${r.recordsIdentified}`).join("\n") || "None"}

**Records identified from other methods (n = ${data.identification.totalFromOther})**
${data.identification.otherMethods.map(o => `- ${o.description}: ${o.recordsIdentified}`).join("\n") || "None"}

---

## Screening

### Duplicate Removal
- Duplicates removed: ${data.duplicatesRemoved}
- Records removed by automation tools: ${data.automatedRemoved}
- Records removed for other reasons: ${data.otherReasonsRemoved}

### Title and Abstract Screening
- Records screened: ${data.screening.titleAbstract.screened}
- Records excluded: ${data.screening.titleAbstract.excluded}

**Exclusion reasons:**
${data.screening.titleAbstract.reasons.map(r => `- ${r.reason}: ${r.count}`).join("\n") || "Not specified"}

### Full-Text Screening
- Reports sought for retrieval: ${data.screening.fullText.soughtForRetrieval}
- Reports not retrieved: ${data.screening.fullText.notRetrieved}
- Reports assessed for eligibility: ${data.screening.fullText.assessed}
- Reports excluded: ${data.screening.fullText.excluded}

**Exclusion reasons:**
${data.screening.fullText.reasons.map(r => `- ${r.reason}: ${r.count}`).join("\n") || "Not specified"}

---

## Included

- New studies included in review: ${data.included.newStudies}
- Previous studies included (if update): ${data.included.previousStudies}
- **Total studies included: ${data.included.totalStudies}**
- Total reports of included studies: ${data.included.totalReports}

---

*Generated: ${data.generatedAt.toISOString().split("T")[0]}*
`;
}

// ============== HELPERS ==============

function extractDatabaseName(filename: string): string {
  // Try to extract database name from filename
  const lower = filename.toLowerCase();
  
  if (lower.includes("pubmed")) return "PubMed";
  if (lower.includes("medline")) return "MEDLINE";
  if (lower.includes("embase")) return "Embase";
  if (lower.includes("cochrane")) return "Cochrane Library";
  if (lower.includes("cinahl")) return "CINAHL";
  if (lower.includes("scopus")) return "Scopus";
  if (lower.includes("web of science") || lower.includes("wos")) return "Web of Science";
  if (lower.includes("psycinfo")) return "PsycINFO";
  if (lower.includes("ovid")) return "Ovid";
  
  // Return filename without extension
  return filename.replace(/\.[^/.]+$/, "");
}

