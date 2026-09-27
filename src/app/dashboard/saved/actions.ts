"use server";

import { revalidatePath } from "next/cache";
import { savedRecipeSchema } from "@/lib/saved-recipes";
import { createClient } from "@/lib/supabase/server";

export type SaveRecipeResult = { saved: boolean } | { error: string };

// Saves or un-saves a recipe for the signed-in user. Validates on the server: never trust the browser.
export async function setRecipeSaved(input: unknown, save: boolean): Promise<SaveRecipeResult> {
  const parsed = savedRecipeSchema.safeParse(input);
  if (!parsed.success) return { error: "That recipe couldn't be saved." };
  const { recipeId, title, imageUrl, mealType } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "Please sign in again to save recipes." };

  const { error } = save
    ? await supabase.from("saved_recipes").upsert(
        { user_id: userId, recipe_id: recipeId, title, image_url: imageUrl, meal_type: mealType },
        { onConflict: "user_id,recipe_id" },
      )
    : await supabase.from("saved_recipes").delete().eq("user_id", userId).eq("recipe_id", recipeId);

  if (error) {
    console.error("setRecipeSaved failed:", error.message);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/saved");
  return { saved: save };
}
