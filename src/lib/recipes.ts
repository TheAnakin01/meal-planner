// Fetches recipes from Spoonacular. Server-only: the API key must never reach the browser.
// See CLAUDE.md §4.3 (limits) and §5.4 (request).

import "server-only";
import {
  type Recipe,
  type RecipeSearch,
  SPOONACULAR_SEARCH_URL,
  buildSearchParams,
  parseSearchResponse,
} from "@/lib/spoonacular";

export type RecipeError =
  | "not_configured" // no API key set
  | "unauthorized" // 401: key wrong
  | "quota" // 402: 50 free points used up today
  | "rate_limited" // 429: too many requests at once
  | "unavailable"; // network problem or Spoonacular down

export type RecipeResult = { ok: true; recipes: Recipe[] } | { ok: false; error: RecipeError };

// Spoonacular allows caching for at most 1 hour.
const CACHE_SECONDS = 3600;

export async function searchRecipes(search: RecipeSearch): Promise<RecipeResult> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return { ok: false, error: "not_configured" };

  const params = buildSearchParams(search);
  params.set("apiKey", apiKey);

  let response: Response;
  try {
    response = await fetch(`${SPOONACULAR_SEARCH_URL}?${params}`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }

  if (!response.ok) {
    // Never log the URL: it contains the API key.
    console.error(`Spoonacular search failed for ${search.meal}: HTTP ${response.status}`);
    if (response.status === 401) return { ok: false, error: "unauthorized" };
    if (response.status === 402) return { ok: false, error: "quota" };
    if (response.status === 429) return { ok: false, error: "rate_limited" };
    return { ok: false, error: "unavailable" };
  }

  const body: unknown = await response.json().catch(() => null);
  return { ok: true, recipes: parseSearchResponse(body, search.target) };
}
