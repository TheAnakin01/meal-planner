import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import InstallPrompt from "@/components/InstallPrompt";
import MacroSummary from "@/components/MacroSummary";
import TodayMeals, { type TodayMeal } from "@/components/TodayMeals";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import { MEALS, dayIndex, dayTotals } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Today · Meal Planner",
};

const linkClass = "font-semibold text-emerald-700 hover:underline dark:text-emerald-400";

// "Today": the user's targets plus today's meals from this week's plan.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  // New users fill in their details first.
  if (!profile) redirect("/profile");

  const [plan, isAdmin] = await Promise.all([getOrCreateWeekPlan(profile), isCurrentUserAdmin()]);
  const now = new Date();
  const today = dayIndex(now, profile.timezone);
  const byId = new Map(plan.recipes.map((r) => [r.id, r]));
  const totals = dayTotals(plan.slots, today, byId);
  const excluding = [...profile.allergies.map(allergenLabel), ...profile.otherAllergies];
  const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, weekday: "long", day: "numeric", month: "long" }).format(now);

  const meals: TodayMeal[] = MEALS.map((meal) => {
    const slot = plan.slots.find((s) => s.day === today && s.meal === meal);
    const recipe = slot && byId.get(slot.recipeId);
    return {
      meal,
      recipeId: recipe ? recipe.id : null,
      title: recipe ? recipe.title : null,
      portion: slot?.portion ?? 1,
      kcal: recipe && slot ? recipe.perServing.kcal * slot.portion : 0,
      proteinG: recipe && slot ? recipe.perServing.proteinG * slot.portion : 0,
      locked: slot?.locked ?? false,
      isLeftover: slot?.isLeftover ?? false,
    };
  });
  const planned = meals.filter((m) => m.recipeId).length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Today</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{dateLabel}</p>
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Edit details
        </Link>
      </div>

      <nav aria-label="Planner" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/week" className={linkClass}>
          This week →
        </Link>
        <Link href="/shopping" className={linkClass}>
          Shopping list →
        </Link>
        <Link href="/diary" className={linkClass}>
          Food diary →
        </Link>
        <Link href="/coach" className={linkClass}>
          Ask your AI coach →
        </Link>
        <Link href="/discover" className={linkClass}>
          Discover more recipes →
        </Link>
        {isAdmin && (
          <Link href="/admin" className={linkClass}>
            Recipe library (admin) →
          </Link>
        )}
      </nav>

      <InstallPrompt />

      <MacroSummary plan={plan.targets} excluding={excluding} diet={dietLabel(profile.dietType)} />

      {planned > 0 && (
        <p className="text-sm">
          <span className="font-semibold">Planned today:</span> {Math.round(totals.kcal).toLocaleString()} of{" "}
          {plan.targets.calories.toLocaleString()} kcal · {Math.round(totals.proteinG)} of {plan.targets.macros.proteinG} g protein
        </p>
      )}
      {plan.notes.map((n) => (
        <p key={n} role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {n}
        </p>
      ))}

      <TodayMeals day={today} meals={meals} />

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Meals are filtered for your diet and allergies twice, but always check ingredient labels. Calorie and nutrient
        figures are estimates, not medical advice.
      </p>
    </main>
  );
}
