// Open Food Facts (free, open data, ODbL — attribution required): packaged-food lookups by barcode
// for the food diary. Pure parsing + allergy checks, unit tested. The fetch is in openfoodfacts-server.ts.

import { z } from "zod";
import { findAllergenHit, findWordHit } from "@/lib/allergen-safety";
import { type AllergenId, allergenLabel } from "@/lib/allergens";
import type { Nutrients } from "@/lib/library";

export const OFF_ATTRIBUTION = "Product data from Open Food Facts (openfoodfacts.org), available under the ODbL.";

export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

export function offProductUrl(barcode: string): string {
  const fields = "product_name,brands,nutriments,serving_size,serving_quantity,allergens_tags,traces_tags,ingredients_text,image_front_small_url";
  return `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`;
}

// Open Food Facts allergen tags → our allergen ids.
const OFF_ALLERGENS: Record<string, AllergenId[]> = {
  "en:milk": ["dairy-free"],
  "en:eggs": ["egg-free"],
  "en:peanuts": ["peanut-free"],
  "en:nuts": ["tree-nut-free"],
  "en:soybeans": ["soy-free"],
  "en:gluten": ["gluten-free"],
  "en:wheat": ["wheat-free", "gluten-free"],
  "en:fish": ["fish-free"],
  "en:crustaceans": ["crustacean-free", "shellfish-free"],
  "en:molluscs": ["mollusk-free", "shellfish-free"],
  "en:sesame-seeds": ["sesame-free"],
  "en:mustard": ["mustard-free"],
  "en:celery": ["celery-free"],
  "en:lupin": ["lupine-free"],
  "en:sulphur-dioxide-and-sulphites": ["sulfite-free"],
};

function mapAllergens(tags: readonly string[]): AllergenId[] {
  return [...new Set(tags.flatMap((t) => OFF_ALLERGENS[t] ?? []))];
}

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  per100g: Nutrients | null;
  servingGrams: number | null;
  allergens: AllergenId[]; // declared "contains"
  traces: AllergenId[]; // "may contain"
  ingredientsText: string;
  imageUrl: string | null;
}

const num = z.coerce.number().finite().nonnegative().optional().catch(undefined);
const responseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional().catch(undefined),
      brands: z.string().optional().catch(undefined),
      serving_quantity: num,
      allergens_tags: z.array(z.string()).optional().catch(undefined),
      traces_tags: z.array(z.string()).optional().catch(undefined),
      ingredients_text: z.string().optional().catch(undefined),
      image_front_small_url: z.string().optional().catch(undefined),
      nutriments: z
        .object({
          "energy-kcal_100g": num,
          proteins_100g: num,
          carbohydrates_100g: num,
          fat_100g: num,
          fiber_100g: num,
        })
        .partial()
        .optional()
        .catch(undefined),
    })
    .optional(),
});

// The product, or null if Open Food Facts doesn't know this barcode.
export function parseOffResponse(barcode: string, body: unknown): OffProduct | null {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return null;
  const p = parsed.data.product;
  const n = p.nutriments ?? {};
  const kcal = n["energy-kcal_100g"];
  const per100g =
    kcal !== undefined && kcal <= 900
      ? { kcal, proteinG: n.proteins_100g ?? 0, carbsG: n.carbohydrates_100g ?? 0, fatG: n.fat_100g ?? 0, fiberG: n.fiber_100g ?? 0 }
      : null;
  const image = p.image_front_small_url ?? null;
  return {
    barcode,
    name: (p.product_name ?? "").trim() || `Product ${barcode}`,
    brand: p.brands?.split(",")[0]?.trim() || null,
    per100g,
    servingGrams: p.serving_quantity && p.serving_quantity > 0 && p.serving_quantity <= 2000 ? p.serving_quantity : null,
    allergens: mapAllergens(p.allergens_tags ?? []),
    traces: mapAllergens(p.traces_tags ?? []),
    ingredientsText: (p.ingredients_text ?? "").slice(0, 2000),
    imageUrl: image && image.startsWith("https://images.openfoodfacts.org/") ? image : null,
  };
}

export interface ProductWarnings {
  contains: string[]; // definitely contains one of the user's allergens
  mayContain: string[]; // "may contain traces of"
  unknownIngredients: boolean; // no ingredient list to check
}

// Checks a product against the user's allergies: declared allergens, the ingredient text (our word check)
// and "may contain" traces. Missing data is reported, never assumed safe.
export function productWarnings(product: OffProduct, allergies: readonly AllergenId[], otherAllergies: readonly string[]): ProductWarnings {
  const contains = new Set<string>();
  const text = { title: product.name, ingredients: [product.ingredientsText] };
  for (const id of allergies) {
    if (product.allergens.includes(id) || findAllergenHit(text, id)) contains.add(allergenLabel(id));
  }
  const other = findWordHit(text, otherAllergies);
  if (other) contains.add(other);
  const mayContain = allergies.filter((id) => product.traces.includes(id)).map(allergenLabel).filter((l) => !contains.has(l));
  return { contains: [...contains], mayContain, unknownIngredients: product.ingredientsText.trim() === "" };
}

export function nutrientsForGrams(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 10) / 10;
  return { kcal: r(per100g.kcal), proteinG: r(per100g.proteinG), carbsG: r(per100g.carbsG), fatG: r(per100g.fatG), fiberG: r(per100g.fiberG) };
}
