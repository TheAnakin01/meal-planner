// USDA FoodData Central: request building and response parsing. Pure (no network, no key) so it can be
// unit tested; the actual call lives in usda-server.ts. See CLAUDE.md §14, §15.
//
// USDA data is public domain, so we may store it. Nutrient values in search results are per 100 g.

import { z } from "zod";
import type { Nutrients } from "@/lib/library";

export const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

// Generic foods only (no branded products). "Survey (FNDDS)" adds foods as eaten, incl. paneer, besan, ghee.
export const USDA_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"] as const;

// Sent as a POST body: GET with "(FNDDS)" in the URL was rejected intermittently (HTTP 400) in testing.
export function buildUsdaSearchBody(query: string, pageSize = 10) {
  return { query: query.trim(), pageSize, dataType: [...USDA_DATA_TYPES] };
}

// USDA nutrient numbers.
const ENERGY_KCAL = "208";
const ENERGY_ATWATER_SPECIFIC = "958"; // Foundation foods often only have these two
const ENERGY_ATWATER_GENERAL = "957";
const PROTEIN = "203";
const FAT = "204";
const CARBS_BY_DIFFERENCE = "205";
const CARBS_BY_SUMMATION = "205.2";
const FIBER = "291";

const nutrientSchema = z.object({
  nutrientNumber: z.union([z.string(), z.number()]).transform(String),
  unitName: z.string().optional(),
  value: z.number().optional(),
});
type UsdaNutrient = z.infer<typeof nutrientSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

function value(nutrients: UsdaNutrient[], number: string, unit?: string): number | null {
  const found = nutrients.find(
    (n) => n.nutrientNumber === number && n.value !== undefined && (!unit || n.unitName?.toUpperCase() === unit),
  );
  return found?.value ?? null;
}

// Per-100 g nutrition from a USDA nutrient list, or null if protein, fat or carbs are missing.
export function nutrientsFromUsda(raw: unknown[]): Nutrients | null {
  const nutrients = raw.flatMap((n) => {
    const parsed = nutrientSchema.safeParse(n);
    return parsed.success ? [parsed.data] : [];
  });

  const protein = value(nutrients, PROTEIN);
  const fat = value(nutrients, FAT);
  const carbs = value(nutrients, CARBS_BY_DIFFERENCE) ?? value(nutrients, CARBS_BY_SUMMATION);
  if (protein === null || fat === null || carbs === null) return null;

  const kcal =
    value(nutrients, ENERGY_KCAL, "KCAL") ??
    value(nutrients, ENERGY_ATWATER_SPECIFIC, "KCAL") ??
    value(nutrients, ENERGY_ATWATER_GENERAL, "KCAL") ??
    protein * 4 + carbs * 4 + fat * 9; // last resort: estimate from macros

  return {
    kcal: round2(kcal),
    proteinG: round2(protein),
    carbsG: round2(carbs),
    fatG: round2(fat),
    fiberG: round2(value(nutrients, FIBER) ?? 0),
  };
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  per100g: Nutrients;
}

const foodSchema = z.object({
  fdcId: z.number().int().positive(),
  description: z.string(),
  dataType: z.string(),
  foodNutrients: z.array(z.unknown()).default([]),
});
const searchSchema = z.object({ foods: z.array(z.unknown()).default([]) });

// Foods from a search response that have usable nutrition; anything malformed is skipped.
export function parseUsdaSearch(body: unknown): UsdaFood[] {
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) return [];
  return parsed.data.foods.flatMap((raw) => {
    const food = foodSchema.safeParse(raw);
    if (!food.success) return [];
    const per100g = nutrientsFromUsda(food.data.foodNutrients);
    if (!per100g) return [];
    return [{ fdcId: food.data.fdcId, description: food.data.description, dataType: food.data.dataType, per100g }];
  });
}
