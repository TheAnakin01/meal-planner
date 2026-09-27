import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShoppingListView from "@/components/ShoppingListView";
import { getCurrentProfile } from "@/lib/profile-server";
import { getMyHousehold } from "@/lib/household-server";
import { getShoppingData } from "@/lib/shopping-server";

export const metadata: Metadata = {
  title: "Shopping list · Meal Planner",
};

export default async function ShoppingPage({ searchParams }: PageProps<"/shopping">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");
  const household = await getMyHousehold();
  const scope = (await searchParams).list === "household" && household ? "household" : "me";
  const data = await getShoppingData(profile, scope, household?.id ?? null);
  const tab = "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium";

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
      {household ? (
        <nav aria-label="Which list" className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <Link href="/shopping" aria-current={scope === "me" ? "page" : undefined} className={`${tab} ${scope === "me" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}>
            Just me
          </Link>
          <Link
            href="/shopping?list=household"
            aria-current={scope === "household" ? "page" : undefined}
            className={`${tab} ${scope === "household" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
          >
            {household.name} ({household.members.length})
          </Link>
        </nav>
      ) : (
        <p className="text-sm">
          <Link href="/household" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Share this list with family →
          </Link>
        </p>
      )}
      {scope === "household" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Everyone&apos;s meals this week, added together. Ticks show up live for the whole household.</p>
      )}
      <ShoppingListView
        key={`${scope}-${data.checkedIds.join(",")}-${data.custom.map((c) => `${c.id}${c.checked ? "x" : ""}`).join(",")}`}
        scope={scope}
        householdId={household?.id ?? null}
        week={data.plan.weekStart}
        list={data.list}
        checkedIds={data.checkedIds}
        custom={data.custom}
        preferredStore={profile.preferredStore}
        shareTitle={`Shopping list – week of ${weekLabel}`}
      />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Amounts are rounded up to whole packs. Changing your meal plan updates this list; your ticks are kept. &ldquo;Buy&rdquo;
        links open the store&apos;s own search page — prices and delivery are up to the store.
      </p>
    </main>
  );
}
