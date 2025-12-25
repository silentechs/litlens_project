/**
 * Writing Projects Service
 * Handles writing assistance for systematic reviews
 */

import { db } from "@/lib/db";
import { WritingType, WritingStatus } from "@prisma/client";

// ============== TYPES ==============

export interface WritingContent {
  type: "doc";
  content: ContentNode[];
}

export interface ContentNode {
  type: string;
  content?: ContentNode[] | TextNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TextNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface WritingSource {
  id: string;
  workId: string;
  work: {
    title: string;
    authors: Array<{ name: string }>;
    year: number | null;
    journal: string | null;
    doi: string | null;
  };
  citationKey: string | null;
  notes: string | null;
}

export interface WritingStats {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  citationCount: number;
  readingTime: number; // minutes
}

// ============== WRITING PROJECT MANAGEMENT ==============

/**
 * Create a new writing project
 */
export async function createWritingProject(
  userId: string,
  data: {
    title: string;
    type: WritingType;
    projectId?: string;
    citationStyle?: string;
    targetLength?: number;
  }
): Promise<{ id: string }> {
  // Initialize with a basic document structure
  const initialContent: WritingContent = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: data.title }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Start writing here..." }],
      },
    ],
  };

  const project = await db.writingProject.create({
    data: {
      userId,
      projectId: data.projectId,
      title: data.title,
      type: data.type,
      content: initialContent as unknown as object,
      citationStyle: data.citationStyle || "APA",
      targetLength: data.targetLength,
      status: "DRAFT",
      wordCount: 0,
    },
    select: { id: true },
  });

  return project;
}

/**
 * Get writing project details
 */
export async function getWritingProject(
  projectId: string,
  userId: string
): Promise<{
  id: string;
  title: string;
  type: WritingType;
  content: WritingContent;
  citationStyle: string;
  targetLength: number | null;
  status: WritingStatus;
  wordCount: number;
  sources: WritingSource[];
  stats: WritingStats;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const project = await db.writingProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) return null;

  // Get sources separately
  const sources = await db.writingSource.findMany({
    where: { writingProjectId: projectId },
    include: {
      work: {
        select: {
          id: true,
          title: true,
          authors: true,
          year: true,
          journal: true,
          doi: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const content = project.content as unknown as WritingContent;
  const stats = calculateWritingStats(content, sources.length);

  return {
    id: project.id,
    title: project.title,
    type: project.type,
    content,
    citationStyle: project.citationStyle,
    targetLength: project.targetLength,
    status: project.status,
    wordCount: project.wordCount,
    sources: sources.map((s) => ({
      id: s.id,
      workId: s.workId,
      work: {
        title: s.work.title,
        authors: s.work.authors as Array<{ name: string }>,
        year: s.work.year,
        journal: s.work.journal,
        doi: s.work.doi,
      },
      citationKey: s.citationKey,
      notes: s.notes,
    })),
    stats,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Update writing project content
 */
export async function updateWritingContent(
  projectId: string,
  userId: string,
  content: WritingContent
): Promise<void> {
  const project = await db.writingProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  const wordCount = countWords(content);

  await db.writingProject.update({
    where: { id: projectId },
    data: {
      content: content as unknown as object,
      wordCount,
    },
  });
}

/**
 * Update writing project metadata
 */
export async function updateWritingProject(
  projectId: string,
  userId: string,
  updates: {
    title?: string;
    citationStyle?: string;
    targetLength?: number;
    status?: WritingStatus;
  }
): Promise<void> {
  const project = await db.writingProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  await db.writingProject.update({
    where: { id: projectId },
    data: updates,
  });
}

/**
 * Delete writing project
 */
export async function deleteWritingProject(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await db.writingProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  await db.writingProject.delete({ where: { id: projectId } });
}

/**
 * Get user's writing projects
 */
export async function getUserWritingProjects(
  userId: string,
  options: {
    type?: WritingType;
    status?: WritingStatus;
    projectId?: string;
  } = {}
): Promise<Array<{
  id: string;
  title: string;
  type: WritingType;
  status: WritingStatus;
  wordCount: number;
  targetLength: number | null;
  progress: number;
  updatedAt: Date;
}>> {
  const where: Record<string, unknown> = { userId };
  if (options.type) where.type = options.type;
  if (options.status) where.status = options.status;
  if (options.projectId) where.projectId = options.projectId;

  const projects = await db.writingProject.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      wordCount: true,
      targetLength: true,
      updatedAt: true,
    },
  });

  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    wordCount: p.wordCount,
    targetLength: p.targetLength,
    progress: p.targetLength ? Math.min(100, (p.wordCount / p.targetLength) * 100) : 0,
    updatedAt: p.updatedAt,
  }));
}

