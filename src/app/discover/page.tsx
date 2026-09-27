import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import MealPlan, { MealPlanSkeleton } from "@/components/MealPlan";
import { calculateNutritionPlan } from "@/lib/nutrition";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Discover · Meal Planner",
};

// Recipe ideas from Spoonacular (the v1 feature). Each visit costs ~4 of the 50 free daily points,
// so it lives on its own page instead of loading with every visit to "Today".
export default async function DiscoverPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");
  const plan = calculateNutritionPlan(profile);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Discover</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Fresh ideas from the web, sized to your meals</p>
        </div>
        <Link
          href="/dashboard/saved"
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Saved
        </Link>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        These come from Spoonacular and aren&apos;t in your weekly plan or shopping list. Save ones you like with ♡.
      </p>

      <Suspense fallback={<MealPlanSkeleton />}>
        <MealPlan profile={profile} plan={plan} />
      </Suspense>

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Filtered for your diet and allergies twice, but recipe data comes from third parties and may be wrong. Always check
        ingredient labels.
      </p>
    </main>
  );
}
