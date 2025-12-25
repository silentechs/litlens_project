import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
} from "@/lib/api";
import { externalSearchSchema } from "@/lib/validators";
import type { WorkSearchResult } from "@/types/work";

// GET /api/search/external - Search external databases (OpenAlex, PubMed, Crossref)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;

    const params = externalSearchSchema.parse({
      query: searchParams.get("query"),
      sources: searchParams.getAll("sources").length > 0
        ? searchParams.getAll("sources")
        : ["openalex"],
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      filters: {
        yearFrom: searchParams.get("yearFrom") || undefined,
        yearTo: searchParams.get("yearTo") || undefined,
        type: searchParams.get("type") || undefined,
        openAccess: searchParams.get("openAccess") === "true" ? true : undefined,
      },
    });

    // Fetch from multiple sources in parallel
    const results: WorkSearchResult[] = [];
    const errors: { source: string; error: string }[] = [];

    const searchPromises = params.sources.map(async (source) => {
      try {
        switch (source) {
          case "openalex":
            return await searchOpenAlex(params);
          case "pubmed":
            return await searchPubMed(params);
          case "crossref":
            return await searchCrossref(params);
          default:
            return [];
        }
      } catch (error) {
        errors.push({
          source,
          error: error instanceof Error ? error.message : "Search failed"
        });
        return [];
      }
    });

    const searchResults = await Promise.all(searchPromises);
    searchResults.forEach((r) => results.push(...r));

    // Sort by relevance score descending
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    return success({
      items: results.slice(0, params.limit),
      total: results.length,
      sources: params.sources,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ============== OPENALEX ==============

interface OpenAlexParams {
  query: string;
  page: number;
  limit: number;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    type?: string;
    openAccess?: boolean;
  };
}

async function searchOpenAlex(params: OpenAlexParams): Promise<WorkSearchResult[]> {
  const email = process.env.OPENALEX_EMAIL || "user@example.com";
  const baseUrl = "https://api.openalex.org/works";

  // Build filter string
  const filters: string[] = [];
  if (params.filters?.yearFrom) {
    filters.push(`from_publication_date:${params.filters.yearFrom}-01-01`);
  }
  if (params.filters?.yearTo) {
    filters.push(`to_publication_date:${params.filters.yearTo}-12-31`);
  }
  if (params.filters?.openAccess) {
    filters.push("is_oa:true");
  }

  const searchParams = new URLSearchParams({
    search: params.query,
    page: params.page.toString(),
    per_page: params.limit.toString(),
    mailto: email,
  });

  if (filters.length > 0) {
    searchParams.set("filter", filters.join(","));
  }

  const response = await fetch(`${baseUrl}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status}`);
  }

  const data = await response.json();

  return data.results.map((work: OpenAlexWork): WorkSearchResult => ({
    id: work.id,
    title: work.display_name || work.title,
    authors: (work.authorships || []).map((a: OpenAlexAuthorship) => ({
      name: a.author.display_name,
      orcid: a.author.orcid,
    })),
    abstract: work.abstract_inverted_index
      ? reconstructAbstract(work.abstract_inverted_index)
      : null,
    year: work.publication_year,
    journal: work.primary_location?.source?.display_name || null,
    doi: work.doi?.replace("https://doi.org/", "") || null,
    pmid: work.ids?.pmid?.replace("https://pubmed.ncbi.nlm.nih.gov/", "") || null,
    url: work.doi || work.id,
    citationCount: work.cited_by_count || 0,
    source: "openalex",
    relevanceScore: work.relevance_score,
  }));
}

// Helper to reconstruct abstract from inverted index
function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const wordPositions: [string, number][] = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push([word, pos]);
    }
  }

  wordPositions.sort((a, b) => a[1] - b[1]);
  return wordPositions.map(([word]) => word).join(" ");
}

// OpenAlex types
interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string;
  display_name: string;
  publication_year: number;
  authorships: OpenAlexAuthorship[];
  primary_location: { source?: { display_name: string } } | null;
  abstract_inverted_index?: Record<string, number[]>;
  ids: { pmid?: string };
  cited_by_count: number;
  relevance_score?: number;
}

