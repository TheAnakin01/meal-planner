"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DIARY_MEALS, isoDateSchema, localDate, manualEntrySchema } from "@/lib/diary";
import { type OffProduct, type ProductWarnings, nutrientsForGrams, productWarnings } from "@/lib/openfoodfacts";
import { lookupBarcode } from "@/lib/openfoodfacts-server";
import { dayIndex } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

async function insert(row: Record<string, unknown>): Promise<Result> {
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { error } = await supabase.from("food_log").insert({ user_id: userId, ...row });
  if (error) {
    console.error("food_log insert failed:", error.message);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
  revalidatePath("/diary");
  return { ok: true };
}

// Logs one of today's planned meals as eaten. Nutrition comes from the plan on the server.
export async function logPlannedMealAction(meal: unknown): Promise<Result> {
  const m = z.enum(["breakfast", "lunch", "dinner"]).safeParse(meal);
  if (!m.success) return { ok: false, error: "Invalid meal." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please fill in your details first." };

  const plan = await getOrCreateWeekPlan(profile);
  const now = new Date();
  const slot = plan.slots.find((s) => s.day === dayIndex(now, profile.timezone) && s.meal === m.data);
  const recipe = slot && plan.recipes.find((r) => r.id === slot.recipeId);
  if (!slot || !recipe) return { ok: false, error: "There's no planned recipe for this meal today." };

  const n = recipe.perServing;
  return insert({
    eaten_on: localDate(now, profile.timezone),
    meal: m.data,
    source: "plan",
    recipe_id: recipe.id,
    label: recipe.title,
    amount: `${slot.portion} serving${slot.portion === 1 ? "" : "s"}`,
    calories: Math.round(n.kcal * slot.portion * 10) / 10,
    protein_g: Math.round(n.proteinG * slot.portion * 10) / 10,
    carbs_g: Math.round(n.carbsG * slot.portion * 10) / 10,
    fat_g: Math.round(n.fatG * slot.portion * 10) / 10,
  });
}

export async function logManualAction(input: unknown): Promise<Result> {
  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const e = parsed.data;
  return insert({
    eaten_on: e.date,
    meal: e.meal,
    source: "manual",
    label: e.label,
    amount: e.amount,
    calories: e.calories,
    protein_g: e.proteinG,
    carbs_g: e.carbsG,
    fat_g: e.fatG,
  });
}

export type LookupResult = { ok: true; product: OffProduct | null; warnings: ProductWarnings | null } | { ok: false; error: string };

// Looks up a scanned barcode and checks it against the user's allergies.
export async function lookupBarcodeAction(barcode: unknown): Promise<LookupResult> {
  const code = z.string().trim().safeParse(barcode);
  if (!code.success) return { ok: false, error: "Invalid barcode." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please fill in your details first." };
  const result = await lookupBarcode(code.data);
  if (!result.ok) return result;
  return {
    ok: true,
    product: result.product,
    warnings: result.product ? productWarnings(result.product, profile.allergies, profile.otherAllergies) : null,
  };
}

// Logs a scanned product. The server looks it up again and does the maths (browser numbers aren't trusted).
export async function logBarcodeAction(input: unknown): Promise<Result> {
  const parsed = z
    .object({ barcode: z.string(), grams: z.number().positive().max(5000), meal: z.enum(DIARY_MEALS), date: isoDateSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter how many grams you ate." };
  const lookup = await lookupBarcode(parsed.data.barcode);
  if (!lookup.ok) return lookup;
  if (!lookup.product?.per100g) return { ok: false, error: "This product has no nutrition data. Please add it manually." };

  const n = nutrientsForGrams(lookup.product.per100g, parsed.data.grams);
  const label = [lookup.product.brand, lookup.product.name].filter(Boolean).join(" · ").slice(0, 120);
  return insert({
    eaten_on: parsed.data.date,
    meal: parsed.data.meal,
    source: "barcode",
    barcode: lookup.product.barcode,
    label,
    amount: `${parsed.data.grams} g`,
    calories: n.kcal,
    protein_g: n.proteinG,
    carbs_g: n.carbsG,
    fat_g: n.fatG,
  });
}

export async function deleteLogAction(id: unknown): Promise<Result> {
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid entry." };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { error } = await supabase.from("food_log").delete().eq("id", parsed.data).eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't delete that. Please try again." };
  revalidatePath("/diary");
  return { ok: true };
}
