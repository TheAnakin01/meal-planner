"use server";

import { revalidatePath } from "next/cache";
import { pushSubscriptionSchema, reminderPayload, reminderSettingsSchema } from "@/lib/reminders";
import { type StoredSubscription, isPushConfigured, sendPush } from "@/lib/push-server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

// Saves this phone's push subscription (after the user allowed notifications).
export async function saveSubscriptionAction(subscription: unknown): Promise<Result> {
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "This browser gave an unexpected notification setup." };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("saveSubscription failed:", error.message);
    return { ok: false, error: "Couldn't save this phone for reminders. Please try again." };
  }
  return { ok: true };
}

export async function removeSubscriptionAction(endpoint: unknown): Promise<Result> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "Invalid request." };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  return { ok: true };
}

export async function saveReminderSettingsAction(settings: unknown): Promise<Result> {
  const parsed = reminderSettingsSchema.safeParse(settings);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase
    .from("profiles")
    .update({
      reminders_enabled: parsed.data.enabled,
      breakfast_reminder: parsed.data.breakfast,
      lunch_reminder: parsed.data.lunch,
      dinner_reminder: parsed.data.dinner,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save your reminder times." };
  revalidatePath("/profile");
  return { ok: true };
}

// Sends a test notification to all of the user's phones, right now.
export async function sendTestReminderAction(): Promise<Result> {
  if (!isPushConfigured()) return { ok: false, error: "Reminders aren't set up on the server yet (missing keys)." };
  const { supabase, userId } = await context();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId).returns<StoredSubscription[]>();
  if (!data || data.length === 0) return { ok: false, error: "Turn reminders on first, on this phone." };

  let sent = 0;
  for (const sub of data) {
    const result = await sendPush(sub, { ...reminderPayload("lunch", null), title: "Test reminder ✅", body: "Meal reminders are working on this phone." });
    if (result === "sent") sent++;
    if (result === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
  return sent > 0 ? { ok: true } : { ok: false, error: "Couldn't deliver the test. Try turning reminders off and on again." };
}
