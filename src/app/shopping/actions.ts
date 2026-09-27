"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addShoppingItemForCurrentUser } from "@/lib/plan-mutations";
import { weekStart } from "@/lib/planner";
import { STORE_IDS } from "@/lib/stores";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.number().int().positive();
// "me" = your own list; "household" = the list shared with your household (Step 32).
const scopeSchema = z.enum(["me", "household"]).default("me");

async function context() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  return { supabase, userId, week: weekStart(new Date(), profile.timezone) };
}

// The caller's household id, or null.
async function householdIdOf(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | null> {
  const { data } = await supabase.rpc("my_household_id");
  return typeof data === "number" || typeof data === "string" ? Number(data) : null;
}

function done(): Result {
  revalidatePath("/shopping");
  return { ok: true };
}

const failed = (error: { message: string } | null, what: string): Result | null => {
  if (!error) return null;
  console.error(`${what} failed:`, error.message);
  return { ok: false, error: "Couldn't save that. Please try again." };
};

// Tick / untick an item that comes from the meal plan. `week` is sent by ticks made offline
// (they may sync after the week has changed); otherwise it's this week.
export async function setCheckedAction(ingredientId: unknown, checked: unknown, week?: unknown, scope?: unknown): Promise<Result> {
  const id = idSchema.safeParse(ingredientId);
  const value = z.boolean().safeParse(checked);
  const weekParsed = z.iso.date().optional().safeParse(week);
  const where = scopeSchema.safeParse(scope);
  if (!id.success || !value.success || !weekParsed.success || !where.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  if (where.data === "household") {
    const householdId = await householdIdOf(ctx.supabase);
    if (!householdId) return { ok: false, error: "You're not in a household any more." };
    const { error } = await ctx.supabase
      .from("household_list_items")
      .upsert(
        { household_id: householdId, week_start: weekParsed.data ?? ctx.week, ingredient_id: id.data, checked: value.data },
        { onConflict: "household_id,week_start,ingredient_id" },
      );
    return failed(error, "setHouseholdChecked") ?? done();
  }

  const { error } = await ctx.supabase
    .from("shopping_list_items")
    .upsert(
      { user_id: ctx.userId, week_start: weekParsed.data ?? ctx.week, ingredient_id: id.data, checked: value.data },
      { onConflict: "user_id,week_start,ingredient_id" },
    );
  return failed(error, "setChecked") ?? done();
}

export async function addCustomItemAction(label: unknown, scope?: unknown): Promise<Result> {
  const where = scopeSchema.safeParse(scope);
  if (!where.success) return { ok: false, error: "Invalid list." };
  if (where.data === "me") {
    const r = await addShoppingItemForCurrentUser(label);
    return r.ok ? done() : r;
  }
  const parsed = z.string().trim().min(1, "Type an item first.").max(80, "Keep it under 80 characters.").safeParse(label);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  const householdId = await householdIdOf(ctx.supabase);
  if (!householdId) return { ok: false, error: "You're not in a household any more." };
  const { error } = await ctx.supabase
    .from("household_list_items")
    .insert({ household_id: householdId, week_start: ctx.week, label: parsed.data });
  return failed(error, "addHouseholdItem") ?? done();
}

const listTable = (scope: "me" | "household") => (scope === "household" ? "household_list_items" : "shopping_list_items");

export async function setCustomCheckedAction(itemId: unknown, checked: unknown, scope?: unknown): Promise<Result> {
  const id = idSchema.safeParse(itemId);
  const value = z.boolean().safeParse(checked);
  const where = scopeSchema.safeParse(scope);
  if (!id.success || !value.success || !where.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  // Row Level Security limits both tables to your own / your household's rows.
  const { error } = await ctx.supabase.from(listTable(where.data)).update({ checked: value.data }).eq("id", id.data);
  return failed(error, "setCustomChecked") ?? done();
}

export async function deleteCustomItemAction(itemId: unknown, scope?: unknown): Promise<Result> {
  const id = idSchema.safeParse(itemId);
  const where = scopeSchema.safeParse(scope);
  if (!id.success || !where.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase.from(listTable(where.data)).delete().eq("id", id.data).not("label", "is", null);
  return failed(error, "deleteCustomItem") ?? done();
}

// Store used for "Buy" links (also the profile default).
export async function setPreferredStoreAction(store: unknown): Promise<Result> {
  const parsed = z.enum(STORE_IDS).safeParse(store);
  if (!parsed.success) return { ok: false, error: "Unknown store." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase.from("profiles").update({ preferred_store: parsed.data }).eq("id", ctx.userId);
  return failed(error, "setPreferredStore") ?? done();
}

// "I always have this at home" — hides it from every week's list until removed.
export async function setPantryAction(ingredientId: unknown, inPantry: unknown): Promise<Result> {
  const id = idSchema.safeParse(ingredientId);
  const value = z.boolean().safeParse(inPantry);
  if (!id.success || !value.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = value.data
    ? await ctx.supabase.from("pantry_items").upsert({ user_id: ctx.userId, ingredient_id: id.data }, { onConflict: "user_id,ingredient_id" })
    : await ctx.supabase.from("pantry_items").delete().eq("ingredient_id", id.data);
  return failed(error, "setPantry") ?? done();
}
