// Server-only: coach settings, history and usage limits for the signed-in user.

import "server-only";
import { COACH_LIMITS } from "@/lib/coach";
import { createClient } from "@/lib/supabase/server";

export interface CoachMessage {
  id: number;
  role: "user" | "model";
  content: string;
  createdAt: string;
}

export async function coachContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return { supabase, userId };
}

export async function isCoachEnabled(): Promise<boolean> {
  const { supabase, userId } = await coachContext();
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("coach_enabled").eq("id", userId).maybeSingle<{ coach_enabled: boolean }>();
  return data?.coach_enabled ?? false;
}

const retentionCutoff = () => new Date(Date.now() - COACH_LIMITS.retentionDays * 24 * 60 * 60 * 1000).toISOString();

// Deletes this user's messages older than the retention period (30 days).
export async function pruneOldMessages() {
  const { supabase, userId } = await coachContext();
  if (!userId) return;
  await supabase.from("coach_messages").delete().eq("user_id", userId).lt("created_at", retentionCutoff());
}

export async function getCoachHistory(limit = 60): Promise<CoachMessage[]> {
  const { supabase, userId } = await coachContext();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("coach_messages")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .gte("created_at", retentionCutoff())
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<{ id: number; role: "user" | "model"; content: string; created_at: string }[]>();
  if (error) throw new Error(`Could not load coach messages: ${error.message}`);
  return (data ?? []).reverse().map((m) => ({ id: Number(m.id), role: m.role, content: m.content, createdAt: m.created_at }));
}

// Questions left for this user in the rolling 24 hours, and whether the shared daily budget is used up.
export async function coachAllowance(): Promise<{ remaining: number; everyoneLimitReached: boolean }> {
  const { supabase, userId } = await coachContext();
  if (!userId) return { remaining: 0, everyoneLimitReached: false };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }, total] = await Promise.all([
    supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gt("created_at", since),
    supabase.rpc("coach_questions_last_24h"),
  ]);
  return {
    remaining: Math.max(0, COACH_LIMITS.perUserPer24h - (count ?? 0)),
    everyoneLimitReached: Number(total.data ?? 0) >= COACH_LIMITS.allUsersPer24h,
  };
}
