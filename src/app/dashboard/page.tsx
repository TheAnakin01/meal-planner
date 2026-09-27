import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import MacroSummary from "@/components/MacroSummary";
import MealPlan, { MealPlanSkeleton } from "@/components/MealPlan";
import { isCurrentUserAdmin } from "@/lib/admin-server";
import { allergenLabel } from "@/lib/allergens";
import { dietLabel } from "@/lib/diet";
import { calculateNutritionPlan } from "@/lib/nutrition";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Your plan · Meal Planner",
};

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  // New users fill in their details first.
  if (!profile) redirect("/profile");

  const plan = calculateNutritionPlan(profile);
  const isAdmin = await isCurrentUserAdmin();
  const excluding = [...profile.allergies.map(allergenLabel), ...profile.otherAllergies];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Your daily plan</h1>
        <Link
          href="/profile"
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Edit details
        </Link>
      </div>

      {isAdmin && (
        <p className="mb-6 text-sm">
          <Link href="/admin" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Recipe library (admin) →
          </Link>
        </p>
      )}

      <MacroSummary plan={plan} excluding={excluding} diet={dietLabel(profile.dietType)} />

      <div className="mt-10">
        {/* Targets show straight away; recipes stream in when Spoonacular answers. */}
        <Suspense fallback={<MealPlanSkeleton />}>
          <MealPlan profile={profile} plan={plan} />
        </Suspense>
      </div>

      <div className="mt-10 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <p>
          Recipes are filtered for your allergies twice, but recipe data comes from third parties and may be
          wrong. Always check ingredient labels before cooking.
        </p>
        <p>Calorie and nutrient figures are estimates, not medical advice.</p>
      </div>
    </main>
  );
}
