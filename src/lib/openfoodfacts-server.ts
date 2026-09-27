// Server-only: fetches one product from Open Food Facts. They ask apps to identify themselves
// with a custom User-Agent and to keep to ~100 product lookups per minute.

import "server-only";
import { type OffProduct, isValidBarcode, offProductUrl, parseOffResponse } from "@/lib/openfoodfacts";

const USER_AGENT = "MealPlanner/1.0 (https://github.com/TheAnakin01/meal-planner)";

export type OffLookup = { ok: true; product: OffProduct | null } | { ok: false; error: string };

export async function lookupBarcode(barcode: string): Promise<OffLookup> {
  if (!isValidBarcode(barcode)) return { ok: false, error: "A barcode is 8 to 14 digits." };
  try {
    const response = await fetch(offProductUrl(barcode), {
      headers: { "User-Agent": USER_AGENT },
      // Product data changes rarely; caching a day saves their servers (allowed: open data).
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return { ok: true, product: null };
    if (!response.ok) return { ok: false, error: "Couldn't reach Open Food Facts. Please try again." };
    const body: unknown = await response.json().catch(() => null);
    return { ok: true, product: parseOffResponse(barcode, body) };
  } catch {
    return { ok: false, error: "Couldn't reach Open Food Facts. Please try again." };
  }
}
