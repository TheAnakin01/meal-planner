// Server-only: sends web push notifications (free; delivered by the browser's push service).
// Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY (public by design) and VAPID_PRIVATE_KEY (secret).

import "server-only";
import webpush from "web-push";
import type { ReminderPayload } from "@/lib/reminders";

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  configured = !!publicKey && !!privateKey;
  if (configured) webpush.setVapidDetails("https://meal-planner-pied-beta.vercel.app", publicKey!, privateKey!);
  return configured;
}

export function isPushConfigured(): boolean {
  return configure();
}

// "gone" = the phone unsubscribed or uninstalled: the subscription should be deleted.
export async function sendPush(sub: StoredSubscription, payload: ReminderPayload): Promise<"sent" | "gone" | "failed"> {
  if (!configure()) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: "normal", topic: payload.tag.slice(0, 32) },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error(`Push failed: HTTP ${status ?? "?"}`);
    return "failed";
  }
}
