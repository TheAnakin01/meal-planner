import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import MealPlan, { MealPlanSkeleton } from "@/components/MealPlan";
import { calculateNutritionPlan } from "@/lib/nutrition";
import { getCurrentProfile } from "@/lib/profile-server";
import PageHeader from "@/components/ui/PageHeader";
import { CompassIcon } from "@/components/ui/icons";

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
    <main className="page">
      <PageHeader
        icon={CompassIcon}
        tint="bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
        title="Discover"
        intro="Fresh ideas from the web, sized to your meals"
        action={
          <Link href="/dashboard/saved" className="btn btn-secondary py-2">
            Saved
          </Link>
        }
      />
      <p className="text-sm muted">
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
