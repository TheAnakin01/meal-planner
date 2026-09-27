"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate } from "@/lib/diary";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const weightSchema = z
  .number({ error: "Enter your weight." })
  .min(30, "Please enter a weight between 30 and 300 kg.")
  .max(300, "Please enter a weight between 30 and 300 kg.");

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

// Logs today's weight (logging again the same day replaces it).
export async function logWeightAction(kg: unknown): Promise<Result> {
  const parsed = weightSchema.safeParse(kg);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please fill in your details first." };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("weight_log").upsert(
    { user_id: userId, logged_on: localDate(new Date(), profile.timezone), weight_kg: Math.round(parsed.data * 10) / 10 },
    { onConflict: "user_id,logged_on" },
  );
  if (error) {
    console.error("logWeight failed:", error.message);
    return { ok: false, error: "Couldn't save your weight. Please try again." };
  }
  revalidatePath("/progress");
  return { ok: true };
}

// Copies the latest weigh-in into the profile so calorie targets and the plan use it.
export async function applyLatestWeightAction(kg: unknown): Promise<Result> {
  const parsed = weightSchema.safeParse(kg);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("profiles").update({ weight_kg: Math.round(parsed.data * 10) / 10 }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't update your profile. Please try again." };
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  revalidatePath("/week");
  return { ok: true };
}
