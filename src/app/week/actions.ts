"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type PlanSlot, bestPortion, generateWeek, swapMeal } from "@/lib/planner";
import { type WeekPlan, getOrCreateWeekPlan, plannerProfile, savePlanSlots } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validation";

type Result = { ok: true; notes?: string[] } | { ok: false; error: string };

const daySchema = z.number().int().min(0).max(6);
const mealSchema = z.enum(["breakfast", "lunch", "dinner"]);
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

async function load(): Promise<{ profile: ProfileInput; plan: WeekPlan } | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  return { profile, plan: await getOrCreateWeekPlan(profile) };
}

// With leftovers on, tomorrow's lunch follows tonight's dinner.
function syncLeftover(slots: PlanSlot[], plan: WeekPlan, day: number): PlanSlot[] {
  if (!plan.leftovers || day >= 6) return slots;
  const dinner = slots.find((s) => s.day === day && s.meal === "dinner");
  const recipe = dinner && plan.recipes.find((r) => r.id === dinner.recipeId);
  return slots.map((s) =>
    recipe && s.day === day + 1 && s.meal === "lunch" && s.isLeftover && !s.locked
      ? { ...s, recipeId: recipe.id, portion: bestPortion(recipe.perServing.kcal, plan.targets.meals.lunch.calories).portion }
      : s,
  );
}

function done(notes?: string[]): Result {
  revalidatePath("/week");
  revalidatePath("/dashboard");
  return { ok: true, notes };
}

// Swap one meal for the next-best safe recipe (also fills an empty meal).
export async function swapMealAction(day: unknown, meal: unknown): Promise<Result> {
  const d = daySchema.safeParse(day);
  const m = mealSchema.safeParse(meal);
  if (!d.success || !m.success) return { ok: false, error: "Invalid meal." };
  const loaded = await load();
  if (!loaded) return { ok: false, error: "Please fill in your details first." };
  const { profile, plan } = loaded;

  if (plan.slots.some((s) => s.day === d.data && s.meal === m.data && s.locked)) {
    return { ok: false, error: "This meal is locked. Unlock it to swap." };
  }
  const swapped = swapMeal(plan.recipes, plannerProfile(profile), plan.targets, plan.slots, d.data, m.data, newSeed());
  if (!swapped) return { ok: false, error: "No other recipe suits you for this meal yet." };
  await savePlanSlots(plan.planId, m.data === "dinner" ? syncLeftover(swapped, plan, d.data) : swapped);
  return done();
}

export async function toggleLockAction(day: unknown, meal: unknown): Promise<Result> {
  const d = daySchema.safeParse(day);
  const m = mealSchema.safeParse(meal);
  if (!d.success || !m.success) return { ok: false, error: "Invalid meal." };
  const loaded = await load();
  if (!loaded) return { ok: false, error: "Please fill in your details first." };
  const { plan } = loaded;

  const slots = plan.slots.map((s) => (s.day === d.data && s.meal === m.data ? { ...s, locked: !s.locked } : s));
  await savePlanSlots(plan.planId, slots);
  return done();
}

async function regenerate(plan: WeekPlan, profile: ProfileInput, keep: PlanSlot[], leftovers: boolean): Promise<Result> {
  const seed = newSeed();
  const result = generateWeek(plan.recipes, plannerProfile(profile), plan.targets, { seed, leftovers, keep });
  const supabase = await createClient();
  await supabase.from("meal_plans").update({ seed }).eq("id", plan.planId);
  await savePlanSlots(plan.planId, result.slots);
  return done(result.notes);
}

// New meals for one day (locked meals stay).
export async function regenerateDayAction(day: unknown): Promise<Result> {
  const d = daySchema.safeParse(day);
  if (!d.success) return { ok: false, error: "Invalid day." };
  const loaded = await load();
  if (!loaded) return { ok: false, error: "Please fill in your details first." };
  const { profile, plan } = loaded;
  const keep = plan.slots.filter((s) => s.day !== d.data || s.locked);
  return regenerate(plan, profile, keep, plan.leftovers);
}

// New meals for the whole week (locked meals stay).
export async function regenerateWeekAction(): Promise<Result> {
  const loaded = await load();
  if (!loaded) return { ok: false, error: "Please fill in your details first." };
  const { profile, plan } = loaded;
  return regenerate(plan, profile, plan.slots.filter((s) => s.locked), plan.leftovers);
}

export async function setLeftoversAction(on: unknown): Promise<Result> {
  const value = z.boolean().safeParse(on);
  if (!value.success) return { ok: false, error: "Invalid setting." };
  const loaded = await load();
  if (!loaded) return { ok: false, error: "Please fill in your details first." };
  const { profile, plan } = loaded;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { error } = await supabase.from("profiles").update({ leftovers_mode: value.data }).eq("id", auth?.claims?.sub ?? "");
  if (error) return { ok: false, error: "Couldn't save the setting." };
  return regenerate(plan, profile, plan.slots.filter((s) => s.locked), value.data);
}

