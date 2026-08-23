import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FoodLogSource } from "@/lib/coach/types";

export interface FoodSearchResult {
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: FoodLogSource;
}

// Open Food Facts expects an identifiable app, not an anonymous client —
// Carl picks the real contact string via this env var; falls back to an
// honest placeholder rather than fabricating one.
const OPEN_FOOD_FACTS_CONTACT = process.env.OPEN_FOOD_FACTS_CONTACT || "contact not configured";
const USER_AGENT = `MyFitPod PWA - Version 1.0 - ${OPEN_FOOD_FACTS_CONTACT}`;

const SEARCH_RESULT_LIMIT = 20;

// Server-side cache for Open Food Facts search results — their search
// endpoint is capped at 10 req/min as a shared budget for the whole app,
// not per member (see ROADMAP.md's Stage 7 entry). 24h TTL: product
// macros don't change day to day. This is an in-memory Map, which gives
// weaker real-world hit rates than it looks like on Vercel's per-instance
// serverless model — if 429s/503s show up in logs during live
// verification, the documented next step is a Supabase-backed cache
// table, not a bigger map.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, { results: FoodSearchResult[]; expiresAt: number }>();

function getCached(key: string): FoodSearchResult[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.results;
}

function setCached(key: string, results: FoodSearchResult[]) {
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
}

// UK generic foods first (CoFID, imported locally — no rate limit, no
// third-party dependency), falling back to Open Food Facts' search only
// if that returns nothing. See 0052_uk_food_composition.sql.
async function searchUkFoodComposition(query: string): Promise<FoodSearchResult[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("uk_food_composition")
    .select("food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .ilike("food_name", `%${query}%`)
    .limit(SEARCH_RESULT_LIMIT);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    name: row.food_name,
    brand: null,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    source: "uk_food_composition" as const,
  }));
}

interface OpenFoodFactsNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: OpenFoodFactsNutriments;
}

function mapOpenFoodFactsProduct(product: OpenFoodFactsProduct, source: FoodLogSource): FoodSearchResult | null {
  const kcal = product.nutriments?.["energy-kcal_100g"];
  const protein = product.nutriments?.proteins_100g;
  const carbs = product.nutriments?.carbohydrates_100g;
  const fat = product.nutriments?.fat_100g;
  if (!product.product_name || kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null;
  }
  return {
    name: product.product_name,
    brand: product.brands?.split(",")[0]?.trim() || null,
    caloriesPer100g: kcal,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
    source,
  };
}

async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(SEARCH_RESULT_LIMIT));
  url.searchParams.set("fields", "product_name,brands,nutriments");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts search failed: ${res.status}`);

  const body = (await res.json()) as { products?: OpenFoodFactsProduct[] };
  return (body.products ?? [])
    .map((p) => mapOpenFoodFactsProduct(p, "open_food_facts_search"))
    .filter((r): r is FoodSearchResult => r !== null);
}

export async function searchFood(query: string): Promise<FoodSearchResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ukResults = await searchUkFoodComposition(cacheKey);
  const results = ukResults.length > 0 ? ukResults : await searchOpenFoodFacts(cacheKey);

  setCached(cacheKey, results);
  return results;
}

// Direct product lookup, not a search — doesn't touch Open Food Facts'
// rate-limited search endpoint at all. Used by barcode scanning.
export async function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts lookup failed: ${res.status}`);

  const body = (await res.json()) as { status?: number; product?: OpenFoodFactsProduct };
  if (body.status !== 1 || !body.product) return null;

  return mapOpenFoodFactsProduct(body.product, "open_food_facts_barcode");
}
