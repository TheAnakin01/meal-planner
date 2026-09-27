import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import WeightLogger from "@/components/WeightLogger";
import CalorieChart from "@/components/charts/CalorieChart";
import WeightChart from "@/components/charts/WeightChart";
import { localDate, shiftDate } from "@/lib/diary";
import { calculateNutritionPlan } from "@/lib/nutrition";
import {
  type WeightPoint,
  averageIntake,
  dailyIntake,
  daysOnTarget,
  lastNDates,
  loggingStreak,
  shouldSuggestProfileUpdate,
  weightSummary,
} from "@/lib/progress";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Progress · Meal Planner",
};

export default async function ProgressPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");

  const today = localDate(new Date(), profile.timezone);
  const targets = calculateNutritionPlan(profile);
  const supabase = await createClient();
  const [foodRes, weightRes] = await Promise.all([
    supabase
      .from("food_log")
      .select("eaten_on, calories, protein_g")
      .gte("eaten_on", shiftDate(today, -89))
      .returns<{ eaten_on: string; calories: number | string; protein_g: number | string }[]>(),
    supabase
      .from("weight_log")
      .select("logged_on, weight_kg")
      .gte("logged_on", shiftDate(today, -179))
      .order("logged_on")
      .returns<{ logged_on: string; weight_kg: number | string }[]>(),
  ]);
  if (foodRes.error) throw new Error(`Could not load diary: ${foodRes.error.message}`);
  if (weightRes.error) throw new Error(`Could not load weight: ${weightRes.error.message}`);

  const food = (foodRes.data ?? []).map((r) => ({ eaten_on: r.eaten_on, calories: Number(r.calories), protein_g: Number(r.protein_g) }));
  const last14 = dailyIntake(food, lastNDates(today, 14));
  const last7 = last14.slice(-7);
  const streak = loggingStreak(new Set(food.map((f) => f.eaten_on)), today);
  const avg = averageIntake(last7);
  const onTarget = daysOnTarget(last7, targets.calories);

  const weights: WeightPoint[] = (weightRes.data ?? []).map((w) => ({ date: w.logged_on, kg: Number(w.weight_kg) }));
  const summary = weightSummary(weights);
  const todayKg = weights.find((w) => w.date === today)?.kg ?? null;
  const latestKg = summary?.latest.kg ?? null;

  const tiles = [
    { label: "Logging streak", value: streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "—", note: "days in a row with food logged" },
    { label: "On target this week", value: `${onTarget} of 7`, note: "days within 10% of your calories" },
    { label: "Average this week", value: avg ? `${avg.kcal.toLocaleString()} kcal` : "—", note: avg ? `${avg.proteinG} g protein a day` : "log food in your diary" },
    {
      label: "Weight change",
      value: summary?.change30 !== null && summary?.change30 !== undefined ? `${summary.change30 > 0 ? "+" : ""}${summary.change30} kg` : "—",
      note: "over about 30 days",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Your progress</h1>
        <Link href="/diary" className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Food diary
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col-reverse justify-end rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <dd className="text-xs text-zinc-600 dark:text-zinc-400">{t.note}</dd>
            <dd className="text-2xl font-semibold">{t.value}</dd>
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.label}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="calories-chart" className="space-y-2">
        <h2 id="calories-chart" className="text-xl font-bold">
          Calories eaten, last 14 days
        </h2>
        {last14.some((d) => d.logged) ? (
          <CalorieChart days={last14} targetKcal={targets.calories} />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
            Nothing logged yet. Use the <Link href="/diary" className="font-semibold underline">food diary</Link> to see your calories here.
          </p>
        )}
      </section>

      <section aria-labelledby="weight-chart" className="space-y-3">
        <h2 id="weight-chart" className="text-xl font-bold">
          Weight
        </h2>
        <WeightLogger
          todayKg={todayKg}
          profileKg={profile.weightKg}
          suggestKg={shouldSuggestProfileUpdate(profile.weightKg, latestKg) ? latestKg : null}
        />
        {weights.length >= 2 ? (
          <WeightChart points={weights} />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Log your weight on two or more days to see your trend.</p>
        )}
      </section>

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Day-to-day weight changes are mostly water — look at the trend over weeks. Estimates only, not medical advice.
      </p>
    </main>
  );
}
