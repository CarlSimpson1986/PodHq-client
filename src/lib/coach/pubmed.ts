import "server-only";

// Real PubMed grounding for the AI Coach (2026-08-26) — replaces the
// earlier "ship it softened" choice (never cite a specific study,
// general-evidence framing only) flagged in the original redesign plan.
// Read-only, no API key required for this app's realistic volume: NCBI's
// E-utilities allow 3 requests/sec unauthenticated, 10/sec with a free
// API key — getting a key means Carl personally creating an NCBI account
// (real account creation, not something to do on his behalf), so this
// starts unauthenticated and only needs a key if usage ever justifies it.
// `tool`/`email` are NCBI's requested self-identification params, not a
// registration step — plain strings, no signup involved.
const PUBMED_TOOL_NAME = "myfitpod-ai-coach";
const PUBMED_CONTACT_EMAIL = "hello@myfitpod.co.uk";
const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export interface PubMedResult {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  abstract: string;
}

interface EsearchResponse {
  esearchresult?: { idlist?: string[] };
}

interface EsummaryDocSummary {
  title?: string;
  authors?: { name: string }[];
  pubdate?: string;
  source?: string;
}

interface EsummaryResponse {
  result?: Record<string, EsummaryDocSummary | undefined>;
}

function formatAuthors(authors: { name: string }[] | undefined): string {
  if (!authors || authors.length === 0) return "Unknown authors";
  if (authors.length === 1) return authors[0].name;
  if (authors.length === 2) return `${authors[0].name} & ${authors[1].name}`;
  return `${authors[0].name} et al.`;
}

function extractYear(pubdate: string | undefined): string {
  const match = pubdate?.match(/\d{4}/);
  return match ? match[0] : "";
}

// efetch's abstract rettype returns plain text, not JSON — one request
// for every id in the same call rather than one per id, same batching
// esummary already does.
async function fetchAbstracts(pmids: string[]): Promise<Map<string, string>> {
  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    rettype: "abstract",
    retmode: "text",
    tool: PUBMED_TOOL_NAME,
    email: PUBMED_CONTACT_EMAIL,
  });
  const res = await fetch(`${EUTILS_BASE}/efetch.fcgi?${params}`);
  if (!res.ok) return new Map();

  const text = await res.text();
  // efetch's plain-text abstract format separates records with blank
  // lines and numbers each "1. Title..." — split on the numbered-record
  // pattern rather than trying to parse it as structured data, since
  // NCBI doesn't offer a JSON abstract format.
  const records = text.split(/\n\d+\.\s/).filter((r) => r.trim());
  const byPmid = new Map<string, string>();
  records.forEach((record, i) => {
    const pmidMatch = record.match(/PMID:\s*(\d+)/);
    const pmid = pmidMatch ? pmidMatch[1] : pmids[i];
    // Trims to keep the model's context budget reasonable — a full
    // abstract is rarely needed to ground a 2-3 sentence coaching answer.
    byPmid.set(pmid, record.trim().slice(0, 800));
  });
  return byPmid;
}

// PubMed's own "relevance" sort is plain term-matching — it has no
// concept of evidence quality, so a narrow single-study paper that
// happens to share vocabulary with the query can outrank a review that's
// actually a better source for a general coaching claim. Found live
// 2026-08-26: "hypertrophy rep range muscle building meta analysis"
// surfaced a muscle-measurement methodology paper, not a rep-range
// outcome study — technically on-topic by keyword, useless for citing.
//
// Two-tier search: try filtered to secondary/synthesized evidence first
// (meta-analyses, systematic reviews, and — since exercise science has
// fewer RCTs than medicine generally — RCTs too), which is both more
// likely to directly support a general claim and less likely to be one
// narrow/atypical study. Only fall back to an unfiltered search if that
// returns nothing, so a niche topic with no reviews yet doesn't come back
// empty when a real primary study exists.
const EVIDENCE_FILTER = "(meta-analysis[pt] OR systematic review[pt] OR randomized controlled trial[pt])";

async function esearch(term: string, maxResults: number): Promise<string[]> {
  const searchParams = new URLSearchParams({
    db: "pubmed",
    term,
    retmax: String(maxResults),
    sort: "relevance",
    retmode: "json",
    tool: PUBMED_TOOL_NAME,
    email: PUBMED_CONTACT_EMAIL,
  });
  const searchRes = await fetch(`${EUTILS_BASE}/esearch.fcgi?${searchParams}`);
  if (!searchRes.ok) {
    console.error("[pubmed] esearch failed", { status: searchRes.status });
    return [];
  }
  const searchData = (await searchRes.json()) as EsearchResponse;
  return searchData.esearchresult?.idlist ?? [];
}

/**
 * Top matches for a research query, title/authors/year/journal/abstract
 * for each — enough for the model to cite accurately without needing to
 * fabricate details esearch/esummary don't return. Empty array (not an
 * error) when nothing relevant is found, so the caller can fall back to
 * general-evidence framing exactly as before this feature existed.
 */
export async function searchPubMed(query: string, maxResults = 5): Promise<PubMedResult[]> {
  let pmids = await esearch(`${query} AND ${EVIDENCE_FILTER}`, maxResults);
  if (pmids.length === 0) {
    pmids = await esearch(query, maxResults);
  }
  if (pmids.length === 0) return [];

  const summaryParams = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
    tool: PUBMED_TOOL_NAME,
    email: PUBMED_CONTACT_EMAIL,
  });

  const [summaryRes, abstracts] = await Promise.all([fetch(`${EUTILS_BASE}/esummary.fcgi?${summaryParams}`), fetchAbstracts(pmids)]);

  if (!summaryRes.ok) {
    console.error("[pubmed] esummary failed", { status: summaryRes.status });
    return [];
  }
  const summaryData = (await summaryRes.json()) as EsummaryResponse;

  return pmids.map((pmid) => {
    const doc = summaryData.result?.[pmid];
    return {
      pmid,
      title: doc?.title ?? "Untitled",
      authors: formatAuthors(doc?.authors),
      year: extractYear(doc?.pubdate),
      journal: doc?.source ?? "",
      abstract: abstracts.get(pmid) ?? "No abstract available.",
    };
  });
}

/** Formats results as tool-call output text for the model — same shape regardless of provider. */
export function formatPubMedResultsForModel(results: PubMedResult[]): string {
  if (results.length === 0) {
    return "No relevant PubMed results found. Answer using general evidence-based framing instead — do not invent a citation.";
  }
  return results
    .map((r) => `[PMID ${r.pmid}] ${r.authors} (${r.year}). "${r.title}" ${r.journal}.\nAbstract: ${r.abstract}`)
    .join("\n\n");
}
