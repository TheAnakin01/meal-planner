// Server-only: the signed-in user's shopping list for this week (CLAUDE.md §17).

import "server-only";
import { getAllIngredients } from "@/lib/library-server";
import { type WeekPlan, getOrCreateWeekPlan } from "@/lib/plan-server";
import type { PlanSlot } from "@/lib/planner";
import { type ShoppingList, type ShoppingRecipe, buildShoppingList } from "@/lib/shopping";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validation";

export interface CustomItem {
  id: number;
  label: string;
  checked: boolean;
}

export interface ShoppingData {
  plan: WeekPlan;
  list: ShoppingList;
  checkedIds: number[];
  custom: CustomItem[];
}

interface RecipeLinesRow {
  id: number;
  servings: number;
  recipe_ingredients: { ingredient_id: number; grams: number | string }[];
}

interface ListRow {
  id: number;
  ingredient_id: number | null;
  label: string | null;
  checked: boolean;
}

// "me": your own plan and ticks. "household": everyone's plans in your household added together, with
// shared ticks and extra items (Step 32). Only recipe ids and portions come back for other members.
export async function getShoppingData(profile: ProfileInput, scope: "me" | "household" = "me", householdId: number | null = null): Promise<ShoppingData> {
  const plan = await getOrCreateWeekPlan(profile);
  const supabase = await createClient();
  const shared = scope === "household" && householdId !== null;

  let slots: PlanSlot[] = plan.slots;
  if (shared) {
    const { data, error } = await supabase.rpc("household_week_slots", { p_week: plan.weekStart });
    if (error) throw new Error(`Could not load household list: ${error.message}`);
    slots = ((data ?? []) as { recipe_id: number; portion: number | string }[]).map((r) => ({
      day: 0,
      meal: "lunch",
      recipeId: Number(r.recipe_id),
      portion: Number(r.portion),
      locked: false,
      isLeftover: false,
    }));
  }
  const recipeIds = [...new Set(slots.map((s) => s.recipeId))];

  const [recipesRes, ingredients, pantryRes, listRes] = await Promise.all([
    recipeIds.length > 0
      ? supabase.from("recipes").select("id, servings, recipe_ingredients(ingredient_id, grams)").in("id", recipeIds).returns<RecipeLinesRow[]>()
      : Promise.resolve({ data: [] as RecipeLinesRow[], error: null }),
    getAllIngredients(),
    supabase.from("pantry_items").select("ingredient_id").returns<{ ingredient_id: number }[]>(),
    shared
      ? supabase
          .from("household_list_items")
          .select("id, ingredient_id, label, checked")
          .eq("household_id", householdId)
          .eq("week_start", plan.weekStart)
          .order("created_at")
          .returns<ListRow[]>()
      : supabase
          .from("shopping_list_items")
          .select("id, ingredient_id, label, checked")
          .eq("week_start", plan.weekStart)
          .order("created_at")
          .returns<ListRow[]>(),
  ]);
  for (const res of [recipesRes, pantryRes, listRes]) {
    if (res.error) throw new Error(`Could not load shopping list: ${res.error.message}`);
  }

  const recipes: ShoppingRecipe[] = (recipesRes.data ?? []).map((r) => ({
    id: Number(r.id),
    servings: r.servings,
    lines: r.recipe_ingredients.map((l) => ({ ingredientId: Number(l.ingredient_id), grams: Number(l.grams) })),
  }));
  const pantryIds = new Set((pantryRes.data ?? []).map((p) => Number(p.ingredient_id)));
  const rows = listRes.data ?? [];

  return {
    plan,
    list: buildShoppingList(slots, recipes, ingredients, pantryIds),
    checkedIds: rows.filter((r) => r.ingredient_id !== null && r.checked).map((r) => Number(r.ingredient_id)),
    custom: rows.filter((r) => r.label !== null).map((r) => ({ id: Number(r.id), label: r.label!, checked: r.checked })),
  };
}
