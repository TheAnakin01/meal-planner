// Server-only: the signed-in user's household (if any).

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface HouseholdMember {
  displayName: string;
  role: "owner" | "member";
  isMe: boolean;
}

export interface Household {
  id: number;
  name: string;
  members: HouseholdMember[];
  invite: { code: string; expiresAt: string } | null;
}

// The user's household, or null (also null if the Step 32 database update hasn't been run yet).
export async function getMyHousehold(): Promise<Household | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data: me, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle<{ household_id: number }>();
  if (error || !me) return null;
  const id = Number(me.household_id);

  const [household, members, invites] = await Promise.all([
    supabase.from("households").select("name").eq("id", id).maybeSingle<{ name: string }>(),
    supabase
      .from("household_members")
      .select("user_id, display_name, role, joined_at")
      .eq("household_id", id)
      .order("joined_at")
      .returns<{ user_id: string; display_name: string; role: "owner" | "member" }[]>(),
    supabase
      .from("household_invites")
      .select("code, expires_at")
      .eq("household_id", id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .returns<{ code: string; expires_at: string }[]>(),
  ]);

  return {
    id,
    name: household.data?.name ?? "Household",
    members: (members.data ?? []).map((m) => ({ displayName: m.display_name, role: m.role, isMe: m.user_id === userId })),
    invite: invites.data?.[0] ? { code: invites.data[0].code, expiresAt: invites.data[0].expires_at } : null,
  };
}
