import type { Metadata } from "next";
import HouseholdPanel from "@/components/HouseholdPanel";
import { getMyHousehold } from "@/lib/household-server";
import PageHeader from "@/components/ui/PageHeader";
import { HouseholdIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Household · Meal Planner",
};

const APP_URL = "https://meal-planner-pied-beta.vercel.app";

export default async function HouseholdPage() {
  const household = await getMyHousehold();

  return (
    <main className="page">
      <PageHeader
        icon={HouseholdIcon}
        tint="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
        title="Household"
        intro="One live shopping list for the whole family"
      />
      <p className="muted">
        Everyone keeps their own meal plan, allergies and portions — the list adds everyone&apos;s ingredients together.
      </p>
      <HouseholdPanel household={household} appUrl={APP_URL} />
      <p className="text-xs muted">
        Others in your household see only your chosen name and the combined shopping list — never your email, plan,
        allergies or weight. Up to 8 people.
      </p>
    </main>
  );
}
