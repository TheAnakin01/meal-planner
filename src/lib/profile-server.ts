// Server-only helpers for reading the signed-in user's profile.

import "server-only";
import { PROFILE_COLUMNS, type ProfileRow, profileFromRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validation";

// The signed-in user's saved profile, or null if they haven't filled it in yet.
export async function getCurrentProfile(): Promise<ProfileInput | null> {
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
  return data ? profileFromRow(data) : null;
}
