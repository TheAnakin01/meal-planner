import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import DiaryView, { type PlannedToday } from "@/components/DiaryView";
import { type DiaryEntry, diaryTotals, isoDateSchema, localDate, shiftDate } from "@/lib/diary";
import { MEALS, dayIndex } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Food diary · Meal Planner",
};

interface LogRow {
  id: number;
  meal: DiaryEntry["meal"];
  source: DiaryEntry["source"];
  label: string;
  amount: string;
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  recipe_id: number | null;
}

export default async function DiaryPage({ searchParams }: PageProps<"/diary">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");

  const now = new Date();
  const today = localDate(now, profile.timezone);
  const requested = (await searchParams).date;
  const parsed = isoDateSchema.safeParse(requested);
  const date = parsed.success && parsed.data <= today ? parsed.data : today;
  const isToday = date === today;

  const supabase = await createClient();
  const [{ data, error }, plan] = await Promise.all([
    supabase
      .from("food_log")
      .select("id, meal, source, label, amount, calories, protein_g, carbs_g, fat_g, recipe_id")
      .eq("eaten_on", date)
      .order("created_at")
      .returns<LogRow[]>(),
    getOrCreateWeekPlan(profile),
  ]);
  if (error) throw new Error(`Could not load diary: ${error.message}`);

  const entries: DiaryEntry[] = (data ?? []).map((r) => ({
    id: Number(r.id),
    meal: r.meal,
    source: r.source,
    label: r.label,
    amount: r.amount,
    calories: Number(r.calories),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
  }));

  // Today's planned meals, for one-tap logging.
  const byId = new Map(plan.recipes.map((r) => [r.id, r]));
  const loggedMeals = new Set((data ?? []).filter((r) => r.source === "plan").map((r) => r.meal));
  const planned: PlannedToday[] = isToday
    ? MEALS.flatMap((meal) => {
        const slot = plan.slots.find((s) => s.day === dayIndex(now, profile.timezone) && s.meal === meal);
        const recipe = slot && byId.get(slot.recipeId);
        return slot && recipe
          ? [{ meal, title: recipe.title, portion: slot.portion, kcal: recipe.perServing.kcal * slot.portion, logged: loggedMeals.has(meal) }]
          : [];
      })
    : [];

  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${date}T12:00:00Z`),
  );
  const navLink = "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <h1 className="text-3xl font-bold">Food diary</h1>
        <nav aria-label="Choose day" className="mt-3 flex items-center justify-between gap-2">
          <Link href={`/diary?date=${shiftDate(date, -1)}`} className={navLink}>
            ← Previous day
          </Link>
          <span className="text-center font-semibold">{isToday ? `Today, ${label}` : label}</span>
          {isToday ? (
            <span className="w-24" aria-hidden />
          ) : (
            <Link href={`/diary?date=${shiftDate(date, 1)}`} className={navLink}>
              Next day →
            </Link>
          )}
        </nav>
      </div>
      {/* key: fresh form state when switching days */}
      <DiaryView
        key={date}
        date={date}
        entries={entries}
        totals={diaryTotals(entries)}
        targetKcal={plan.targets.calories}
        targetProteinG={plan.targets.macros.proteinG}
        planned={planned}
      />
    </main>
  );
}
