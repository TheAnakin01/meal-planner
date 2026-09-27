import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import InstallPrompt from "@/components/InstallPrompt";
import TodayHero from "@/components/TodayHero";
import TodayMeals, { type TodayMeal } from "@/components/TodayMeals";
import { CartIcon, ChartIcon, ChatIcon, DiaryIcon, ShieldIcon } from "@/components/ui/icons";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import { MEALS, dayIndex, dayTotals } from "@/lib/planner";
import { getOrCreateWeekPlan } from "@/lib/plan-server";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Today · Meal Planner",
};

const QUICK = [
  { href: "/diary", label: "Log food", icon: DiaryIcon, tint: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { href: "/shopping", label: "Shopping", icon: CartIcon, tint: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { href: "/coach", label: "Ask coach", icon: ChatIcon, tint: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  { href: "/progress", label: "Progress", icon: ChartIcon, tint: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
];

function greetingFor(date: Date, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// "Today": today's meals from this week's plan, with the day's targets.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  // New users fill in their details first.
  if (!profile) redirect("/profile");

  const plan = await getOrCreateWeekPlan(profile);
  const now = new Date();
  const today = dayIndex(now, profile.timezone);
  const byId = new Map(plan.recipes.map((r) => [r.id, r]));
  const totals = dayTotals(plan.slots, today, byId);
  const excluding = [...profile.allergies.map(allergenLabel), ...profile.otherAllergies];
  const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const { proteinG, carbsG, fatG } = plan.targets.macros;

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

  return (
    <main className="page">
      <TodayHero
        greeting={greetingFor(now, profile.timezone)}
        dateLabel={dateLabel}
        plannedKcal={totals.kcal}
        targetKcal={plan.targets.calories}
        tdee={plan.targets.tdee}
        macros={[
          { name: "Protein", planned: totals.proteinG, target: proteinG, color: "bg-sky-300" },
          { name: "Carbs", planned: totals.carbsG, target: carbsG, color: "bg-amber-300" },
          { name: "Fat", planned: totals.fatG, target: fatG, color: "bg-rose-300" },
        ]}
      />

      <nav aria-label="Quick actions">
        <ul className="stagger grid grid-cols-4 gap-2">
          {QUICK.map(({ href, label, icon: Icon, tint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center text-xs font-semibold transition hover:bg-white active:scale-95 dark:hover:bg-zinc-900"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tint} shadow-sm`}>
                  <Icon size={22} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <InstallPrompt />

      {plan.notes.map((n) => (
        <p key={n} role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {n}
        </p>
      ))}

      <TodayMeals day={today} meals={meals} />

      <section aria-label="Your settings" className="card flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <ShieldIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Planned for you</p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <span className="chip">{dietLabel(profile.dietType)}</span>
            <span className="chip">{plan.targets.calories.toLocaleString()} kcal/day</span>
            {excluding.length > 0 ? (
              excluding.map((a) => (
                <span key={a} className="chip bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300">
                  No {a.toLowerCase()}
                </span>
              ))
            ) : (
              <span className="chip">No allergies</span>
            )}
          </p>
        </div>
        <Link href="/profile" className="shrink-0 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Edit
        </Link>
      </section>

      <p className="text-xs muted">
        Meals are filtered for your diet and allergies twice, but always check ingredient labels. Calorie and nutrient
        figures are estimates, not medical advice.
      </p>
    </main>
  );
}
