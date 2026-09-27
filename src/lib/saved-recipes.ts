// Saved ("hearted") recipes. Spoonacular's terms only allow storing the recipe id, title and
// image URL permanently (CLAUDE.md §4.3), so that is all we keep.

import { z } from "zod";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

export const savedRecipeSchema = z.object({
  recipeId: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  imageUrl: z
    .string()
    .startsWith("https://img.spoonacular.com/")
    .max(500)
    .nullable(),
  mealType: z.enum(MEAL_TYPES),
});

export type SavedRecipeInput = z.infer<typeof savedRecipeSchema>;

export interface SavedRecipe extends SavedRecipeInput {
  savedAt: string;
}

// Spoonacular's own recipe page, which links on to the original source.
// The page is found by the id at the end; the title part is just for readability.
export function spoonacularRecipeUrl(recipeId: number, title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://spoonacular.com/recipes/${slug ? `${slug}-` : ""}${recipeId}`;
}
