// Progress insights (CLAUDE.md §13 add-on 10): daily totals, streaks, averages and weight trend.
// Pure, unit tested. Dates are YYYY-MM-DD strings in the user's timezone.

import { shiftDate } from "@/lib/diary";

export interface DayIntake {
  date: string;
  kcal: number;
  proteinG: number;
  logged: boolean; // anything logged that day
}

export interface WeightPoint {
  date: string;
  kg: number;
}

// The last `n` dates ending with `today`, oldest first.
export function lastNDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(today, i - (n - 1)));
}

export function dailyIntake(
  rows: readonly { eaten_on: string; calories: number; protein_g: number }[],
  dates: readonly string[],
): DayIntake[] {
  const byDate = new Map<string, { kcal: number; proteinG: number }>();
  for (const r of rows) {
    const d = byDate.get(r.eaten_on) ?? { kcal: 0, proteinG: 0 };
    d.kcal += r.calories;
    d.proteinG += r.protein_g;
    byDate.set(r.eaten_on, d);
  }
  return dates.map((date) => {
    const d = byDate.get(date);
    return { date, kcal: Math.round(d?.kcal ?? 0), proteinG: Math.round(d?.proteinG ?? 0), logged: !!d };
  });
}

// Days in a row with something logged, ending today — or ending yesterday if today isn't logged yet.
export function loggingStreak(loggedDates: ReadonlySet<string>, today: string): number {
  let day = loggedDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (loggedDates.has(day)) {
    streak++;
    day = shiftDate(day, -1);
  }
  return streak;
}

// Logged days whose calories are within ±10% of the target.
export function daysOnTarget(days: readonly DayIntake[], targetKcal: number, tolerance = 0.1): number {
  return days.filter((d) => d.logged && Math.abs(d.kcal - targetKcal) <= targetKcal * tolerance).length;
}

// Average calories and protein over the days that have something logged (null when none).
export function averageIntake(days: readonly DayIntake[]): { kcal: number; proteinG: number } | null {
  const logged = days.filter((d) => d.logged);
  if (logged.length === 0) return null;
  return {
    kcal: Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length),
    proteinG: Math.round(logged.reduce((s, d) => s + d.proteinG, 0) / logged.length),
  };
}

export interface WeightSummary {
  latest: WeightPoint;
  change30: number | null; // kg vs the weigh-in nearest to 30 days before the latest
}

export function weightSummary(points: readonly WeightPoint[]): WeightSummary | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const cutoff = shiftDate(latest.date, -30);
  const baseline = [...sorted].reverse().find((p) => p.date <= cutoff) ?? (sorted.length > 1 ? sorted[0] : null);
  return {
    latest,
    change30: baseline ? Math.round((latest.kg - baseline.kg) * 10) / 10 : null,
  };
}

// Clean axis ticks ("nice numbers") covering [min, max] with about `count` steps.
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// Suggest updating the profile weight (which drives calorie targets) when it's ≥ 1 kg off.
export function shouldSuggestProfileUpdate(profileKg: number, latestKg: number | null): boolean {
  return latestKg !== null && Math.abs(latestKg - profileKg) >= 1;
}
