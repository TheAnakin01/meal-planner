// Calls USDA FoodData Central. Server-only: the key must never reach the browser.

import "server-only";
import { USDA_SEARCH_URL, type UsdaFood, buildUsdaSearchBody, parseUsdaSearch } from "@/lib/usda";

export type UsdaResult =
  | { ok: true; foods: UsdaFood[] }
  | { ok: false; error: "not_configured" | "unauthorized" | "rate_limited" | "unavailable" };

export async function searchUsda(query: string): Promise<UsdaResult> {
  const apiKey = process.env.USDA_FDC_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return { ok: false, error: "not_configured" };

  let response: Response;
  try {
    response = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildUsdaSearchBody(query)),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }

  if (!response.ok) {
    // Never log the URL: it contains the key.
    console.error(`USDA search failed: HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403) return { ok: false, error: "unauthorized" };
    if (response.status === 429) return { ok: false, error: "rate_limited" };
    return { ok: false, error: "unavailable" };
  }

  // USDA occasionally answers with an HTML error page instead of JSON.
  const body: unknown = await response.json().catch(() => null);
  if (body === null) return { ok: false, error: "unavailable" };
  return { ok: true, foods: parseUsdaSearch(body) };
}