interface OpenAlexAuthorship {
  author: { display_name: string; orcid?: string };
}

// ============== PUBMED ==============

async function searchPubMed(params: OpenAlexParams): Promise<WorkSearchResult[]> {
  const apiKey = process.env.NCBI_API_KEY;
  const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

  // First, search for IDs
  const searchUrl = new URL(`${baseUrl}/esearch.fcgi`);
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("term", params.query);
  searchUrl.searchParams.set("retmax", params.limit.toString());
  searchUrl.searchParams.set("retmode", "json");
  if (apiKey) searchUrl.searchParams.set("api_key", apiKey);

  // Add date filter
  if (params.filters?.yearFrom) {
    searchUrl.searchParams.set("mindate", `${params.filters.yearFrom}/01/01`);
  }
  if (params.filters?.yearTo) {
    searchUrl.searchParams.set("maxdate", `${params.filters.yearTo}/12/31`);
  }

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) {
    throw new Error(`PubMed search error: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  const ids = searchData.esearchresult?.idlist || [];

  if (ids.length === 0) {
    return [];
  }

  // Fetch summaries for the IDs
  const summaryUrl = new URL(`${baseUrl}/esummary.fcgi`);
  summaryUrl.searchParams.set("db", "pubmed");
  summaryUrl.searchParams.set("id", ids.join(","));
  summaryUrl.searchParams.set("retmode", "json");
  if (apiKey) summaryUrl.searchParams.set("api_key", apiKey);

  const summaryResponse = await fetch(summaryUrl.toString());
  if (!summaryResponse.ok) {
    throw new Error(`PubMed summary error: ${summaryResponse.status}`);
  }

  const summaryData = await summaryResponse.json();
  const results = summaryData.result || {};

  return ids.map((id: string): WorkSearchResult | null => {
    const article = results[id];
    if (!article) return null;

    return {
      id: `pubmed:${id}`,
      title: article.title || "",
      authors: (article.authors || []).map((a: { name: string }) => ({
        name: a.name,
      })),
      abstract: null, // Summary doesn't include abstract
      year: article.pubdate ? parseInt(article.pubdate.split(" ")[0]) : null,
      journal: article.fulljournalname || article.source || null,
      doi: article.elocationid?.replace("doi: ", "") || null,
      pmid: id,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      citationCount: 0,
      source: "pubmed",
    };
  }).filter(Boolean) as WorkSearchResult[];
}

// ============== CROSSREF ==============

async function searchCrossref(params: OpenAlexParams): Promise<WorkSearchResult[]> {
  const mailto = process.env.CROSSREF_MAILTO || "user@example.com";
  const baseUrl = "https://api.crossref.org/works";

  const searchParams = new URLSearchParams({
    query: params.query,
    rows: params.limit.toString(),
    offset: ((params.page - 1) * params.limit).toString(),
    mailto,
  });

  // Add date filter
  if (params.filters?.yearFrom || params.filters?.yearTo) {
    const from = params.filters.yearFrom || 1900;
    const to = params.filters.yearTo || new Date().getFullYear();
    searchParams.set("filter", `from-pub-date:${from},until-pub-date:${to}`);
  }

  const response = await fetch(`${baseUrl}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Crossref API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.message?.items || []).map((work: CrossrefWork): WorkSearchResult => ({
    id: `crossref:${work.DOI}`,
    title: work.title?.[0] || "",
    authors: (work.author || []).map((a) => ({
      name: `${a.given || ""} ${a.family || ""}`.trim(),
      orcid: a.ORCID,
    })),
    abstract: work.abstract || null,
    year: work.published?.["date-parts"]?.[0]?.[0] || null,
    journal: work["container-title"]?.[0] || null,
    doi: work.DOI,
    pmid: null,
    url: `https://doi.org/${work.DOI}`,
    citationCount: work["is-referenced-by-count"] || 0,
    source: "crossref",
    relevanceScore: work.score,
  }));
}

// Crossref types
interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: { given?: string; family?: string; ORCID?: string }[];
  "container-title"?: string[];
  published?: { "date-parts": number[][] };
  abstract?: string;
  "is-referenced-by-count"?: number;
  score?: number;
}

