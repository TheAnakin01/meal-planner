// Validation for the admin recipe editor, and the payload sent to public.save_recipe
// (supabase/migrations/0005_save_recipe.sql). Nutrition/allergens/diets are NOT taken from the
// browser: the server recomputes them from the ingredients in the database.

import { z } from "zod";
import type { RecipeAnalysis } from "@/lib/recipe-analysis";

const text = (max: number, message: string) => z.string().trim().max(max, message);

export const recipeLineSchema = z.object({
  ingredientId: z.number().int().positive(),
  grams: z
    .number({ error: "Enter grams for every ingredient." })
    .positive("Grams must be more than 0.")
    .max(5000, "That's more than 5 kg of one ingredient."),
  displayAmount: text(40, "Keep amounts short (e.g. \"1 cup\")."),
  note: text(80, "Keep notes to 80 characters."),
});

export const recipeInputSchema = z.object({
  id: z.number().int().positive().nullable(),
  title: text(120, "Keep the title to 120 characters.").min(1, "Please enter a title."),
  description: text(600, "Keep the description to 600 characters."),
  cuisine: text(40, "Keep the cuisine to 40 characters.").min(1, "Please enter a cuisine."),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner"])).min(1, "Pick at least one meal."),
  servings: z.number().int("Servings must be a whole number.").min(1).max(20),
  prepMinutes: z.number().int().min(0).max(600),
  cookMinutes: z.number().int().min(0).max(1440),
  steps: z
    .array(text(500, "Keep each step to 500 characters.").min(1))
    .max(30, "At most 30 steps."),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || u.startsWith("https://"), "Image links must start with https://"),
  lines: z.array(recipeLineSchema).min(1, "Add at least one ingredient.").max(40, "At most 40 ingredients."),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

// Arguments for public.save_recipe(p_recipe, p_lines).
export function toSaveRecipeArgs(input: RecipeInput, analysis: RecipeAnalysis, source: "owner" | "ai" = "owner") {
  const n = analysis.nutrition.perServing;
  return {
    p_recipe: {
      id: input.id,
      title: input.title,
      description: input.description,
      cuisine: input.cuisine.toLowerCase(),
      meal_types: [...new Set(input.mealTypes)],
      servings: input.servings,
      prep_minutes: input.prepMinutes,
      cook_minutes: input.cookMinutes,
      steps: input.steps,
      image_url: input.imageUrl,
      source,
      kcal_per_serving: n?.kcal ?? null,
      protein_per_serving: n?.proteinG ?? null,
      carbs_per_serving: n?.carbsG ?? null,
      fat_per_serving: n?.fatG ?? null,
      fiber_per_serving: n?.fiberG ?? null,
      allergen_tags: analysis.allergens.tags,
      diet_types: analysis.diets.dietTypes,
    },
    p_lines: input.lines.map((l) => ({
      ingredient_id: l.ingredientId,
      grams: l.grams,
      display_amount: l.displayAmount,
      note: l.note,
    })),
  };
}

// Why a recipe can't be published yet (empty list = ready).
export function publishProblems(
  input: { steps: readonly unknown[]; lines: readonly unknown[] },
  analysis: RecipeAnalysis,
): string[] {
  const problems: string[] = [];
  if (input.lines.length === 0) problems.push("Add at least one ingredient.");
  if (input.steps.length === 0) problems.push("Add at least one cooking step.");
  if (analysis.nutrition.missing.length > 0) {
    problems.push(`These ingredients have no nutrition yet: ${analysis.nutrition.missing.join(", ")}.`);
  } else if (!analysis.nutrition.perServing) {
    problems.push("Nutrition couldn't be calculated.");
  }
  return problems;
}
