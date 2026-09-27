"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { weekStart } from "@/lib/planner";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.number().int().positive();

async function context() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  return { supabase, userId, week: weekStart(new Date(), profile.timezone) };
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

// Tick / untick an item that comes from the meal plan.
export async function setCheckedAction(ingredientId: unknown, checked: unknown): Promise<Result> {
  const id = idSchema.safeParse(ingredientId);
  const value = z.boolean().safeParse(checked);
  if (!id.success || !value.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase
    .from("shopping_list_items")
    .upsert(
      { user_id: ctx.userId, week_start: ctx.week, ingredient_id: id.data, checked: value.data },
      { onConflict: "user_id,week_start,ingredient_id" },
    );
  return failed(error, "setChecked") ?? done();
}

export async function addCustomItemAction(label: unknown): Promise<Result> {
  const parsed = z.string().trim().min(1, "Type an item first.").max(80, "Keep it under 80 characters.").safeParse(label);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase
    .from("shopping_list_items")
    .insert({ user_id: ctx.userId, week_start: ctx.week, label: parsed.data });
  return failed(error, "addCustomItem") ?? done();
}

export async function setCustomCheckedAction(itemId: unknown, checked: unknown): Promise<Result> {
  const id = idSchema.safeParse(itemId);
  const value = z.boolean().safeParse(checked);
  if (!id.success || !value.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase.from("shopping_list_items").update({ checked: value.data }).eq("id", id.data);
  return failed(error, "setCustomChecked") ?? done();
}

export async function deleteCustomItemAction(itemId: unknown): Promise<Result> {
  const id = idSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: "Invalid item." };
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Please sign in again." };

  const { error } = await ctx.supabase.from("shopping_list_items").delete().eq("id", id.data).not("label", "is", null);
  return failed(error, "deleteCustomItem") ?? done();
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
