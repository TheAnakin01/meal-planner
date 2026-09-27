import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShoppingListView from "@/components/ShoppingListView";
import { getCurrentProfile } from "@/lib/profile-server";
import { getShoppingData } from "@/lib/shopping-server";

export const metadata: Metadata = {
  title: "Shopping list · Meal Planner",
};

export default async function ShoppingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");
  const data = await getShoppingData(profile);

  const monday = new Date(`${data.plan.weekStart}T12:00:00Z`);
  const weekLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(monday);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Shopping list</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">For the week of {weekLabel}, from your meal plan</p>
        </div>
        <Link
          href="/week"
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Meal plan
        </Link>
      </div>
      <ShoppingListView list={data.list} checkedIds={data.checkedIds} custom={data.custom} />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Amounts are rounded up to whole packs. Changing your meal plan updates this list; your ticks are kept.
      </p>
    </main>
  );
}
