// Server-only helpers for reading the signed-in user's profile.

import "server-only";
import { PROFILE_COLUMNS, type ProfileRow, profileDraftFromRow, profileFromRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validation";

async function getProfileRow(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data;
}

// The signed-in user's complete profile, or null if they haven't filled it all in yet.
export async function getCurrentProfile(): Promise<ProfileInput | null> {
  const row = await getProfileRow();
  return row ? profileFromRow(row) : null;
}

// Whatever valid details are saved, for pre-filling the form (may be incomplete).
export async function getProfileDraft(): Promise<Partial<ProfileInput>> {
  const row = await getProfileRow();
  return row ? profileDraftFromRow(row) : {};
}
