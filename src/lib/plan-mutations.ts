// Server-only: changes to the signed-in user's plan and shopping list, shared by the Week/Shopping
// pages and the AI coach. These do NOT refresh any page — callers decide (see CLAUDE.md §18 note on
// the coach: refreshing /coach after a slow AI call caused an error screen).

import "server-only";
import { z } from "zod";
import type { MealType } from "@/lib/nutrition";
import { type PlanSlot, bestPortion, swapMeal, weekStart } from "@/lib/planner";
import { type WeekPlan, getOrCreateWeekPlan, plannerProfile, savePlanSlots } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

export type MutationResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// With leftovers on, tomorrow's lunch follows tonight's dinner.
export function syncLeftover(slots: PlanSlot[], plan: WeekPlan, day: number): PlanSlot[] {
  if (!plan.leftovers || day >= 6) return slots;
  const dinner = slots.find((s) => s.day === day && s.meal === "dinner");
  const recipe = dinner && plan.recipes.find((r) => r.id === dinner.recipeId);
  return slots.map((s) =>
    recipe && s.day === day + 1 && s.meal === "lunch" && s.isLeftover && !s.locked
      ? { ...s, recipeId: recipe.id, portion: bestPortion(recipe.perServing.kcal, plan.targets.meals.lunch.calories).portion }
      : s,
  );
}

// Swaps one meal for the next-best safe recipe (also fills an empty meal). Returns the new recipe's title.
export async function swapMealForCurrentUser(day: number, meal: MealType): Promise<MutationResult<{ title: string | null }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please fill in your details first." };
  const plan = await getOrCreateWeekPlan(profile);

  if (plan.slots.some((s) => s.day === day && s.meal === meal && s.locked)) {
    return { ok: false, error: "This meal is locked. Unlock it to swap." };
  }
  const swapped = swapMeal(plan.recipes, plannerProfile(profile), plan.targets, plan.slots, day, meal, newSeed());
  if (!swapped) return { ok: false, error: "No other recipe suits you for this meal yet." };
  await savePlanSlots(plan.planId, meal === "dinner" ? syncLeftover(swapped, plan, day) : swapped);

  const slot = swapped.find((s) => s.day === day && s.meal === meal);
  const title = slot ? (plan.recipes.find((r) => r.id === slot.recipeId)?.title ?? null) : null;
  return { ok: true, title };
}

const labelSchema = z.string().trim().min(1, "Type an item first.").max(80, "Keep it under 80 characters.");

// Adds an extra item to this week's shopping list.
export async function addShoppingItemForCurrentUser(label: unknown): Promise<MutationResult> {
  const parsed = labelSchema.safeParse(label);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase
    .from("shopping_list_items")
    .insert({ user_id: userId, week_start: weekStart(new Date(), profile.timezone), label: parsed.data });
  if (error) {
    console.error("addShoppingItem failed:", error.message);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  return { ok: true };
}
