import type { Metadata } from "next";
import HouseholdPanel from "@/components/HouseholdPanel";
import { getMyHousehold } from "@/lib/household-server";

export const metadata: Metadata = {
  title: "Household · Meal Planner",
};

const APP_URL = "https://meal-planner-pied-beta.vercel.app";

export default async function HouseholdPage() {
  const household = await getMyHousehold();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div>
        <h1 className="text-3xl font-bold">Household</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Share one live shopping list with family. Everyone keeps their own meal plan, allergies and portions — the list
          adds everyone&apos;s ingredients together.
        </p>
      </div>
      <HouseholdPanel household={household} appUrl={APP_URL} />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Others in your household see only your chosen name and the combined shopping list — never your email, plan,
        allergies or weight. Up to 8 people.
      </p>
    </main>
  );
}
