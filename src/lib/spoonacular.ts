// Spoonacular request building and response parsing. Pure functions (no network, no secrets)
// so they can be unit tested. The actual API call lives in recipes.ts. See CLAUDE.md §5.4.

import { z } from "zod";
import { type AllergenId, spoonacularExcludes, spoonacularIntolerances } from "@/lib/allergens";
import { type DietType, spoonacularDietParams } from "@/lib/diet";
import type { MealTarget, MealType } from "@/lib/nutrition";

export const SPOONACULAR_SEARCH_URL = "https://api.spoonacular.com/recipes/complexSearch";

// How many recipes to fetch per meal in one call (the pool "Show another" rotates through).
export const RECIPES_PER_MEAL = 6;

const SPOONACULAR_MEAL_TYPE: Record<MealType, string> = {
  breakfast: "breakfast",
  lunch: "main course",
  dinner: "main course",
};

export interface Recipe {
  id: number;
  title: string;
  imageUrl: string | null;
  sourceUrl: string;
  sourceName: string | null;
  servings: number;
  readyInMinutes: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  dairyFree: boolean | null;
  glutenFree: boolean | null;
  vegetarian: boolean | null;
  vegan: boolean | null;
}

export interface RecipeSearch {
  meal: MealType;
  target: MealTarget;
  allergies: readonly AllergenId[];
  otherAllergies: readonly string[];
  dietType: DietType;
}

// Builds the search URL without the API key (the key is added just before fetching).
export function buildSearchParams({ meal, target, allergies, otherAllergies, dietType }: RecipeSearch) {
  const params = new URLSearchParams({
    type: SPOONACULAR_MEAL_TYPE[meal],
    minCalories: String(target.min),
    maxCalories: String(target.max),
    addRecipeNutrition: "true",
    sort: "random",
    number: String(RECIPES_PER_MEAL),
  });

  const intolerances = spoonacularIntolerances(allergies);
  if (intolerances.length > 0) params.set("intolerances", intolerances.join(","));

  const diet = spoonacularDietParams(dietType);
  if (diet.diet) params.set("diet", diet.diet);

  const excludes = [...new Set([...spoonacularExcludes(allergies, otherAllergies), ...diet.excludes])].sort();
  if (excludes.length > 0) params.set("excludeIngredients", excludes.join(","));

  return params;
}

// Only the fields we use; everything else in the response is ignored.
const nutrientSchema = z.object({ name: z.string(), amount: z.number() });
const resultSchema = z.object({
  id: z.number(),
  title: z.string(),
  image: z.string().optional(),
  sourceUrl: z.string().optional(),
  spoonacularSourceUrl: z.string().optional(),
  sourceName: z.string().nullish(),
  servings: z.number().optional(),
  readyInMinutes: z.number().optional(),
  dairyFree: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  nutrition: z
    .object({
      nutrients: z.array(nutrientSchema).default([]),
      ingredients: z.array(z.object({ name: z.string() })).default([]),
    })
    .optional(),
});
const responseSchema = z.object({ results: z.array(z.unknown()) });

function nutrient(nutrients: z.infer<typeof nutrientSchema>[], name: string): number | null {
  const found = nutrients.find((n) => n.name.toLowerCase() === name.toLowerCase());
  return found ? Math.round(found.amount) : null;
}

// Turns one raw result into a Recipe, or null if it lacks the data we need
// (a recipe with no calorie or ingredient data can't be checked, so it's never shown).
export function parseRecipe(raw: unknown): Recipe | null {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;

  const nutrients = r.nutrition?.nutrients ?? [];
  const calories = nutrient(nutrients, "Calories");
  const ingredients = (r.nutrition?.ingredients ?? []).map((i) => i.name.toLowerCase());
  const sourceUrl = r.sourceUrl || r.spoonacularSourceUrl;
  if (calories === null || ingredients.length === 0 || !sourceUrl) return null;

  return {
    id: r.id,
    title: r.title,
    imageUrl: r.image ?? null,
    sourceUrl,
    sourceName: r.sourceName ?? null,
    servings: r.servings ?? 1,
    readyInMinutes: r.readyInMinutes ?? null,
    calories,
    proteinG: nutrient(nutrients, "Protein") ?? 0,
    carbsG: nutrient(nutrients, "Carbohydrates") ?? 0,
    fatG: nutrient(nutrients, "Fat") ?? 0,
    ingredients,
    dairyFree: r.dairyFree ?? null,
    glutenFree: r.glutenFree ?? null,
    vegetarian: r.vegetarian ?? null,
    vegan: r.vegan ?? null,
  };
}

export function parseSearchResponse(body: unknown, target: MealTarget): Recipe[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return [];
  return parsed.data.results
    .map(parseRecipe)
    .filter((r): r is Recipe => r !== null && r.calories >= target.min && r.calories <= target.max);
}
