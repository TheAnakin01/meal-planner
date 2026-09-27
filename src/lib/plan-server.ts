// Server-only: loading, creating and saving the signed-in user's weekly meal plan (CLAUDE.md §16).

import "server-only";
import type { AllergenId } from "@/lib/allergens";
import type { DietType } from "@/lib/diet";
import { type RecipeRow, recipeFromRow } from "@/lib/library";
import { type MealType, type NutritionPlan, calculateNutritionPlan } from "@/lib/nutrition";
import { type PlanSlot, type PlannerProfile, type PlannerRecipe, eligibleRecipes, generateWeek, weekStart } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validation";

type RecipeWithIngredients = RecipeRow & {
  recipe_ingredients: { ingredients: { name: string; aliases: string[] } | null }[];
};

// Published recipes with nutrition, in the planner's shape.
export async function getPlannerRecipes(): Promise<PlannerRecipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(ingredients(name, aliases))")
    .eq("status", "published")
    .returns<RecipeWithIngredients[]>();
  if (error) throw new Error(`Could not load recipes: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const r = recipeFromRow(row);
    if (!r.perServing) return [];
    return [
      {
        id: r.id,
        title: r.title,
        cuisine: r.cuisine,
        mealTypes: r.mealTypes,
        perServing: r.perServing,
        allergenTags: r.allergenTags as AllergenId[],
        dietTypes: r.dietTypes as DietType[],
        ingredientNames: row.recipe_ingredients.flatMap((ri) => (ri.ingredients ? [ri.ingredients.name, ...ri.ingredients.aliases] : [])),
      },
    ];
  });
}

export function plannerProfile(profile: ProfileInput): PlannerProfile {
  return { allergies: profile.allergies, otherAllergies: profile.otherAllergies, dietType: profile.dietType };
}

interface PlanItemRow {
  day: number;
  meal: MealType;
  recipe_id: number;
  portion: number | string;
  locked: boolean;
  is_leftover: boolean;
}

export interface WeekPlan {
  planId: number;
  weekStart: string;
  seed: number;
  leftovers: boolean;
  slots: PlanSlot[];
  notes: string[];
  targets: NutritionPlan;
  recipes: PlannerRecipe[]; // the eligible recipes (for titles, nutrition and swaps)
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new Error("Not signed in");
  return { supabase, userId };
}

// Replaces all items of a plan with `slots` (upsert what's there, delete what isn't).
export async function savePlanSlots(planId: number, slots: readonly PlanSlot[]) {
  const supabase = await createClient();
  const rows = slots.map((s) => ({
    plan_id: planId,
    day: s.day,
    meal: s.meal,
    recipe_id: s.recipeId,
    portion: s.portion,
    locked: s.locked,
    is_leftover: s.isLeftover,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("meal_plan_items").upsert(rows, { onConflict: "plan_id,day,meal" });
    if (error) throw new Error(`Could not save plan: ${error.message}`);
  }
  // Remove meals that are now empty (e.g. no safe recipe any more).
  const { data: existing, error: readError } = await supabase
    .from("meal_plan_items")
    .select("id, day, meal")
    .eq("plan_id", planId)
    .returns<{ id: number; day: number; meal: MealType }[]>();
  if (readError) throw new Error(`Could not read plan: ${readError.message}`);
  const keep = new Set(slots.map((s) => `${s.day}-${s.meal}`));
  const stale = (existing ?? []).filter((e) => !keep.has(`${e.day}-${e.meal}`)).map((e) => e.id);
  if (stale.length > 0) {
    const { error } = await supabase.from("meal_plan_items").delete().in("id", stale);
    if (error) throw new Error(`Could not update plan: ${error.message}`);
  }
}

// This week's plan for the user, creating it on first visit.
export async function getOrCreateWeekPlan(profile: ProfileInput, now = new Date()): Promise<WeekPlan> {
  const { supabase, userId } = await currentUserId();
  const week = weekStart(now, profile.timezone);
  const targets = calculateNutritionPlan(profile);
  const recipes = eligibleRecipes(await getPlannerRecipes(), plannerProfile(profile));
  const recipeIds = new Set(recipes.map((r) => r.id));

  const { data: prefs } = await supabase.from("profiles").select("leftovers_mode").eq("id", userId).maybeSingle<{ leftovers_mode: boolean }>();
  const leftovers = prefs?.leftovers_mode ?? false;

  let { data: plan } = await supabase
    .from("meal_plans")
    .select("id, seed")
    .eq("user_id", userId)
    .eq("week_start", week)
    .maybeSingle<{ id: number; seed: number }>();

  if (!plan) {
    const seed = randomSeed();
    const { data: created, error } = await supabase
      .from("meal_plans")
      .insert({ user_id: userId, week_start: week, seed })
      .select("id, seed")
      .single<{ id: number; seed: number }>();
    if (error) {
      // Another tab created it at the same moment: use that one.
      const { data: again } = await supabase.from("meal_plans").select("id, seed").eq("user_id", userId).eq("week_start", week).single<{ id: number; seed: number }>();
      plan = again;
    } else {
      plan = created;
      const result = generateWeek(recipes, plannerProfile(profile), targets, { seed, leftovers });
      await savePlanSlots(created.id, result.slots);
    }
  }
  if (!plan) throw new Error("Could not create this week's plan");

  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select("day, meal, recipe_id, portion, locked, is_leftover")
    .eq("plan_id", plan.id)
    .returns<PlanItemRow[]>();
  if (itemsError) throw new Error(`Could not load plan: ${itemsError.message}`);

  // Drop meals whose recipe is no longer safe for this person (e.g. allergies changed or recipe unpublished).
  const slots: PlanSlot[] = (items ?? [])
    .filter((i) => recipeIds.has(Number(i.recipe_id)))
    .map((i) => ({
      day: i.day,
      meal: i.meal,
      recipeId: Number(i.recipe_id),
      portion: Number(i.portion),
      locked: i.locked,
      isLeftover: i.is_leftover,
    }));
  const removed = (items ?? []).length - slots.length;

  const notes: string[] = [];
  if (removed > 0) notes.push(`${removed} meal${removed === 1 ? " was" : "s were"} removed because the recipe no longer suits you. Tap "Fill" or regenerate.`);
  if (recipes.length === 0) notes.push("No published recipes suit your diet and allergies yet.");

  return { planId: plan.id, weekStart: week, seed: plan.seed, leftovers, slots, notes, targets, recipes };
}
