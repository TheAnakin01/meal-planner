"use server";

import { revalidatePath } from "next/cache";
import { displayNameSchema, generateInviteCode, householdNameSchema, inviteCodeSchema } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

function done(): Result {
  revalidatePath("/household");
  revalidatePath("/shopping");
  return { ok: true };
}

function friendly(message: string): string {
  if (/already in a household/i.test(message)) return "You're already in a household. Leave it first to join another.";
  if (/invalid or expired/i.test(message)) return "That code is wrong or has expired. Ask for a new one.";
  if (/full/i.test(message)) return "That household is full (8 people).";
  return "Something went wrong. Please try again.";
}

export async function createHouseholdAction(name: unknown, displayName: unknown): Promise<Result> {
  const n = householdNameSchema.safeParse(name);
  const d = displayNameSchema.safeParse(displayName);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  if (!d.success) return { ok: false, error: d.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: n.data, p_display_name: d.data });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}

export async function joinHouseholdAction(code: unknown, displayName: unknown): Promise<Result> {
  const c = inviteCodeSchema.safeParse(code);
  const d = displayNameSchema.safeParse(displayName);
  if (!c.success) return { ok: false, error: c.error.issues[0].message };
  if (!d.success) return { ok: false, error: d.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household", { p_code: c.data, p_display_name: d.data });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}

// New 7-day invite code (older codes stop working).
export async function createInviteAction(): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { data: me } = await supabase.from("household_members").select("household_id").eq("user_id", userId).maybeSingle<{ household_id: number }>();
  if (!me) return { ok: false, error: "You're not in a household." };

  await supabase.from("household_invites").delete().eq("household_id", me.household_id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode((a) => crypto.getRandomValues(a));
    const { error } = await supabase.from("household_invites").insert({ code, household_id: me.household_id });
    if (!error) return done();
    if (error.code !== "23505") break; // not a duplicate code: give up
  }
  return { ok: false, error: "Couldn't create an invite code. Please try again." };
}

export async function leaveHouseholdAction(): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { error } = await supabase.from("household_members").delete().eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't leave the household. Please try again." };
  return done();
}