// ============== CITATION MANAGEMENT ==============

/**
 * Add a citation source
 */
export async function addCitationSource(
  writingProjectId: string,
  userId: string,
  workId: string
): Promise<{ id: string; citationKey: string | null }> {
  const project = await db.writingProject.findFirst({
    where: { id: writingProjectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  const work = await db.work.findUnique({
    where: { id: workId },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
    },
  });

  if (!work) {
    throw new Error("Work not found");
  }

  const authors = work.authors as Array<{ name: string }>;
  const citationKey = generateCitationKey(authors, work.year);

  const source = await db.writingSource.create({
    data: {
      writingProjectId,
      workId,
      citationKey,
    },
    select: { id: true, citationKey: true },
  });

  return source;
}

/**
 * Remove a citation source
 */
export async function removeCitationSource(
  writingProjectId: string,
  userId: string,
  sourceId: string
): Promise<void> {
  const project = await db.writingProject.findFirst({
    where: { id: writingProjectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  await db.writingSource.delete({ where: { id: sourceId } });
}

/**
 * Generate bibliography
 */
export async function generateBibliography(
  writingProjectId: string,
  userId: string
): Promise<string[]> {
  const project = await db.writingProject.findFirst({
    where: { id: writingProjectId, userId },
  });

  if (!project) {
    throw new Error("Writing project not found");
  }

  const sources = await db.writingSource.findMany({
    where: { writingProjectId },
    include: { work: true },
    orderBy: { createdAt: "asc" },
  });

  return sources.map((s) => {
    const authors = s.work.authors as Array<{ name: string }>;
    return formatCitation(
      {
        title: s.work.title,
        authors: s.work.authors,
        year: s.work.year,
        journal: s.work.journal,
        doi: s.work.doi,
      },
      project.citationStyle,
      authors
    );
  });
}

// ============== EXPORT ==============

/**
 * Export writing project to various formats
 */
export async function exportWritingProject(
  projectId: string,
  userId: string,
  format: "markdown" | "html" | "docx"
): Promise<string> {
  const project = await getWritingProject(projectId, userId);
  if (!project) {
    throw new Error("Writing project not found");
  }

  switch (format) {
    case "markdown":
      return exportToMarkdown(project.content, project.sources);
    case "html":
      return exportToHTML(project.content, project.sources);
    case "docx":
      throw new Error("DOCX export not yet implemented");
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

// ============== HELPERS ==============

function countWords(content: WritingContent): number {
  let count = 0;

  function countNode(node: ContentNode | TextNode) {
    if (node.type === "text" && "text" in node) {
      count += node.text.split(/\s+/).filter((w) => w.length > 0).length;
    }
    if ("content" in node && Array.isArray(node.content)) {
      (node.content as Array<ContentNode | TextNode>).forEach(countNode);
    }
  }

  content.content.forEach(countNode);
  return count;
}

function calculateWritingStats(content: WritingContent, citationCount: number): WritingStats {
  let wordCount = 0;
  let characterCount = 0;
  let paragraphCount = 0;

  function processNode(node: ContentNode | TextNode) {
    if (node.type === "text" && "text" in node) {
      const text = node.text;
      wordCount += text.split(/\s+/).filter((w) => w.length > 0).length;
      characterCount += text.length;
    }
    if (node.type === "paragraph") {
      paragraphCount++;
    }
    if ("content" in node && Array.isArray(node.content)) {
      (node.content as Array<ContentNode | TextNode>).forEach(processNode);
    }
  }

  content.content.forEach(processNode);

  return {
    wordCount,
    characterCount,
    paragraphCount,
    citationCount,
    readingTime: Math.ceil(wordCount / 200),
  };
}

function generateCitationKey(authors: Array<{ name: string }>, year: number | null): string {
  const firstAuthor = authors[0]?.name || "Unknown";
  const lastName = firstAuthor.split(" ").pop() || firstAuthor;
  return `${lastName}${year || "n.d."}`;
}

function formatCitation(
  work: {
    title: string;
    authors: unknown;
    year: number | null;
    journal: string | null;
    doi: string | null;
  },
  style: string,
  authors: Array<{ name: string }>
): string {
  const authorList = formatAuthors(authors, style);
  const year = work.year || "n.d.";
  
  switch (style.toUpperCase()) {
    case "APA":
      return `${authorList} (${year}). ${work.title}. ${work.journal || ""}.${work.doi ? ` https://doi.org/${work.doi}` : ""}`;
    case "MLA":
      return `${authorList}. "${work.title}." ${work.journal || ""}, ${year}.`;
    case "CHICAGO":
      return `${authorList}. "${work.title}." ${work.journal || ""} (${year}).`;
    case "VANCOUVER":
      return `${authorList}. ${work.title}. ${work.journal || ""}. ${year}.`;
    default:
      return `${authorList} (${year}). ${work.title}. ${work.journal || ""}`;
  }
}

function formatAuthors(authors: Array<{ name: string }>, style: string): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name} & ${authors[1].name}`;
  
  if (style.toUpperCase() === "APA") {
    if (authors.length <= 7) {
      const lastAuthor = authors[authors.length - 1].name;
      const otherAuthors = authors.slice(0, -1).map((a) => a.name).join(", ");
      return `${otherAuthors}, & ${lastAuthor}`;
    }
    const first6 = authors.slice(0, 6).map((a) => a.name).join(", ");
    return `${first6}, ... ${authors[authors.length - 1].name}`;
  }
  
  return `${authors[0].name} et al.`;
}

function exportToMarkdown(content: WritingContent, sources: WritingSource[]): string {
  let output = "";

  function processNode(node: ContentNode | TextNode): string {
    if (node.type === "text" && "text" in node) {
      let text = node.text;
      if (node.marks) {
        node.marks.forEach((mark) => {
          switch (mark.type) {
            case "bold":
              text = `**${text}**`;
              break;
            case "italic":
              text = `*${text}*`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
          }
        });
      }
      return text;
    }

    switch (node.type) {
      case "heading":
        const level = (node.attrs?.level as number) || 1;
        const headingText = (node.content as Array<ContentNode | TextNode>)?.map((c) => processNode(c)).join("") || "";
        return "#".repeat(level) + " " + headingText + "\n\n";
      
      case "paragraph":
        const paraText = (node.content as Array<ContentNode | TextNode>)?.map((c) => processNode(c)).join("") || "";
        return paraText + "\n\n";
      
      case "bulletList":
        return (node.content as ContentNode[])?.map((item) => {
          const itemText = (item.content as ContentNode[])?.map((c) => processNode(c)).join("").trim();
          return `- ${itemText}\n`;
        }).join("") + "\n";
      
      case "orderedList":
        return (node.content as ContentNode[])?.map((item, idx) => {
          const itemText = (item.content as ContentNode[])?.map((c) => processNode(c)).join("").trim();
          return `${idx + 1}. ${itemText}\n`;
        }).join("") + "\n";
      
      case "blockquote":
        const quoteText = (node.content as ContentNode[])?.map((c) => processNode(c)).join("").trim();
        return quoteText.split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
      
      default:
        if ("content" in node && Array.isArray(node.content)) {
          return (node.content as Array<ContentNode | TextNode>).map((c) => processNode(c)).join("");
        }
        return "";
    }
  }

  content.content.forEach((node) => {
    output += processNode(node);
  });

  // Add bibliography
  if (sources.length > 0) {
    output += "\n## References\n\n";
    sources.forEach((s) => {
      const authors = s.work.authors;
      const citation = formatCitation(s.work, "APA", authors);
      output += `- ${citation}\n`;
    });
  }

  return output;
}

function exportToHTML(content: WritingContent, sources: WritingSource[]): string {
  let output = "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"UTF-8\">\n<style>\nbody { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }\nh1, h2, h3 { font-family: Arial, sans-serif; }\nblockquote { border-left: 3px solid #ccc; padding-left: 16px; margin-left: 0; color: #666; }\n</style>\n</head>\n<body>\n";

  function processNode(node: ContentNode | TextNode): string {
    if (node.type === "text" && "text" in node) {
      let text = escapeHTML(node.text);
      if (node.marks) {
        node.marks.forEach((mark) => {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "code":
              text = `<code>${text}</code>`;
              break;
          }
        });
      }
      return text;
    }

    const children = "content" in node && Array.isArray(node.content)
      ? (node.content as Array<ContentNode | TextNode>).map(processNode).join("")
      : "";

    switch (node.type) {
      case "heading":
        const level = (node.attrs?.level as number) || 1;
        return `<h${level}>${children}</h${level}>\n`;
      case "paragraph":
        return `<p>${children}</p>\n`;
      case "bulletList":
        return `<ul>\n${children}</ul>\n`;
      case "orderedList":
        return `<ol>\n${children}</ol>\n`;
      case "listItem":
        return `<li>${children}</li>\n`;
      case "blockquote":
        return `<blockquote>${children}</blockquote>\n`;
      default:
        return children;
    }
  }

  content.content.forEach((node) => {
    output += processNode(node);
  });

  // Add bibliography
  if (sources.length > 0) {
    output += "\n<h2>References</h2>\n<ol>\n";
    sources.forEach((s) => {
      const citation = formatCitation(s.work, "APA", s.work.authors);
      output += `<li>${escapeHTML(citation)}</li>\n`;
    });
    output += "</ol>\n";
  }

  output += "</body>\n</html>";
  return output;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
