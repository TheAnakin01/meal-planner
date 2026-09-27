import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MacroSummary from "@/components/MacroSummary";
import { allergenLabel } from "@/lib/allergens";
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
      <MacroSummary plan={plan} excluding={excluding} />
    </main>
  );
}
