import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import WeekView, { type WeekDay } from "@/components/WeekView";
import { MEALS, dayIndex, dayTotals, weekStart } from "@/lib/planner";
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
  const todayIndex = dayIndex(today, profile.timezone);
  const monday = new Date(`${plan.weekStart}T12:00:00Z`);
  const label = (day: number) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + day);
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(date);
  };

  const dayMonth = (day: number) => label(day).split(" ").slice(1).join(" ");
  const range = `${dayMonth(0)} – ${dayMonth(6)}`;

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
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{range}</p>
          <h1 className="text-3xl font-bold tracking-tight">This week</h1>
        </div>
        <Link
          href="/shopping"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-800 active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          Shopping list
        </Link>
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
