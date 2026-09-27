// Server-only: is the signed-in user an admin (allowed to edit the recipe library)?
// The database enforces this too (public.is_admin() in RLS policies); this check is for the UI.

import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return false;

  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  // Treat errors (e.g. table not created yet) as "not admin" rather than breaking every page.
  if (error) return false;
  return data !== null;
}
