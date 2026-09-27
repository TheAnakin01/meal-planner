// Food diary (CLAUDE.md §13 add-on 9): entry shapes and daily totals. Pure, unit tested.

import { z } from "zod";
import type { Nutrients } from "@/lib/library";

export const DIARY_MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type DiaryMeal = (typeof DIARY_MEALS)[number];

export interface DiaryEntry {
  id: number;
  meal: DiaryMeal;
  source: "plan" | "barcode" | "manual";
  label: string;
  amount: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const isoDateSchema = z.iso.date();

export const manualEntrySchema = z.object({
  date: isoDateSchema,
  meal: z.enum(DIARY_MEALS),
  label: z.string().trim().min(1, "What did you eat?").max(120),
  amount: z.string().trim().max(40),
  calories: z.number({ error: "Enter the calories." }).min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
});
export type ManualEntry = z.infer<typeof manualEntrySchema>;

export function diaryTotals(entries: readonly Pick<DiaryEntry, "calories" | "proteinG" | "carbsG" | "fatG">[]): Nutrients {
  const t = entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.calories, proteinG: acc.proteinG + e.proteinG, carbsG: acc.carbsG + e.carbsG, fatG: acc.fatG + e.fatG }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const r = (n: number) => Math.round(n * 10) / 10;
  return { kcal: r(t.kcal), proteinG: r(t.proteinG), carbsG: r(t.carbsG), fatG: r(t.fatG), fiberG: 0 };
}

// Moves a YYYY-MM-DD date by whole days (no timezone surprises: works in UTC).
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Today's date (YYYY-MM-DD) in the user's timezone.
export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
