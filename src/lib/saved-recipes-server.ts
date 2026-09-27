// Server-only reads of the signed-in user's saved recipes. Row Level Security limits
// results to the current user; we also filter by user id explicitly.

import "server-only";
import type { SavedRecipe } from "@/lib/saved-recipes";
import { createClient } from "@/lib/supabase/server";

interface SavedRecipeRow {
  recipe_id: number;
  title: string;
  image_url: string | null;
  meal_type: SavedRecipe["mealType"];
  created_at: string;
}

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe_id, title, image_url, meal_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<SavedRecipeRow[]>();

  if (error) throw new Error(`Could not load saved recipes: ${error.message}`);
  return (data ?? []).map((r) => ({
    recipeId: Number(r.recipe_id),
    title: r.title,
    imageUrl: r.image_url,
    mealType: r.meal_type,
    savedAt: r.created_at,
  }));
}

export async function getSavedRecipeIds(): Promise<number[]> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe_id")
    .eq("user_id", userId)
    .returns<{ recipe_id: number }[]>();

  if (error) throw new Error(`Could not load saved recipes: ${error.message}`);
  return (data ?? []).map((r) => Number(r.recipe_id));
}
