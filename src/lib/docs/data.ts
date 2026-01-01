import { screeningWorkflowsContent } from "./content/screening-workflows";

export interface DocPage {
    slug: string;
    title: string;
    category: string;
    summary: string;
    content: string;
}

export const DOCS: DocPage[] = [
    {
        slug: "screening-workflows",
        title: "Screening Workflows",
        category: "Workflows",
        summary: "Visual guide to the screening state machine, phase progression, and conflict resolution logic.",
        content: screeningWorkflowsContent,
    },
    // Future docs can be added here
];

export function getDocBySlug(slug: string): DocPage | undefined {
    return DOCS.find((doc) => doc.slug === slug);
}

export const DOC_CATEGORIES = Array.from(new Set(DOCS.map(d => d.category)));
