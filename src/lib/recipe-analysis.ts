// Works out a library recipe's nutrition, allergens and suitable diet types from its ingredients
// (CLAUDE.md §15). Pure functions, unit tested.
//
// Safety principle (same as §5.3): two independent signals — the ingredient's tags/flags set by the
// owner, and our word check over names — and a recipe is treated as containing an allergen (or unsuitable
// for a diet) if EITHER says so. Disagreements are reported as warnings so the owner can fix the tags.

import { findAllergenHit, findWordHit } from "@/lib/allergen-safety";
import { ALLERGEN_IDS, type AllergenId } from "@/lib/allergens";
import { DIET_TYPE_IDS, type DietType, HONEY_WORDS, JAIN_AVOID_WORDS, MEAT_WORDS, checkRecipeDiet } from "@/lib/diet";
import type { Ingredient, Nutrients } from "@/lib/library";

export type AnalysisIngredient = Pick<
  Ingredient,
  | "name"
  | "aliases"
  | "per100g"
  | "allergenTags"
  | "containsMeat"
  | "containsFish"
  | "containsEgg"
  | "containsDairy"
  | "containsHoney"
  | "jainAvoid"
>;

export interface RecipeLine {
  grams: number;
  ingredient: AnalysisIngredient;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// All words describing the recipe, for the word checks: title + ingredient names + aliases.
function wordSource(title: string, lines: readonly RecipeLine[]) {
  return { title, ingredients: lines.flatMap((l) => [l.ingredient.name, ...l.ingredient.aliases]) };
}

export interface NutritionResult {
  perServing: Nutrients | null; // null if any ingredient has no nutrition yet
  missing: string[]; // ingredient names without nutrition
}

export function computeNutrition(lines: readonly RecipeLine[], servings: number): NutritionResult {
  const missing = lines.filter((l) => !l.ingredient.per100g).map((l) => l.ingredient.name);
  if (missing.length > 0 || lines.length === 0 || servings <= 0) return { perServing: null, missing };

  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const { grams, ingredient } of lines) {
    const factor = grams / 100;
    const n = ingredient.per100g!;
    total.kcal += n.kcal * factor;
    total.proteinG += n.proteinG * factor;
    total.carbsG += n.carbsG * factor;
    total.fatG += n.fatG * factor;
    total.fiberG += n.fiberG * factor;
  }
  return {
    perServing: {
      kcal: round1(total.kcal / servings),
      proteinG: round1(total.proteinG / servings),
      carbsG: round1(total.carbsG / servings),
      fatG: round1(total.fatG / servings),
      fiberG: round1(total.fiberG / servings),
    },
    missing,
  };
}

export interface AllergenResult {
  tags: AllergenId[];
  warnings: string[];
}

export function computeAllergens(title: string, lines: readonly RecipeLine[]): AllergenResult {
  const tagged = new Set(lines.flatMap((l) => l.ingredient.allergenTags));
  const warnings: string[] = [];
  const tags: AllergenId[] = [];

  for (const id of ALLERGEN_IDS) {
    const hit = findAllergenHit(wordSource(title, lines), id);
    if (hit && !tagged.has(id)) {
      warnings.push(`"${hit}" suggests ${id.replace("-free", "")}, but no ingredient is tagged with it.`);
    }
    if (hit || tagged.has(id)) tags.push(id);
  }
  return { tags, warnings };
}

export interface DietResult {
  dietTypes: DietType[];
  warnings: string[];
}

export function computeDietTypes(title: string, lines: readonly RecipeLine[]): DietResult {
  const has = (flag: keyof AnalysisIngredient) => lines.some((l) => l.ingredient[flag] === true);
  const meatOrFish = has("containsMeat") || has("containsFish");
  const egg = has("containsEgg");
  const dairy = has("containsDairy");
  const honey = has("containsHoney");
  const jainAvoid = has("jainAvoid");

  // What the owner's flags allow.
  const byFlags: Record<DietType, boolean> = {
    nonveg: true,
    eggetarian: !meatOrFish,
    veg: !meatOrFish && !egg,
    jain: !meatOrFish && !egg && !jainAvoid && !honey,
    vegan: !meatOrFish && !egg && !dairy && !honey,
  };

  const source = wordSource(title, lines);
  const warnings: string[] = [];
  const dietTypes = DIET_TYPE_IDS.filter((diet) => {
    const byWords = checkRecipeDiet({ ...source, vegetarian: null, vegan: null }, diet);
    if (byFlags[diet] && !byWords.ok) {
      warnings.push(`Not marked ${diet}: ${byWords.reasons.join("; ")}. Check the ingredient flags.`);
    }
    return byFlags[diet] && byWords.ok;
  });
  return { dietTypes, warnings };
}

export interface RecipeAnalysis {
  nutrition: NutritionResult;
  allergens: AllergenResult;
  diets: DietResult;
}

export function analyzeRecipe(title: string, servings: number, lines: readonly RecipeLine[]): RecipeAnalysis {
  return {
    nutrition: computeNutrition(lines, servings),
    allergens: computeAllergens(title, lines),
    diets: computeDietTypes(title, lines),
  };
}

// If the stated calories are more than 7% away from the macro-based estimate, returns the estimate
// (so the owner can spot typos like paneer at 299 kcal with 3 g carbs, which is 8% off); else null.
// USDA "carbs by difference" includes fibre, which gives ~2 kcal/g rather than 4. It's only a
// "please check" hint: Atwater factors legitimately vary a little between foods.
export function kcalMismatch(n: Nutrients): number | null {
  const fiber = Math.min(n.fiberG, n.carbsG);
  const estimate = n.proteinG * 4 + (n.carbsG - fiber) * 4 + fiber * 2 + n.fatG * 9;
  if (estimate < 20 && n.kcal < 20) return null; // e.g. spices, water: too small to judge
  const reference = Math.max(n.kcal, estimate);
  return Math.abs(n.kcal - estimate) / reference > 0.07 ? Math.round(estimate) : null;
}

// Suggested tags/flags for a new ingredient from its name and aliases (the owner confirms them).
export function suggestIngredientTags(name: string, aliases: readonly string[] = []) {
  const source = { title: name, ingredients: [...aliases] };
  return {
    allergenTags: ALLERGEN_IDS.filter((id) => findAllergenHit(source, id) !== null),
    containsMeat: findWordHit(source, MEAT_WORDS) !== null,
    containsFish:
      findAllergenHit(source, "fish-free") !== null || findAllergenHit(source, "shellfish-free") !== null,
    containsEgg: findAllergenHit(source, "egg-free") !== null,
    containsDairy: findAllergenHit(source, "dairy-free") !== null,
    containsHoney: findWordHit(source, HONEY_WORDS) !== null,
    jainAvoid: findWordHit(source, JAIN_AVOID_WORDS) !== null,
  };
}
