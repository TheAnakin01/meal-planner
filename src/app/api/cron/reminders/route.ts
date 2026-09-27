// Called every 15 minutes by Supabase's scheduler (pg_cron + pg_net; setup in supabase/local/, not in Git).
// Sends meal reminders that are due. Protected by CRON_SECRET; uses no admin keys — the database function
// checks the same secret and only returns what's due.

import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { type ReminderMeal, reminderPayload, safeEqual } from "@/lib/reminders";
import { isPushConfigured, sendPush } from "@/lib/push-server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

interface DueRow {
  r_user_id: string;
  r_meal: ReminderMeal;
  r_endpoint: string;
  r_p256dh: string;
  r_auth: string;
  r_title: string | null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "push not configured" }, { status: 500 });

  const supabase = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("claim_due_reminders", { p_secret: secret });
  if (error) {
    console.error("claim_due_reminders failed:", error.message);
    return NextResponse.json({ error: "database" }, { status: 500 });
  }

  let sent = 0;
  let removed = 0;
  const rows = (data ?? []) as DueRow[];
  for (const row of rows) {
    const result = await sendPush(
      { endpoint: row.r_endpoint, p256dh: row.r_p256dh, auth: row.r_auth },
      reminderPayload(row.r_meal, row.r_title),
    );
    if (result === "sent") sent++;
    if (result === "gone") {
      await supabase.rpc("remove_push_subscription", { p_secret: secret, p_endpoint: row.r_endpoint });
      removed++;
    }
  }
  return NextResponse.json({ due: rows.length, sent, removed });
}
