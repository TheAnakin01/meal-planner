// Who is signed in, for the app shell (header + bottom navigation). Cached per request so the
// header and the navigation share one lookup.

import "server-only";
import { cache } from "react";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface SessionInfo {
  email: string;
  isAdmin: boolean;
}

export const getSessionInfo = cache(async (): Promise<SessionInfo | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    email: typeof claims.email === "string" ? claims.email : "",
    isAdmin: await isCurrentUserAdmin(),
  };
});
