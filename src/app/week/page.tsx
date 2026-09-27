import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import WeekView, { type WeekDay } from "@/components/WeekView";
import { MEALS, dayTotals, weekStart } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "This week · Meal Planner",
};

export default async function WeekPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");

  const plan = await getOrCreateWeekPlan(profile);
  const byId = new Map(plan.recipes.map((r) => [r.id, r]));
  const today = new Date();
  const todayWeek = weekStart(today, profile.timezone);
  const todayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, weekday: "short" }).format(today),
  );
  const monday = new Date(`${plan.weekStart}T12:00:00Z`);
  const label = (day: number) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + day);
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(date);
  };

  const days: WeekDay[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    label: label(day),
    isToday: plan.weekStart === todayWeek && day === todayIndex,
    totals: dayTotals(plan.slots, day, byId),
    meals: MEALS.map((meal) => {
      const slot = plan.slots.find((s) => s.day === day && s.meal === meal);
      const recipe = slot && byId.get(slot.recipeId);
      return {
        meal,
        recipeId: recipe ? recipe.id : null,
        title: recipe ? recipe.title : null,
        portion: slot?.portion ?? 1,
        kcal: recipe && slot ? recipe.perServing.kcal * slot.portion : 0,
        locked: slot?.locked ?? false,
        isLeftover: slot?.isLeftover ?? false,
      };
    }),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">This week</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/shopping"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Shopping list
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Today
          </Link>
        </div>
      </div>
      <WeekView
        days={days}
        targetKcal={plan.targets.calories}
        targetProteinG={plan.targets.macros.proteinG}
        leftovers={plan.leftovers}
        notes={plan.notes}
      />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Meals are filtered for your diet and allergies twice, but always check ingredient labels. Estimates only, not
        medical advice.
      </p>
    </main>
  );
}
