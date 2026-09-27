// Meal reminders (CLAUDE.md §13 add-on 13): notification text and settings validation. Pure, unit tested.

import { z } from "zod";

export type ReminderMeal = "breakfast" | "lunch" | "dinner";

const MEAL_NAME: Record<ReminderMeal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export interface ReminderPayload {
  title: string;
  body: string;
  url: string;
  tag: string; // replaces an older notification for the same meal instead of stacking
}

export function reminderPayload(meal: ReminderMeal, recipeTitle: string | null): ReminderPayload {
  return {
    title: `${MEAL_NAME[meal]} time 🍽️`,
    body: recipeTitle ? `On your plan: ${recipeTitle}. Tap to see your portion.` : "Tap to see today's plan.",
    url: "/dashboard",
    tag: `meal-${meal}`,
  };
}

// HH:MM between 00:00 and 23:30 (the 15-minute sending window must not cross midnight).
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:30.")
  .refine((t) => t <= "23:30", "Choose a time up to 23:30.");

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  breakfast: timeSchema,
  lunch: timeSchema,
  dinner: timeSchema,
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

// The browser needs the VAPID public key as bytes.
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Constant-time comparison for the scheduler's secret.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
