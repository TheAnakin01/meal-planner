// Smart ingredient swaps (CLAUDE.md §13 add-on 11): "can't find paneer?" → safe substitutes from the
// library that keep calories the same and macros close. Pure, unit tested.
//
// Safety first: a substitute must pass the user's allergies (tags + word check), "other allergies"
// words and diet type (flags + word check) — the same double-check used everywhere else.

import { findAllergenHit, findWordHit } from "@/lib/allergen-safety";
import type { AllergenId } from "@/lib/allergens";
import { type DietType, checkRecipeDiet } from "@/lib/diet";
import type { Ingredient } from "@/lib/library";

export interface SwapProfile {
  allergies: readonly AllergenId[];
  otherAllergies: readonly string[];
  dietType: DietType;
}

export interface SwapSuggestion {
  ingredient: Pick<Ingredient, "id" | "name">;
  grams: number;
  kcalDiff: number; // vs the original amount (≈ 0 by design)
  proteinDiff: number; // grams of protein gained (+) or lost (−)
}

type SwapIngredient = Pick<
  Ingredient,
  "id" | "name" | "aliases" | "per100g" | "allergenTags" | "aisle" | "containsMeat" | "containsFish" | "containsEgg" | "containsDairy" | "containsHoney" | "jainAvoid"
>;

function dietAllowsFlags(i: SwapIngredient, diet: DietType): boolean {
  const meatOrFish = i.containsMeat || i.containsFish;
  switch (diet) {
    case "nonveg":
      return true;
    case "eggetarian":
      return !meatOrFish;
    case "veg":
      return !meatOrFish && !i.containsEgg;
    case "jain":
      return !meatOrFish && !i.containsEgg && !i.jainAvoid && !i.containsHoney;
    case "vegan":
      return !meatOrFish && !i.containsEgg && !i.containsDairy && !i.containsHoney;
  }
}

// Can this person eat this ingredient? (Stored tags/flags AND the word checks must both agree.)
export function isSafeIngredient(i: SwapIngredient, profile: SwapProfile): boolean {
  if (i.allergenTags.some((t) => profile.allergies.includes(t))) return false;
  const words = { title: i.name, ingredients: i.aliases };
  if (profile.allergies.some((id) => findAllergenHit(words, id))) return false;
  if (findWordHit(words, profile.otherAllergies)) return false;
  if (!dietAllowsFlags(i, profile.dietType)) return false;
  return checkRecipeDiet({ ...words, vegetarian: null, vegan: null }, profile.dietType).ok;
}

function macroShares(n: NonNullable<Ingredient["per100g"]>) {
  const p = n.proteinG * 4;
  const c = n.carbsG * 4;
  const f = n.fatG * 9;
  const total = p + c + f || 1;
  return [p / total, c / total, f / total];
}

// Lower = more similar: macro balance distance, with a bonus for the same shop aisle (same kind of food).
function similarity(a: SwapIngredient, b: SwapIngredient): number {
  const sa = macroShares(a.per100g!);
  const sb = macroShares(b.per100g!);
  const distance = sa.reduce((sum, v, k) => sum + Math.abs(v - sb[k]), 0);
  return distance + (a.aisle === b.aisle ? 0 : 0.35);
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
// Swaps that change the food's character too much aren't useful suggestions.
const MAX_DISTANCE = 0.9;

export function suggestSwaps(
  original: SwapIngredient,
  grams: number,
  library: readonly SwapIngredient[],
  profile: SwapProfile,
  max = 3,
): SwapSuggestion[] {
  const o = original.per100g;
  if (!o || grams <= 0) return [];
  const originalKcal = (o.kcal * grams) / 100;
  const originalProtein = (o.proteinG * grams) / 100;

  return library
    .filter((c) => c.id !== original.id && c.per100g && isSafeIngredient(c, profile))
    .map((c) => {
      const n = c.per100g!;
      // Same calories as the original amount (foods with ~no calories swap gram for gram).
      const newGrams = o.kcal < 5 || n.kcal < 5 ? grams : (grams * o.kcal) / n.kcal;
      return { c, newGrams, score: similarity(original, c) };
    })
    .filter(({ newGrams, score }) => newGrams >= grams * MIN_SCALE && newGrams <= grams * MAX_SCALE && score <= MAX_DISTANCE)
    .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
    .slice(0, max)
    .map(({ c, newGrams }) => {
      const roundedGrams = newGrams >= 20 ? Math.round(newGrams / 5) * 5 : Math.round(newGrams);
      const n = c.per100g!;
      return {
        ingredient: { id: c.id, name: c.name },
        grams: roundedGrams,
        kcalDiff: Math.round((n.kcal * roundedGrams) / 100 - originalKcal),
        proteinDiff: Math.round(((n.proteinG * roundedGrams) / 100 - originalProtein) * 10) / 10,
      };
    });
}
